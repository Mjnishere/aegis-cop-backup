# AEGIS-COP — Roadmap and Validation Plan

**Everything in this file is proposed future work, not implemented.** The current state is
in [`CAPABILITY_TRUTH_MATRIX.md`](CAPABILITY_TRUTH_MATRIX.md). The roadmap is a direction
to be re-prioritised with users, not a commitment that every item will be built.

## 1. Value propositions and how to test them

None of these benefits has been measured yet. Each is written so that it can be proven
wrong.

| # | Proposition | How to evaluate (representative users, repeatable scenario) | Observable metrics | What would count against it |
|---|---|---|---|---|
| V1 | Linking observation → evidence → threat → route impact reduces the effort to understand a situation | Within-subject trial: the same scripted scenario solved (a) with AEGIS-COP and (b) with the report list and map shown separately. Scenarios with known correct answers. 8–12 participants with relevant planning experience; order counterbalanced | Time to state "does this affect the movement, and why"; correctness of that statement; NASA-TLX workload | No time or accuracy gain; participants ignore the chain |
| V2 | The operator can compare the alternative with the current route | Ask participants to choose and justify, in scenarios where the alternative is sometimes *worse* (e.g. much longer for a LOW threat) | Correct accept/reject rate; justification cites the trade-off figures | Participants accept every proposal (automation bias) |
| V3 | Visible assumptions and gaps (simulated, unavailable, stale, last known) lead to calibrated trust | Inject degraded conditions (weather unavailable, backend stale) mid-scenario | Whether participants notice and mention the gap; whether they over- or under-trust the hazard figure | Gaps unnoticed; labels ignored |
| V4 | The human gate prevents an algorithmic proposal from silently becoming an authorised decision | Inspection plus fault injection: confirm no code path changes a mission route without an approval record; attempt double approval | Count of route changes without an APPROVED recommendation (target 0); refused duplicate decisions | Any route change without a recorded approval |
| V5 | The mission record makes it easier to reconstruct what happened and why | Debrief task: give a different participant only the record and ask them to reconstruct the sequence and reasons | Reconstruction accuracy against the scenario script; time taken | Record insufficient to explain decisions |
| V6 | The workflow stays transparent when a source or the backend is unavailable | Scripted outages (backend stop, weather off, tiles off) during the scenario | Whether the UI ever shows a fabricated or stale value as current (target 0); recovery time after restart | Any unlabelled stale value |

**Already partly evidenced (software behaviour only, not user value):**
- V4: the approve path is the only call to `apply_replacement`, and decisions on a
  non-PENDING recommendation are refused.
- V6: outage states were observed in browser runs on 2026-10-10.

## 2. Phased roadmap (proposed)

### Phase 1 — Strengthen the current prototype

| Item | Why | Dependency / risk |
|---|---|---|
| ~~Event-driven route reassessment on every threat create/update/close~~ | **Done 2026-10-10** (`reassess_all`, `tests/test_route_automation.py`) | — |
| Explicit verification state for threats (REPORTED → CORROBORATED → CONFIRMED / DISMISSED), with routing policy aware of it | Answers "reported vs confirmed" | Needs agreement on who can change state |
| Authenticated identities and roles for approve/reject | Done so far: self-declared name + free-text reason recorded (2026-10-10). Remaining: authentication, roles, signed decisions | Identity provider choice |
| Persist response plans and resources (today in memory) | Survive restart | Low |
| ~~Persist no-safe-route outcomes in the mission record~~ | **Done 2026-10-10** (`replacement_attempts`, migrated in `init_db`) | — |
| Tamper-evident decision log (hash-chained) and export for debrief | Accountability | Low–medium |
| Repeatable evaluation scenarios with ground truth (scripted seeds + expected outcomes) | Needed for V1–V6 | Low; builds on `scripts/demo/` |

### Phase 2 — Data integration (through interfaces, not new detectors)

| Item | Notes |
|---|---|
| Defined ingestion interface for authorised field reports and sensor alerts, mapping to the existing evidence model (source type, id, timestamp, location, confidence, provenance) | The evidence model is the integration target; the interface spec comes first |
| Drone-detection *event* ingestion from an appropriate external detector | AEGIS-COP consumes detections; it does not perform detection |
| Source health monitoring (last message, latency, error state) feeding the data-source strip | Extends the existing honest-status display |
| Time and location normalisation (clock skew, datum, accuracy) | Required before correlation |
| Duplicate-event handling and provenance chain | Today evidence and threats are not de-duplicated |
| Threat expiry and staleness rules | Today threats stay active until closed |

### Phase 3 — Correlation and validation

| Item | Notes |
|---|---|
| Multi-source correlation (space, time, source type) proposing merged threats for human confirmation | Not automatic confirmation |
| Explicit treatment of uncertainty: zone geometry from observation accuracy; conflicting-report handling | Replace declared circular radii |
| Calibration of routing policy and hazard heuristics on representative, authorised datasets | Requires labelled historical events |
| Measurement of false alerts, missed events, latency and decision-support usability | Against the Phase 1 scenarios |

### Phase 4 — Controlled operational evaluation

| Item | Notes |
|---|---|
| Role-based access control, security review, encryption at rest | Precondition for any real data |
| Offline / degraded-network testing; self-hosted tiles; store-and-forward | Tiles currently need internet |
| Integration with approved systems via agreed interfaces | Owner and accreditation required |
| Human-factors testing with qualified users | Builds on V1–V6 |
| Written acceptance criteria before any operational use | Gate, not a formality |

## 3. Smallest next step that produces credible evidence

1. Turn the existing demo into **three scripted evaluation scenarios** with known correct
   answers:
   - a CRITICAL threat on the route (alternative available);
   - a LOW threat on the route (the alternative is not worth taking);
   - a dead end (no safe route — `no_safe_route_case.py` already exists).
2. Run a **small V1/V2/V5 study** (5–8 people) comparing AEGIS-COP with a separate
   report list plus map. Record time, correctness and reconstruction accuracy.
3. Close the remaining cheap credibility gap: replace the self-declared decision name with
   an authenticated one. (Event-driven reassessment and persisted failed searches were done
   on 2026-10-10.)

This produces measured evidence of value (or of its absence) in weeks, without any new
data source.

## 4. Key risks

| Risk | Mitigation |
|---|---|
| Automation bias: users approve every proposal | V2 scenarios where the right answer is "reject"; keep the cost visible |
| Over-trust of uncalibrated numbers | Keep "heuristic / uncalibrated / partial" labels; prefer showing zones crossed and deltas over a single score |
| Integration and accreditation effort dwarfs the prototype | Start with a read-only report import in a test environment |
| Scope creep into detection or fusion | Keep AEGIS-COP as the decision layer that consumes detections |
| Region lock-in (one city graph, one DEM tile) | Region-independent data pipeline before broader trials |

## 5. Deliberately out of scope

The following are out of scope:
- detection and computer vision;
- autonomous tasking;
- target identification;
- any automatic change to a movement without a recorded human decision.
