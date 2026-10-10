# AEGIS-COP — Live Demo Runbook (evaluator session)

Purpose: one continuous, reliable story, **observation → evidence → threat → route impact
→ alternative → human decision → recorded outcome**, using only behaviour verified on
2026-10-10. The values below come from fresh-database browser runs on that date: the
backend was offline, the DEM was present and the UI was in dark theme. If a number
differs on the day, say what you see; do not quote this file.

The general runbook is in [`../DEMO.md`](../DEMO.md). This file is the evaluator cut of it.

## Scenario framing (fictional, non-sensitive)

> "A relief-supply convoy must move from a staging area in Navanagar to a distribution
> point in Hubballi city centre during monsoon flooding. Shortly after the route is
> planned, a water-level sensor on the route reports that the carriageway is flooded.
> The sensor report is **simulated** for this demonstration."

The convoy and the sensor are fictional. The places are ordinary public localities in the
prototype's single coverage area. There are no military installations, units or real
operational routes.

## 1. Before the session (T-30 min)

### Start (three terminals, from the repository root)

```bash
# T1 — backend, offline, on a FRESH database (never data/aegis.db)
cd backend
export AEGIS_DEMO_DIR=$(mktemp -d /tmp/aegis-demo-XXXX)
DATABASE_PATH=$AEGIS_DEMO_DIR/demo.db \
DEM_PATH=/path/to/cdnd43d.tif \
HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9 NO_PROXY=localhost,127.0.0.1 \
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
# T2 — frontend
cd frontend && npm run dev          # http://localhost:5173
```

```bash
# T3 — health, seed, warm-up
curl -s http://127.0.0.1:8000/api/health                     # {"status":"ok"}
.venv/bin/python scripts/demo/seed_demo.py                   # refuses if DB not empty
curl -s -o /dev/null -w "warm-up %{http_code} %{time_total}s\n" \
  "http://127.0.0.1:8000/api/route?origin_lat=15.4030&origin_lon=75.0800&destination_lat=15.3647&destination_lon=75.1240"
curl -s http://127.0.0.1:8000/api/system/status              # osm LOADED, terrain AVAILABLE (or a reason)
```

- **Why a fresh database:** the seed refuses to run on a database that already has
  threats, and the story depends on a clean state. A fresh `mktemp` directory never
  touches existing data. No destructive reset is needed.
- **Why the proxy variables:** they block the backend's outbound calls, so weather is
  deterministically *unavailable* and nothing depends on venue internet.
- **DEM path:** `DEM_PATH` is optional. Without it, terrain reads
  `UNAVAILABLE (DEM_UNAVAILABLE)` and the hazard numbers differ; routes and the workflow
  are the same.
- **Warm-up:** loads the road graph (about 10 s cold). Afterwards a route takes under a
  second; 0.36–0.70 s was measured.

### Pre-flight checklist

- [ ] Browser on http://localhost:5173, **Overview**, dark theme, window ≥ 1280 px wide
      (at 1600×1000 the approve/reject card fits without scrolling).
- [ ] Header shows **BACKEND CONNECTED**. The decision chain reads "Mission: NOT
      STARTED". There are 3 active threats.
- [ ] Map tiles visible (needs internet). If they are not, see the fallbacks below.
- [ ] **Do not press RAIN SCENARIO before the main demo.** It creates CONTROLLED_DEMO
      incidents, including a CRITICAL zone near the city centre, which changes later route
      results (observed 2026-10-10).
- [ ] `docs/screenshots/` open in a second window as a backup.
- [ ] Decide the name you will type in **Decision by** (e.g. your callsign). It is
      remembered in this browser and recorded with each decision as *self-declared*.
- [ ] Optional: a fourth terminal at the repo root, ready for
      `.venv/bin/python scripts/demo/post_external_report.py` (see the extensions).

## 2. Main demo (3–4 minutes)

| Step | Say (short) | Click | Expected (verified 2026-10-10) | If it differs |
|---|---|---|---|---|
| 0 | "This is the operating picture: threats, data-source status and the decision chain. Everything here is read from the backend." | — | Data sources: Backend CONNECTED, Road graph LOADED, Terrain AVAILABLE, Weather UNAVAILABLE, "Sensor / field feeds: NONE CONNECTED — simulated reports only", "Unit positions: MANUAL / SEEDED — no live GPS" | Read the strip aloud: it states what is missing |
| 1 | "We plan a relief convoy movement." | Active Mission → **START MISSION** | Blue route, Mission origin/destination markers; ACTIVE, **6.9 km · 17 min**; "Hazard (heuristic) LOW 36.4 · partial data — could be up to 96.4 · confidence LIMITED" | Slow (> 10 s) = cold graph; wait. Error toast = check T1 |
| 2 | "A water-level sensor on the route reports flooding. This report is **simulated**: its location, radius and confidence are fixed inputs." | **SIMULATE SENSOR REPORT** | Toast "SIMULATED report → threat THREAT-… (CRITICAL); mission route INVALIDATED". Red 75 m zone on the route. Chain: ✓ Observation received (SENSOR SIM-WLS-07 · SIMULATED) → ✓ Evidence linked (EVD-… → THREAT-…) → ✓ Threat identified (CRITICAL · conf. MEDIUM) → red Route impact assessed (INVALIDATED) | If no proposal appears within ~20 s, press **COMPUTE ALTERNATIVE ROUTE** |
| 3 | "Why does it matter? The route now passes through a zone recorded as CRITICAL. Our policy treats CRITICAL as a hard exclusion, so the route is invalidated. The reason is stored with the threat id." | Point at **Why the route is INVALIDATED** | "Route intersects active CRITICAL threat zone(s): THREAT-…" with recorded time | — |
| 4 | "The engine proposes an alternative. It is a **candidate for human review**, not a safe route." | — (appears ~15–17 s after step 2) | Dashed green route. Card "Proposed alternative · AWAITING YOUR DECISION": Distance 6.9 → **7.9 km** (+1.0), Travel time 17 → **21 min** (+4), Hazard score 36.4 → 30.7, Threat zones crossed **1 → 0**. "Trade-off: +1.0 km, +4 min to cross 0 instead of 1 known threat zone(s)." Caveat: "not a guarantee that the road is safe" | — |
| 5 | "The operator can decline. Rejection does not quietly change anything, and it is attributed." | Type your name in **Decision by** and a reason (e.g. "Convoy holds for recce"), then **REJECT** | Toast "…rejected by <name> — route remains compromised"; chain "Operator decision REJECTED by <name>"; route still INVALIDATED; log "<name> REJECTED the alternative (<reason>)" | Name is optional; without it the record says "EOC operator" |
| 6 | "Recompute: same inputs, same answer. The engine is deterministic." | **COMPUTE ALTERNATIVE ROUTE** | Same proposal; chain "Awaiting approve / reject" | — |
| 7 | "Only an explicit approval changes the mission route, and the record says who and why." | Optional reason, then **APPROVE** | Mission REPLACED, 7.9 km · 21 min; "Operator decision recorded … by <name> (self-declared name)" and the reason; all 7 chain stages ✓ | Say plainly: the name is typed, not authenticated |
| 8 | "And it is recorded: reload the page." | F5 | Same REPLACED state, mission log: planned → INVALIDATED (reason) → proposed → REJECTED → proposed → APPROVED → REPLACED | — |

**Closing line:** "One observation became linked evidence and a recorded threat. Its
geographic impact on the movement was computed, an alternative was offered with its
cost, and a human decided, twice, with every step recorded. What you saw is the
workflow. The sensor feed, identities and calibration are what would have to be
integrated and validated next."

### Optional extensions (only if time and questions allow)

| Show | How | Expected |
|---|---|---|
| Automatic re-check from an external source | After step 8, T4: `.venv/bin/python scripts/demo/post_external_report.py --at 0.5`. Say: "a test client posts a report through the public API, the way an authorised source would" | Within ~10 s, with no click: the replaced route turns INVALIDATED; log "REPLACED → INVALIDATED: … (automatic re-check)"; chain shows the EXT-TEST-CLIENT evidence (SIMULATED). Verified 2026-10-10 |
| Honest failure | T3: `.venv/bin/python scripts/demo/no_safe_route_case.py`. Wait ≤ 10 s for the panel to follow the new mission (already INVALIDATED automatically) → **COMPUTE ALTERNATIVE ROUTE** | "No safe alternative exists: every path to the destination crosses a CRITICAL zone." Chain: Alternative generated, "No safe route exists" (red). No approve button, no invented route. Reload: still shown, and the log has "Alternative search: no safe route exists (blocked by THREAT-…)" |
| Degraded operation | Stop T1 (Ctrl+C), wait ~10 s | BACKEND UNREACHABLE, STALE SNAPSHOT with its time, sources "(last known)", chain stages "unknown". Restart T1 with the **same** `DATABASE_PATH` → state restored |
| Evidence from the threat side | Click the SIMULATED threat in the left queue | Linked evidence card and the threat record timeline |
| Human-in-the-loop elsewhere | Field Operations → START TRIP on a unit, then COMPLETE | First accepted; second "Status change rejected: Invalid transition from EN_ROUTE to COMPLETED" |

## 3. 60–90 second backup demo

Use this if time is cut or something is slow. Start from a fresh database with the
mission already started, or start it as the first action.

1. "Planned movement" → **START MISSION** (6.9 km · 17 min).
2. "Simulated sensor report on the route" → **SIMULATE SENSOR REPORT** → point at the
   chain (observation → evidence → threat → INVALIDATED) and at the red zone.
3. "Candidate alternative with its cost" → read the comparison: +1.0 km, +4 min, zones 1 → 0.
4. "A human decides" → **APPROVE** → REPLACED and the recorded decision.
5. "What is simulated: the report. What is real: the geometry, routing, state and record."

## 4. Recovery

| Problem | Do this | Do not |
|---|---|---|
| Proposal does not appear | **COMPUTE ALTERNATIVE ROUTE** | Do not narrate a proposal that isn't there |
| A toast shows an error | Read it; it is the backend's message. Retry once | Do not retry repeatedly in silence |
| BACKEND UNREACHABLE | Restart T1 with the same `DATABASE_PATH`; reload | Do not start a new DB mid-demo (the mission will be gone) |
| Seed refuses ("already has threats") | New `AEGIS_DEMO_DIR`, restart T1, re-seed, warm up | Do not delete files |
| Blank map tiles (no venue internet) | Routes, zones and markers still draw on a blank background; continue, or switch to `docs/screenshots/` | Do not claim the map is offline-capable: tiles need internet |
| Weather looks "wrong" | It is *unavailable* by design offline. Say so | Do not press RAIN SCENARIO to "fix" it during the main story |
| Unexpected verdict (e.g. route already INVALIDATED at start) | The panel explains "since registration". Say the backend found an existing zone; continue with COMPUTE | Do not hide it |
| Frontend broken | Show http://127.0.0.1:8000/docs: `/api/cop`, `/api/route-monitor/{id}` | — |

## 5. Things never to say during the demo

- "Detected", "real-time", "AI", "sensor fusion", "safe route", "risk probability",
  "calibrated", "live tracking", "integrated with C2".
- Say instead: "simulated report", "re-checked automatically when a threat is recorded",
  "rule-based", "candidate alternative", "heuristic score", "seeded or manual positions",
  "self-declared name", "would need an interface to …".
