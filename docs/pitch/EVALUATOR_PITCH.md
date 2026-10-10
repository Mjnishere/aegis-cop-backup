# AEGIS-COP — Evaluator Pitch

Audience: a technically curious evaluator with operational naval experience who will
challenge exaggeration. Strategy: **show one working end-to-end decision workflow, name
its assumptions, and propose how its value would be tested.** Every claim below maps to
a row in [`CAPABILITY_TRUTH_MATRIX.md`](CAPABILITY_TRUTH_MATRIX.md).

## 1. The decision problem

**Question:** when a new observation changes the safety of a planned movement, how does a
decision-maker understand the geographic impact, compare the options, and record a
deliberate decision?

These are different steps, and treating them as one is where errors creep in:

| Stage | What it is | In AEGIS-COP today |
|---|---|---|
| Receiving an observation | Something was reported, by someone or something, at a time and place | Simulated sensor/field reports with a source id, timestamp and location |
| Treating it as evidence | The report becomes a record with provenance and a declared confidence | `evidence` record: `provenance.is_simulation`, `confidence_basis` |
| Identifying / recording a threat | A judgement that something dangerous exists in an area, linked to its evidence | Threat with severity, single-source confidence rule and `evidence_references` |
| Assessing geographic and route impact | Does that area touch *this* movement, and what policy applies? | Zone (circle + 25 m buffer) intersected with the route geometry; CRITICAL → INVALIDATED, with a stored reason |
| Generating an alternative | A candidate that respects the policy | Threat-aware search; or an explicit "no safe route" |
| Reviewing the trade-off | What does avoiding it cost? | Distance, time, heuristic hazard score, zones crossed, side by side with deltas |
| Authorising or rejecting | A human accepts responsibility for the change | Approve / reject, recorded with time and reason; only approval changes the route |

**Problem hypothesis (to validate, not assert):** when reports, the map and the movement
plan sit in separate tools, a decision-maker must connect them mentally. That costs time,
hides assumptions (is this report confirmed? is weather missing?) and leaves a weak record
of why a route changed. AEGIS-COP tests whether keeping that chain connected, visible and
recorded helps. We do not claim that any particular organisation's systems are
fragmented. That is what we would validate with operational users.

## 2. What differentiates it (and what does not)

| | Generic GIS dashboard | Basic incident map | Route planner | AEGIS-COP prototype |
|---|---|---|---|---|
| Shows reports/threats on a map | ✓ | ✓ | — | ✓ |
| Links a report to evidence and a threat record | — | Partly | — | ✓ (provenance, evidence → threat ids) |
| Computes whether a threat compromises a specific planned movement | — | — | Sometimes (avoid areas) | ✓ (stored status and reason) |
| Treats a policy class (CRITICAL) as a hard constraint with an explicit "no safe route" | — | — | Rarely explicit | ✓ |
| Shows the trade-off of the alternative vs the current plan | — | — | Sometimes | ✓ (distance, time, zones crossed, deltas) |
| Requires a human decision before the plan changes, and records it | — | — | — | ✓ (approve/reject persisted) |
| Shows its own data gaps (simulated, unavailable, stale, last known) | Rarely | Rarely | — | ✓ |

**Honest assessment:** none of these pieces is novel on its own. The differentiator is
the **connected, recorded chain from a report to a human-reviewed movement decision**,
with assumptions visible. It is not mature: one movement at a time, one simulated input
type, circular zones, uncalibrated policy, and no authenticated identities. A stronger
differentiator needs evidence: users completing the decision faster or more correctly,
and reconstructing decisions from the record. That is the validation plan in
[`ROADMAP_AND_VALIDATION.md`](ROADMAP_AND_VALIDATION.md).

## 3. 30-second introduction

> "AEGIS-COP is a geospatial decision-support prototype. It connects a field report to the
> evidence behind it, the threat it implies, and that threat's effect on a planned
> movement. It then proposes an alternative, shows the cost of taking it, and requires a
> human to approve or reject. Today it runs end to end on a real road network for one
> city, with simulated reports, and it records every step. I'll show you the whole chain
> in about three minutes."

## 4. 90-second pitch

1. **Problem (15 s):** "When a report changes the safety of a planned movement, someone
   has to work out whether it matters for *this* route, what the alternative costs, and
   then own the decision. Those steps are easy to blur."
2. **Approach (20 s):** "AEGIS-COP keeps them as an explicit chain: observation, evidence,
   threat, geographic impact, alternative, human decision, recorded outcome. It works on
   a real OpenStreetMap road graph with a stated routing policy."
3. **Working demonstration (25 s):** "Here a simulated water-level sensor reports
   flooding on our convoy's route. The system links the evidence and records a CRITICAL
   threat. It invalidates the route with the reason stored, and proposes an alternative:
   one kilometre and four minutes longer, crossing zero known threat zones instead of
   one. The operator rejects it, recomputes and approves. All of it is persisted."
4. **Value (15 s):** "The decision-maker sees why the plan changed, what it costs and what
   is missing, such as unavailable weather or no live sensor feed, and there is a record
   to review afterwards."
5. **Next step (15 s):** "The report is simulated, the policy is uncalibrated and there
   is no authentication yet. The next step is a structured scenario test with
   representative users, and a defined interface for one authorised report source."

## 5. Three-minute pitch (script with stage directions)

> **[Screen: Overview, mission NOT STARTED. Point at the data-source list.]**
> "This is AEGIS-COP's operating picture. Before anything else, it tells you what it does
> *not* have: no live sensor or field feeds, which is why reports here are simulated;
> unit positions that are seeded, not tracked; and weather that is unavailable because
> this laptop is offline. Everything else on the screen is read from the backend."

> **[Click START MISSION.]**
> "We plan a relief-convoy movement from a staging area to the city centre. The route is
> computed on the real road graph: 6.9 kilometres, about 17 minutes. The hazard figure is a
> heuristic and it says so. It is partial because weather is unknown, and it shows how
> high it could be."

> **[Click SIMULATE SENSOR REPORT. Point at the decision chain as it fills.]**
> "Now a water-level sensor reports a flooded carriageway on our route. This report is
> simulated, and the screen says so. Watch the chain. The observation is recorded as
> evidence with its source and timestamp, and linked to a threat. The threat's confidence
> is MEDIUM by a stated rule: a single unconfirmed source can never be HIGH."

> **[Point at the red zone and the 'Why the route is INVALIDATED' box.]**
> "The geographic question is whether this matters for *our* movement. The threat zone
> intersects the planned route. Our policy treats CRITICAL zones as no-go, so the route
> is invalidated, and the reason, naming the threat, is stored."

> **[Point at the Proposed alternative card.]**
> "The system offers a candidate: 7.9 kilometres instead of 6.9, 21 minutes instead of
> 17, crossing zero known threat zones instead of one. That is the trade-off: a kilometre
> and four minutes to avoid the one zone we know about. It is a candidate, not a
> guarantee. It only avoids what has been reported."

> **[Type your name and a short reason, then click REJECT.]**
> "The operator can say no. Nothing changes silently: the route stays invalidated, and
> the rejection is recorded with the name I typed and my reason. That name is
> self-declared. There is no login yet, and the record says so."

> **[Click COMPUTE ALTERNATIVE ROUTE, then APPROVE.]**
> "Recomputing gives the same answer, because it is deterministic. Approving is the only
> thing that changes the mission route. The decision is recorded with its time."

> **[Press F5. Point at the mission log.]**
> "After a reload, it's all still there: planned, invalidated and why, proposed,
> rejected, proposed again, approved, replaced. That is the record you would want for a
> debrief."

> **[Closing, facing the evaluator.]**
> "What you saw working is the chain: observation to recorded decision on a real road
> network, with its assumptions visible. What you didn't see, because it doesn't exist
> yet, is a real sensor feed, authenticated users, calibrated policy or multi-source
> correlation. Our next step is not more features. It is to test this workflow with
> people who make these decisions, and measure whether it helps."

## 6. One-slide value proposition

**AEGIS-COP: from a field report to a recorded, human-approved movement decision**

- **Problem:** a new report can invalidate a planned movement. Linking report → threat →
  route impact → options → decision is often manual and weakly recorded *(hypothesis to
  validate)*.
- **Approach:** an explicit, persisted chain of observation → evidence → threat →
  geographic route impact → candidate alternative with its trade-off → human
  approve/reject → recorded outcome, with data gaps shown on screen.
- **Works today:** threat-aware routing on a real OSM road graph; CRITICAL zones as hard
  constraints with an explicit no-safe-route result; route invalidation with stored
  reasons; automatic route re-check whenever a threat is recorded, changed or closed;
  alternative with distance/time/zones-crossed deltas; approve/reject persisted with a
  self-declared name and reason; failed searches recorded; offline backend; honest
  degraded states. 137 automated backend tests (with terrain data).
- **Potential value:** faster, clearer understanding of why a plan must change; explicit
  costs; no silent algorithmic changes; a reconstructable decision record. *To be
  measured.*
- **Still to integrate and validate:** authorised report/sensor sources, multi-source
  correlation, calibrated policy, authenticated identity and access control, streaming
  data and push updates, user evaluation.

*(No market size, accuracy or time-saving figures: none have been measured. See the
validation plan.)*

## 7. Six-slide outline

| # | Main message | Bullets | Visual |
|---|---|---|---|
| 1. Operational decision problem | A new report can change whether a planned movement is acceptable; the decision should be quick, explained and owned | • Report ≠ evidence ≠ threat ≠ route impact • Someone must compare options and own the call • Hypothesis: these steps are often disconnected • We test whether connecting them helps | The seven-stage chain as a simple horizontal diagram |
| 2. Architecture and workflow | A small, inspectable system: road graph, threat zones, persisted mission state, human gate | • FastAPI + SQLite backend, React + Leaflet UI • OSM road graph (OSMnx/NetworkX), circular threat zones + 25 m buffer • Policy in one file (`routing_policy.py`), uncalibrated • Runs fully offline except map tiles | Box diagram from [`../ARCHITECTURE.md`](../ARCHITECTURE.md) |
| 3. Live scenario and map | One fictional relief convoy; one simulated sensor report | • Movement 6.9 km / 17 min • Simulated water-level report → evidence → CRITICAL threat • Route invalidated with stored reason • Simulation labelled on screen | Screenshot `docs/screenshots/02-route-compromised-alternative.png` |
| 4. Route assessment and human decision | The alternative is a candidate with an explicit cost; only a human changes the plan | • 7.9 km / 21 min, zones crossed 1 → 0 • Reject keeps the route invalidated • Approve → REPLACED, recorded • "No safe route" is reported, never invented | Screenshots `03-alternative-approved.png` and `06-no-safe-route.png` |
| 5. Today vs roadmap | Clear line between working, simulated and planned | • Working: routing, invalidation, alternatives, decisions, record, degraded states • Simulated: reports, unit positions, dispatch, rain scenario • Planned: real feeds, correlation, calibration, authenticated identity/RBAC, streaming updates | Three-column table from the truth matrix |
| 6. Validation plan and value | We propose to measure value, not assert it | • Scenario-based trials with representative users • Metrics: time-to-correct-decision, errors, recall of reasons, trust calibration • Acceptance criteria before any operational use • Smallest next step: one authorised report interface + one user study | Table of propositions → metric (from the roadmap doc) |

## 8. Language guide

| Avoid | Use |
|---|---|
| "detects threats", "AI-driven" | "records a reported threat", "rule-based" |
| "real-time situational awareness" | "routes are re-checked automatically when a threat is recorded; the display refreshes every 10 s" |
| "approved by Lt. X" (as if authenticated) | "recorded under the name the operator typed — self-declared, no login yet" |
| "safe route", "risk-free" | "candidate route that avoids the known zones" |
| "risk score / probability" | "heuristic hazard score, uncalibrated" |
| "sensor fusion", "drone integration" | "planned: an interface for authorised sources" |
| "tracks units" | "seeded or manual positions" |
| "C2 integration" | "would need an agreed interface; not built" |
