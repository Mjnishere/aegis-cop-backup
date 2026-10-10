# AEGIS — Implementation Status

Last updated: 2026-10-10 (AEGIS-COP mission workflow and decision chain; publication pass). Update this file whenever
a capability's status changes, and record the evidence.

## Status labels

| Label | Meaning |
|---|---|
| **Verified** | Implemented and runtime-verified by a recorded automated test or run (offline, temp DB unless stated) |
| **Browser-verified** | Rendered and exercised in a real browser (headless Chrome via CDP) against a running backend on a temp DB |
| **Unverified** | Implemented, but no recorded runtime evidence |
| **Partial** | Some of the intended behaviour exists; gaps listed |
| **Mock/demo** | Simulated, seeded or placeholder behaviour; must be labelled as such in UI/API |
| **Planned** | Not implemented |
| **Blocked** | Cannot proceed without data, licence, credentials or a decision |

"Verified" means *the code does what its tests assert in a test environment*. It
does **not** mean validated against real-world outcomes; nothing in AEGIS is.

## Current evidence (2026-10-10, final pre-publication run)

| Check | Result |
|---|---|
| Environment | Python 3.12.3, `.venv`, `backend/requirements.lock.txt`; Node 20.19.5, `npm ci` from lock |
| `cd backend && ../.venv/bin/python -m pytest` with `DEM_PATH` set | **137 passed**, 0 failed (network blocked in-process, temp SQLite) |
| Same without the DEM | 110 passed, 27 skipped with explicit reasons |
| Same without the DEM and the OSM graph | 68 passed, 69 skipped |
| `npm run lint` | Exit 0; 0 errors, 62 warnings (pre-existing unused vars/hook deps). Extra `oxlint -D no-undef` scan: only browser globals |
| `npm run build` | Success |
| Browser rehearsal of the mission workflow (headless Chrome via CDP, offline backend on a fresh temp DB, Vite dev server) | Passed — see "Mission workflow and decision chain" |
| `data/aegis.db` after all runs | Not created |

## Fixes after the pitch review (2026-10-10) — Verified + browser-verified

| Fix | Implementation | Evidence |
|---|---|---|
| Event-driven route re-check | `route_monitor_service.reassess_all` runs after threat create/update/close (`threat_service`), incident scan and incident status changes; transitions carry `trigger` (`THREAT_CHANGE`, `SIMULATED_REPORT`, `CHECK`); a REPLACED route that is still clear stays REPLACED; an unchanged compromised `/check` reports the stored reason | `tests/test_route_automation.py` (4 tests); browser: `scripts/demo/post_external_report.py` turned a REPLACED route INVALIDATED with no click |
| Self-declared decision maker + reason | approve/reject accept `actor` and `reason` (sanitised, ≤ 80 / ≤ 500 chars, default "EOC operator"); responses mark `actor_basis: SELF_DECLARED_NOT_AUTHENTICATED`; UI fields "Decision by" and "Reason" | `tests/test_route_automation.py` (2 tests); browser: "REJECTED by Lt. A. Rao (Convoy holds for recce)" |
| Persisted failed replacement searches | `monitored_routes.replacement_attempts` (JSON) + `init_db` migration for existing files; recorded for `NO_SAFE_AVAILABLE_ROUTE` / `NO_ROUTE` / `NO_BETTER_ROUTE`; chain and log read them | `tests/test_mission_workflow.py` (extended), `tests/test_schema_migration.py`; browser: "No safe route exists" after reload |
| Built-in demo incidents labelled | scan fallback incidents titled `DEMO:`, no official warning, confidence MEDIUM, timeline "… not a detection"; result `source: BUILT_IN_DEMO_REGIONS`; UI scan message says so | `tests/test_route_automation.py` (1 test); browser: Incidents → SCAN FOR INCIDENTS |

Still not done: authentication/roles (the name is self-declared), time-based monitoring,
de-duplication/expiry of reports, persisted response plans.

## Frontend redesign (2026-10-10) — Browser-verified

Presentation-only change; no backend code or API contract changed (`git diff -- backend` empty).

- Design tokens: Tailwind palettes mapped to CSS variables with separate background,
  text and border scales (`frontend/scripts/generate-theme.mjs` → `src/theme/palette.css`);
  semantic tokens `canvas`, `accent`, `line`. Dark theme by default; Light and System
  selectable in the header (stored per browser in `localStorage`, applied before first paint).
- Shell: icon-rail sidebar below 1280 px (labels from 1280 px), compact header
  (branding, operating area, weather, backend status, the one implemented scenario
  control, theme selector), inline SVG icon set (`components/ui/Icon.jsx`).
- Overview: operational summary (COP summary counts + pending decisions on the active
  mission, STALE SNAPSHOT chip when refresh fails), compact data-source list,
  seven-stage decision-chain stepper, large map, compact threat queue with linked
  evidence and threat-record timeline, mission panel with decision card first.
- Map: dark re-toning of the OSM basemap only (satellite never recoloured),
  collapsible layer panel (counts stay visible when collapsed), compromised route solid
  red vs dashed green proposal, `MapAutoResize` re-measures maps after layout changes.
- Truthfulness fixes found during the redesign: scenario banner no longer shows
  fallback values (80 mm / 50 % blockage) absent from the backend config; weather card
  says "scenario values" in scenario mode; Satellite and Regional headers state what is
  (not) analysed/configured; a route already compromised at registration (no transition
  recorded) is now explained as "since registration" instead of showing no impact.

| Check | Result |
|---|---|
| `npm run lint` | Exit 0; 0 errors, 62 warnings (pre-existing). `oxlint -D no-undef`: browser globals only |
| `npm run build` | Success (JS 512 kB / 149 kB gzip; Vite's 500 kB advisory warning) |
| Full workflow, fresh DB, dark theme | start → simulated report → INVALIDATED → proposal (+1.0 km, +4 min, zones 1 → 0) → reject → recompute → approve → REPLACED; reload keeps state |
| Light theme | Overview, Incidents, Field Operations, Weather (offline and scenario), Regional |
| Widths (browser inner size) | 1582×904, 1348×772, 1262×804, 1006×772 — no horizontal page overflow; map re-measures after resize |
| No-safe-route (`no_safe_route_case.py`) | "No safe route exists" in chain and panel; no approve button |
| Backend stopped / restarted | UNREACHABLE, STALE SNAPSHOT, last-known sources, chain "unknown"; recovers after restart |
| Rain scenario on/off | Scenario banner/values labelled; END RAIN SCENARIO deactivates (backend `active: false`) |

Not verified: widths below ~1000 px (phones), keyboard-only navigation beyond visible
focus styles, screen-reader output.

## Mission workflow and decision chain (2026-10-10) — Browser-verified

Implemented: `services/threat/simulated_report.py`, `routes/simulation.py`
(`/api/simulation/profiles`, `/api/simulation/field-report`), route-monitor history
(`transitions`, `recommendations`), `MissionPanel.jsx`, `DecisionChain.jsx`
(decision chain + data-source strip), `scripts/demo/no_safe_route_case.py`.
Automated: `tests/test_mission_workflow.py` (4 tests: report → linked evidence + threat →
INVALIDATED with threat id; reject then approve, consistent history and COP; unknown
profile/route rejected; honest `NO_SAFE_AVAILABLE_ROUTE` with nothing persisted).

Browser rehearsal on a fresh seeded database (backend outbound calls blocked, DEM present):

| Step | Observed |
|---|---|
| Clean Overview | Data-source strip (backend CONNECTED, road graph LOADED, terrain AVAILABLE, weather UNAVAILABLE, feeds "NONE CONNECTED — simulated reports only", unit positions "MANUAL / SEEDED"); chain shows MISSION SETUP pending |
| START MISSION | ACTIVE, 6.9 km · 17 min, "LOW (36.4) · partial data, up to 96.4 · confidence LIMITED" |
| SIMULATE SENSOR REPORT | SIMULATED evidence (SENSOR SIM-WLS-07) + CRITICAL threat (confidence MEDIUM by the single-source rule); route INVALIDATED with the threat id; alternative auto-proposed: 7.9 km · 21 min, hazard 36.4 → 30.7, threat zones 1 → 0, "Trade-off: +1.0 km, +4 min" |
| REJECT → COMPUTE → APPROVE | Chain: OPERATOR DECISION REJECTED → awaiting → APPROVED; route REPLACED; "OPERATOR DECISION RECORDED" |
| Reload | Same chain (all 7 steps complete), log and map from SQLite |
| Incident desk | "Official Warning: None linked", severity score labelled as fixed per level, linked SIMULATED evidence |
| No-safe-route (`no_safe_route_case.py`) | CHECK ROUTE → INVALIDATED; COMPUTE → "No safe alternative exists…", chain "✕ ALTERNATIVE PROPOSED — No safe route exists", no approve button |
| Backend stopped | BACKEND UNREACHABLE, STALE snapshot with time, source statuses "(last known)", chain steps "unknown" |
| Backend restarted (same DB) | CONNECTED; mission state and chain restored |
| Weather tab offline | Plain-language "Weather data unavailable — conditions are unknown" with the raw provider error only under "Technical detail" |
| National tab offline | No placeholder regions; empty state names the feed mode (`NOT_CONFIGURED`) |

Known gaps (at the time of this run; both closed later — see "Fixes after the pitch review"):
- A `NO_SAFE_AVAILABLE_ROUTE` result was not persisted.
- Tested at one viewport (≈1580×900).

### Earlier browser verification (2026-10-10, COP layers)

Fixtures were created through the API in a temporary database: 4 active threats
(CRITICAL, HIGH, demo-labelled MODERATE, operator-reported CRITICAL obstruction) and
1 closed threat; 4 demo field units (2 with positions); 2 monitored routes (ACTIVE,
INVALIDATED by a simulated obstruction); 3 active evidence records (drone, simulated,
one without coordinates) and 1 archived. Weather was UNAVAILABLE.

| Stage | Observed |
|---|---|
| Load | Map rendered; layer panel shows "Weather unavailable — hazard scores are partial", counts 4/4/2/3 from the backend summary, "(2 unplotted)" units, "(1 unplotted)" evidence, "1 route(s) INVALIDATED"; header shows "WEATHER UNAVAILABLE — conditions unknown"; closed threat not drawn |
| Layers | Map paths match fixtures (2 routes, 8 threat shapes, 2 unit and 2 evidence markers, simulated evidence dashed). Each toggle removed only its own layer (21→13/19/19/19 paths) and restored on re-enable |
| Popups | INVALIDATED route: "LOW (36.32) — partial data, could be up to 96.32; Confidence: LIMITED (weather unavailable)". Simulated evidence: SIMULATED badge, source, 80% source confidence |
| API error | Route planner displayed the backend's 422 `OUTSIDE_COVERAGE` message for an origin 42 km off-network (matches a direct API call) |
| Stale | Backend stopped after load: panel keeps last snapshot and shows "STALE — last refresh failed: Failed to fetch" |
| Unavailable | Reload with backend down: "COP unavailable", counts "–", **0 map paths** (no substituted objects) |

Not browser-verified: the follow-up change that keeps the threat list visible (with a
STALE notice) when a refresh fails after data was loaded — build only. Route-monitor
dashboard buttons, flood-safe planning success path, and the weather dashboard chart
were not exercised in the browser.

### Defect found by the browser check

Cold-start backend hang: `RoutingService.load_graph()` was not thread-safe. The
dashboard's parallel first requests each loaded the 26 MB graph (~600 MB apiece);
six concurrent requests took RSS from 249 MB to >2.4 GB and all timed out at 90 s.
Fixed with a lock and publish-when-complete loading (same for the synthetic drainage
grid). After the fix the same burst returned 200 in ~6 s at 660 MB
(`tests/test_graph_loading.py`).

## Earlier demo readiness (2026-10-10, superseded UI)

*Historical.* This walkthrough used the earlier route-monitoring panel (OBSTRUCTION /
START ROUTE MONITORING buttons), which has since been replaced by the Active Mission
panel and decision chain above. The backend fixes listed here still apply.

Full offline walkthrough (`docs/DEMO.md`) rehearsed three times from fresh databases
with identical results, in headless Chrome against `uvicorn` (127.0.0.1) and
`npm run dev`: preset route planning; live CRITICAL road closure → detour (18 → 21
nodes, +62 m); route monitoring with partial-data hazard display; simulated
obstruction → persisted invalidation → replacement proposal (18.6 km) → approval →
REPLACED; controlled flood scenario; weather tab chart; post-scenario check →
INVALIDATED by CRITICAL zones; replacement search → honest no-safe-route; stale COP
after backend stop. All **browser-verified**.

Demo-breaking defects found and fixed:
- Weather outage made hazard-aware routing retry the provider once per explored edge
  (52,068 HTTP attempts, 127 s for the 17 km corridor). Failures are now cached for
  30 s (1 attempt, 32 s cold / ~7 s warm). `test_weather_outage.py::test_provider_failures_are_cached_briefly`.
- Route-monitoring panel showed hard-coded "SAFE (0/100)", "CRITICAL (80/100)",
  "Critical flood-risk segment detected" and a fixed "SAFE (0/100) | ETA 22 mins"
  proposal (also when the backend found no alternative). Now bound to COP data and
  the backend's reason/recommendation; stale proposals are cleared.
- Planner route was recoloured by an unrelated monitored route's status.
- Weather header/badge showed scenario data without a CONTROLLED label and "LIVE
  WEATHER FORECAST" while the forecast was unavailable.

Known demo constraints: the first hazard-aware corridor request is slow (~40 s) —
warm up before presenting; the weather tab fetches when opened (switch tabs or press
Refresh after starting the scenario); the floating planner hides part of the map
(close it with ✕).

## Capability matrix

### Layer A — Foundation and persistence

| Capability | Status | Evidence / notes |
|---|---|---|
| Reproducible backend install | Verified | Lock file + `pip check` |
| Reproducible frontend install/build | Verified | `npm ci`, build |
| SQLite persistence: threats, field units, monitored routes, evidence, route recommendations | Verified | `test_persistence.py`, `test_route_persistence.py`, `test_evidence_domain.py` |
| Concurrent cold start (single graph load) | Verified | `test_graph_loading.py`; real-server burst test |
| Schema evolution on existing DBs | Partial | New tables via `create_all`; additive `ALTER TABLE` for `incidents` only. No migration framework |
| Persistence of resources, alerts, citizens, legacy evidence, audit logs | Planned | In-memory |
| `/api/system/status` | Verified | Derived from graph/DEM/scenario state |
| COP `system` block | Partial | `weather_mode` is real (AVAILABLE/STALE/UNAVAILABLE/CONTROLLED_SCENARIO); `status`/`backend_health` static |
| Deterministic offline tests | Verified | `tests/conftest.py`, `tests/test_test_isolation.py` |
| Authentication / authorization | Planned | None; CORS `*` |

### Layer B — Threat domain

| Capability | Status | Evidence / notes |
|---|---|---|
| Threat CRUD, close, zone | Verified | `test_threat_domain.py` |
| Route exposure on full segment geometry | Verified | `test_threat_routing.py` |
| Threat geo-context: spatially related routes only | Verified | `test_threat_routing.py` |
| Single canonical threat representation | Partial | Threats and incidents share `incidents` via two services |
| Simulated observation → linked evidence + threat → route reassessment | Verified + browser-verified (input is **Mock/demo**) | `test_mission_workflow.py`; profiles are fixed simulation inputs |
| Threat confidence from evidence | Partial | Single-source rule only (≥ 0.5 → MEDIUM else LOW, never HIGH); no corroboration |

### Layer C — COP

| Capability | Status | Evidence / notes |
|---|---|---|
| Snapshot/summary contract, canonical evidence, ARCHIVED excluded, no legacy double count | Verified | `test_cop_contract.py`, `test_cop_evidence.py` |
| Frontend layers, toggles, counts, popups, stale/unavailable states | **Browser-verified** | See above |
| Decision chain, data-source strip, mission panel (rationale, trade-off, approve/reject, decision record) | **Browser-verified** | Derived from the persisted route record and COP only; see "Mission workflow and decision chain" |
| Demo/simulation labelling in COP | Verified + browser-verified | `is_demo`, `is_simulation`, SIMULATED badge |
| Legacy field evidence in COP | Planned | ADR-010 (deferred, documented) |

### Layer D — Geospatial context and routing

| Capability | Status | Evidence / notes |
|---|---|---|
| OSM graph loading, shortest path | Verified | `test_geo_context.py`, `test_persistence.py` |
| DEM sampling with explicit reasons; CRS guard | Verified | `test_geo_coverage.py` |
| Coverage enforcement (provisional 250 m), coverage manifest, route terrain coverage | Verified + browser-verified (error display) | `test_geo_coverage.py` |
| Threat-aware routing (CRITICAL hard block; HIGH ×3.0, MODERATE ×1.75, LOW ×1.25, 25 m buffer — **uncalibrated**; non-compounding overlaps; no-safe-route) | Verified | `test_threat_routing.py` (20 tests) |
| Weather outage = UNKNOWN (ADR-011) across segment, point, route, monitor, replacement, flood status, rainfall, forecast, COP and UI | Verified (backend), browser-verified (header, COP panel, route popup) | `test_weather_outage.py` (24 tests) |
| Monitored routes: threats drive status; manual invalidation sticky; no downgrade on incomplete data | Verified | `test_threat_routing.py`, `test_route_persistence.py`, `test_weather_outage.py` |
| Flood-safe routing / flood simulation | Partial | Runs; synthetic drainage (Mock/demo input); heuristic |
| Slope analysis, spatially varying weather, map matching | Planned | |

Former finding F1 (weather outage inflated hazard to terrain-only at full weight) is
**resolved** by ADR-011. Offline, a route now scores 0.4 × terrain with
`score_basis: PARTIAL`, `confidence: LIMITED` and an upper bound.

### Layer E — Evidence and intelligence

| Capability | Status | Evidence / notes |
|---|---|---|
| Canonical evidence CRUD, threat association, archive | Verified | `test_evidence_domain.py` |
| Legacy field evidence upload | Unverified | In-memory; not migrated (ADR-010) |
| "AI" evidence analysis | **Mock/demo** | Filename keywords + random confidence; now reports `analysis_method: FILENAME_KEYWORD_MOCK`, `is_mock: true` |
| Drone/satellite/sensor ingestion, CV models, fusion, assessment engine | Planned | |

### External providers

| Provider | Status |
|---|---|
| Open-Meteo | Unverified at runtime (tests and browser run were offline by design); parsing and staleness verified against fake responses |
| NASA GIBS tiles | Unverified (URL templates only) |
| OpenStreetMap tiles (browser) | Loaded in the browser check |
| IMD | Blocked (credentials/authorisation) |
| MOSDAC, FIRMS | Mock/demo stubs |
| SMS / email | Mock/demo provider |

## API contract changes (Phase 4B)

First pass:

| Endpoint | Change | Migration |
|---|---|---|
| `GET /api/cop` | `evidence[]` now canonical: `threat_id`, `source_type`, `observation_type`, `confidence` (float 0–1), `status`, `is_simulation`, `provenance` (object). Removed `incident_id`, `type`, `human_confirmation`. Added `summary`, `monitored_routes[].geometry`, `threats[].source/is_demo`, `field_units[].is_demo` | No in-repo consumer used the old evidence fields |
| `GET /api/cop/summary` | `total_evidence_count` → `active_evidence_count`; new `invalidated_route_count`; `active_unit_count` excludes COMPLETED/UNAVAILABLE | Frontend reads `snapshot.summary` |
| `GET /api/route` | `avoid_threats=true` by default; adds `route_mode`, `threat_exposure`, `coverage`; may return `status: "no_safe_route"` (200); 422 `OUTSIDE_COVERAGE` | Pass `avoid_threats=false` for previous behaviour (coverage check still applies) |
| Hazard-aware routing | CRITICAL hazard segments are hard-blocked (previously infinite cost but still traversable) | — |
| `GET /api/geo/snap`, `/route-context`, `/api/route/flood-safe` | 422 outside coverage; route-context 409 on no-safe-route | — |
| `GET /api/geo/point` | Nearest-node fields null beyond 250 m; adds `road_coverage_status`, `terrain_reason` | — |
| `POST /api/route-monitor/{id}/invalidate` | Optional body `{reason, actor, obstruction{lat, lon, radius_m, simulated}}`; persisted transition; no longer writes a fabricated score (92/CRITICAL) | Frontend sends a labelled simulated obstruction |
| Replacement endpoints | Recommendations persisted; `candidate_route` adds `coordinates`, `threat_exposure` | — |
| Terrain responses | Unavailable results carry `reason` | — |

Second pass:

| Endpoint / field | Change |
|---|---|
| Segment and point hazard `risk` | `score` may be `null` (nothing known); adds `score_upper_bound`, `level_range`, `completeness`, `score_basis`, `confidence`, `data_gaps`; `level` may be `UNKNOWN` |
| Hazard-aware `hazard_summary`, monitor summaries | Add `score_basis`, `confidence`, `score_upper_bound`, `data_completeness`, `weather` |
| `/api/route-monitor/{id}/check` | Adds `weather_state`, `confidence`, `data_completeness`, `status_retained_incomplete_data` |
| Replacement recommend | Adds `candidate_route.hazard_score_upper_bound`, `score_basis`, top-level `data_completeness` |
| `/api/flood/status` | Returns `weather_unknown` or `below_model_range` instead of simulating at a 20 mm/h floor |
| `/api/weather` (live) | Adds `observed_at_utc`, `fetched_at_utc` |
| `/api/weather/forecast` | Missing hourly values are `null`; adds `missing_hourly_values_6h`, `data_complete_6h`; no longer pads with past hours |
| COP `system.weather_mode` | AVAILABLE / STALE / UNAVAILABLE / CONTROLLED_SCENARIO |

## Known debt (non-blocking)

Pydantic v1-style API under Pydantic 2.14 (warnings suppressed in `pytest.ini`);
naive `datetime.utcnow()`; Starlette warns `httpx` with `TestClient` is deprecated;
64 frontend lint warnings; `app/main.py` still holds legacy inline routes; legacy
scripts in `backend/test_*.py` are stale or need a live server; dashboard "LIVE
DISPATCHED TEAMS" shows every unit targeting the selected incident (pre-existing UI).
