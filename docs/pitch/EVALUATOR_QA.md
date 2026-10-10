# AEGIS-COP — Evaluator Q&A (hard questions, honest answers)

Answer short, say what exists, what does not, and what the next engineering step is.
Code references let you show proof on screen if asked.

---

**1. What does this give me beyond a map with markers?**
A map shows *where* things are. AEGIS-COP computes and records *what a reported threat
means for a specific planned movement*:
- whether the route geometry enters the threat zone (radius + 25 m buffer);
- what the policy says (CRITICAL = no-go);
- the resulting status, with a stored reason;
- a candidate alternative with its cost (distance, time, zones crossed).

Nothing changes until a human approves, and every step is persisted.
*Refs: `services/threat/zones.py`, `services/route_monitor_service.py` `reassess_route`,
`services/route_replacement_service.py`.*

**2. How do you distinguish a reported threat from a confirmed one?**
Today, only partially:
- Every threat carries its source, linked evidence and a confidence label.
- A single unconfirmed source can never be HIGH confidence (the rule in
  `simulated_report.py`).
- Simulated inputs are flagged end to end (`provenance.is_simulation`, SIMULATED badges).

There is **no** reported → confirmed workflow: no analyst confirmation step and no
corroboration counter. That is Phase 1 work: add an explicit verification state and make
the routing policy aware of it.

**3. What evidence supports the route recommendation?**
- The recommendation states its reason: "the current route was invalidated by a
  CRITICAL zone; the candidate avoids blocking zones and has no CRITICAL segments".
- It gives backend-computed metrics for both routes.
- The invalidation reason names the threat id. The threat links to its evidence record,
  which shows the source, time, location and declared confidence.

You can follow the chain on screen. There is no hidden model; it is graph search under a
stated policy.

**4. How are threat-zone boundaries and route crossings determined?**
- **Zones:** circles with a centre and radius, from the threat record. The radius is
  *declared* by whoever reports it; for the simulated sensor it is fixed at 75 m.
- **Crossing test:** the minimum distance from the centre to each route edge's full
  geometry, computed on a local equirectangular projection, compared with radius + 25 m.
- **Policy:**
  - CRITICAL edges are removed from the graph;
  - HIGH, MODERATE and LOW multiply travel time by 3.0, 1.75 and 1.25;
  - overlapping zones do not compound;
  - a zone containing an endpoint is penalised ×10 rather than blocked.

*Refs: `config/routing_policy.py`, `services/threat/zones.py`, `tests/test_threat_routing.py`.*
**Limitation:** circles only; the radius does not come from the observation; the values
are uncalibrated.

**5. Is the risk score calibrated against real outcomes?**
No.
- It is a heuristic: 0.6 × weather + 0.4 × terrain (`services/hazard_scoring.py`).
- When a component is unknown, the score is shown as partial with an upper bound, rather
  than silently re-weighted.
- The routing decision does **not** depend on that score. It depends on the threat
  zones and the stated policy.

Calibration would need historical events and outcomes for the area.

**6. How do you handle false positives, false negatives and conflicting reports?**
We don't, yet.
- A false report produces a threat until someone closes it.
- A missed event produces nothing.
- Conflicting reports are both kept.
- The only safeguards are that confidence is capped for a single source, and the human
  approval gate.

Phase 3 covers correlation, conflict rules and measuring false and missed alerts against
a labelled dataset.

**7. What happens if communications are lost?**
- **Between browser and backend:** the UI says BACKEND UNREACHABLE, keeps the last
  snapshot clearly marked STALE with its time, marks sources "last known" and shows
  decision stages as "unknown" rather than guessing. When the backend returns, the state
  is intact; this was demonstrated by stopping and restarting the backend.
- **External services:** the backend itself needs no outbound network.

There is no store-and-forward, no replication and no multi-node sync. It is a single
backend.

**8. What if weather or mapping services are unavailable?**
- **Weather:** treated as *unknown*, never as zero rain (ADR-011,
  `tests/test_weather_outage.py`). Hazard scores are marked partial; routing and threat
  logic are unaffected. The demo runs in this mode deliberately.
- **Map tiles:** they need internet in the browser. Without them, routes, zones and
  markers still draw on a blank background.

Self-hosted tiles would be a straightforward next step.

**9. Is this real-time?**
Not in the sense of live data, and we don't claim it is.
- **Event-driven re-check:** every monitored route is re-checked automatically when a
  threat is recorded, changed or closed, whoever records it (UI, API or risk scan). The
  transition is logged as an automatic re-check. Shown live: a report posted by an
  external test client through the API invalidates the route with no click.
- **Display:** the UI polls the operating picture every 10 seconds; there is no push.
- **Not time-based:** nothing re-checks a route on a timer, and there are no live
  sources to watch in the first place.

**10. Does it receive real drone or sensor detections?**
No.
- Reports are simulated from fixed profiles, and the screen says
  "Sensor / field feeds: NONE CONNECTED — simulated reports only".
- There is no drone detection, computer vision or sensor fusion.

The evidence model (source type, source id, timestamp, location, confidence, provenance)
is the intended ingestion target. Phase 2 defines an interface for an authorised
external detector rather than building one.

**11. How are stale, duplicated or untrusted reports handled?**
- **Stale:** evidence has timestamps, but threats do not expire automatically.
- **Duplicated:** evidence and threats are not de-duplicated. Only risk-scan incidents
  are de-duplicated, by region.
- **Untrusted:** there is no trust model beyond the source type, the provenance flags
  and the single-source confidence cap.

All three are Phase 2–3 items: expiry, de-duplication by time/space/source, and source
trust levels.

**12. Can the operator inspect why a recommendation was generated?**
Yes, within what the system knows:
- the persisted invalidation reason, with the threat id;
- the threat and its linked evidence;
- the routing rule text;
- the side-by-side comparison with deltas;
- the engine's rationale string.

There is no explanation of *why this particular path* beyond "shortest under the
policy".

**13. What stops someone mistaking a simulated result for verified intelligence?**
Labelling at every layer:
- the API flags (`is_simulation`, source `SIMULATED_REPORT`);
- threat titles prefixed "SIMULATED:";
- SIMULATED badges and chips;
- the data-source line "simulated reports only";
- confidence text "fixed by the simulation profile, not measured".

Demo seed data is labelled DEMO. Labelling is necessary but not sufficient. An
operational system would need these separated by environment and access, not just by
labels.

**14. How would it integrate with existing command-and-control systems?**
It doesn't today, and we won't pretend otherwise. The backend is a plain HTTP/JSON API.
Integration would need:
- an agreed message format and an interface owner;
- authorisation to connect;
- a decision on which system is authoritative for tracks and threats;
- accreditation.

The realistic first step is a one-way, read-only import of reports into the evidence
model in a test environment.

**15. What security, access-control, audit, deployment and data-governance work remains?**
Most of it:
- **Identity:** no authentication; CORS is open; the API must be bound to localhost.
  Decisions record the name the operator *types*, plus their reason, and are explicitly
  marked self-declared (`actor_basis: SELF_DECLARED_NOT_AUTHENTICATED`). It is
  accountability by convention, not proof of identity.
- **Audit:** the trail is persisted in SQLite but is not tamper-evident.
- **Accreditation:** no encryption at rest, no role-based authority and no security
  review.
- **Data governance:** we keep restricted data out of the repository (the CartoDEM tile
  is never committed, per its licence).

**16. How would this be validated before anyone relied on it?**
In stages; see [`ROADMAP_AND_VALIDATION.md`](ROADMAP_AND_VALIDATION.md):
1. Scripted scenarios with known ground truth, to check that the software does what it
   claims. This exists in part: 137 backend tests and browser rehearsals.
2. Usability trials with representative users, measuring time to a correct decision,
   decision errors and the ability to reconstruct a decision from the record.
3. Validation of the routing policy and travel times on authorised data.
4. A controlled operational evaluation against written acceptance criteria.

No operational reliance before step 4.

**17. What is the actual differentiator?**
The connected, recorded chain from a reported observation to a human-approved change of
a specific movement, with the cost of the change and the system's own data gaps visible.
Each piece exists elsewhere; the linkage and the human gate are the point. It is a
prototype-level differentiator until user trials show it helps.

**18. What is deliberately out of scope?**
- Detection: no CV, no drone or sensor processing.
- Sensor fusion.
- Autonomous tasking or any automatic action.
- Targeting.
- Live tracking.
- Calibrated risk prediction.
- Multi-region data.
- Accreditation.

The system proposes; a human decides.

**19. Why should I trust the routing at all?**
Treat it as a candidate, as the UI says. What you can trust is the bounded claim:
- the route avoids the CRITICAL zones currently recorded, under the stated buffer;
- if no such route exists, the system says so instead of offering one
  (`tests/test_mission_workflow.py::test_no_safe_alternative_is_reported_honestly`, also
  shown live).

Road data is an OpenStreetMap snapshot, and travel times are OSMnx defaults, not
validated.

**20. What happens if two operators act at once?**
There is no concurrency control beyond the database: no locking, no roles and no "who is
deciding" indicator. One guard exists: approving or rejecting a recommendation that is no
longer PENDING is refused ("Recommendation is already …",
`route_replacement_service.py` `approve_replacement`). It has not been tested with
simultaneous users and is not a substitute for proper locking. It is a Phase 4 item.

**21. Why a flood scenario if you are pitching to a defence evaluator?**
Because it is the data we can lawfully use and demonstrate, and humanitarian assistance
and disaster relief movements are a real use case. The workflow does not depend on the
threat category. A threat is a located, severity-classified record with evidence. We
make no claim about military procedures.

**22. How much of this did you build, versus reuse?**
- **Reused:** OSMnx and NetworkX for the road graph; Leaflet and OpenStreetMap for the
  map; FastAPI and SQLite.
- **Built:** the threat-zone routing policy, the route-monitoring state machine, the
  evidence/threat linkage, the simulated report pipeline, the replacement and decision
  workflow, the operating-picture contract and the UI.

The commit history and tests are in the repository.

**23. How are threats detected?**
They are not detected by the system. A threat exists in AEGIS-COP only because something
*recorded* it, through one of four paths:

| Path | What creates the threat | Label |
|---|---|---|
| SIMULATE SENSOR REPORT / SIMULATE FIELD REPORT (UI) | A fixed simulation profile: evidence + linked CRITICAL threat at the mission route's midpoint | SIMULATED |
| Public API (`POST /api/threats`, `POST /api/evidence`) | Whatever client posts it. Demo: `scripts/demo/post_external_report.py`, a test client | As declared by the client; the demo client marks itself SIMULATED |
| Incident scan (SCAN FOR INCIDENTS, rain scenario) | With no regional feed configured: a built-in list of demo regions | `DEMO:` titles, no official warning, "not a detection" |
| Demo seed (`scripts/demo/seed_demo.py`) | Fixed demo threats | `DEMO:` / CONTROLLED_DEMO |

What the system *does* do with a recorded threat:
- turns it into a geographic zone;
- re-checks every monitored route against it, automatically;
- links it to its evidence;
- labels its provenance.

Detection, whether from drones, sensors or computer vision, would sit upstream and post
through the same API (roadmap Phase 2). AEGIS-COP is designed as the decision layer, not
the detector.
