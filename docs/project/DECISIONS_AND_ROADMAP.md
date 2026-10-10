# AEGIS — Decisions and Roadmap

## Architecture decision records

Format: decision · rationale · trade-offs · status. Changing a decision requires a
new entry that supersedes the old one.

### ADR-001 Modular monolith on the existing stack
FastAPI, Pydantic, SQLAlchemy/SQLite, OSMnx/NetworkX, rasterio, React, Leaflet.
**Why:** working, tested foundation; the problems are consistency and correctness,
not scale. **Trade-off:** SQLite limits concurrent writers and has no spatial index;
acceptable for a single-site prototype. **Status:** accepted.

### ADR-002 No new infrastructure without a demonstrated requirement
PostGIS, CesiumJS, LiDAR pipelines, message buses, microservices and vector DBs are
deferred. The `RoutingMapPrecision.pdf` proposal (not in the repository) is evaluated
piecemeal: slope from the existing DEM comes first; a 3D client or spatial DB only
when a concrete requirement exceeds Leaflet/SQLite. **Status:** accepted.

### ADR-003 Restricted datasets are never committed
NRSC CartoDEM originals are gitignored and documented in `data/terrain/README.md`.
Data paths are configurable (`DEM_PATH`, `OSM_GRAPH_PATH`). Tests skip with an
explicit reason when data is absent. **Trade-off:** a fresh clone needs a manual
download. This repository's history never contained them (fresh history from a sanitized tree). **Status:** accepted;
working-tree change made 2026-10-09, not yet committed.

### ADR-004 Reproducible environments
`requirements.txt` (top level, osmnx pinned to 2.1.1 to match the graph),
`requirements-dev.txt`, `requirements.lock.txt` (pip freeze, used as constraints);
frontend via `npm ci` from the committed lock. No framework major-version changes
during stabilisation. **Trade-off:** the original environment's versions are unknown;
the lock records versions resolved on 2026-10-09 and verified by the baseline.
**Status:** accepted.

### ADR-005 Deterministic, offline default tests
`backend/pytest.ini` restricts collection to `tests/`; `tests/conftest.py` sets a temp
`DATABASE_PATH`, blocks sockets, disables providers, resets singletons per module.
Network tests are opt-in (`network` marker + `--run-network`). Legacy scripts stay
outside the suite. **Status:** accepted, implemented.

### ADR-006 Canonical evidence store
The Phase 4A `evidence` table is canonical. The COP reads only canonical evidence;
`ARCHIVED` evidence is excluded from the active COP (records preserved). The legacy
in-memory field-evidence path is not shown in the COP until it writes through to the
canonical store with its mock analysis explicitly labelled. **Trade-off:** legacy
demo uploads temporarily disappear from the COP (the UI did not render them anyway).
**Status:** implemented 2026-10-09 (`cop_service.py`, `test_cop_evidence.py`).

### ADR-007 Threat zones in routing
Active threats with valid coordinates and radius form circular zones. Route exposure
uses full segment geometry. **CRITICAL** zones are hard blocks; if no path avoids
them the API returns an explicit no-safe-route result. HIGH/MODERATE/LOW zones add
configurable travel-time multipliers, labelled **uncalibrated**. With no active
threats, routes are unchanged (baseline regression test).

Details as implemented (`app/config/routing_policy.py`, `app/services/threat/zones.py`):
- Safety buffer 25 m; multipliers HIGH 3.0, MODERATE 1.75, LOW 1.25; unknown severities
  are treated as HIGH.
- A CRITICAL zone that contains the origin or destination cannot be avoided; its edges
  stay usable with a ×10 multiplier and the response lists it in `endpoint_zone_ids`
  (`effect: ENDPOINT_UNAVOIDABLE`) rather than failing silently.
- Hazard-aware CRITICAL segments are hard blocks too; NetworkX edges are skipped by
  returning `None`, never `inf` (which NetworkX would still traverse).
- Monitoring: a route crossing a CRITICAL zone becomes INVALIDATED, a HIGH zone
  AT_RISK. A route invalidated by an operator or a CRITICAL zone is replaced by any
  policy-compliant different route (no hazard-score comparison).
- Distances use a local equirectangular projection around each zone centre.
- Overlapping non-blocking zones on one edge do **not** compound: the strongest single
  multiplier applies (`zones.edge_multiplier`), so duplicate reports of one hazard are
  not double-counted. Every affected threat is still listed in `threat_exposure`.
- Parameters were confirmed by the owner on 2026-10-10 as provisional and
  **uncalibrated**; they are not empirically validated.

**Status:** implemented 2026-10-09; overlap rule and boundary tests added 2026-10-10
(`test_threat_routing.py`: segment crossings without a vertex inside, buffer
boundaries at radius+buffer ±0.5 m, overlapping zones, no feasible alternative).

### ADR-008 Explicit geographic coverage and CRS
Coverage is derived from the loaded data. Inputs farther than a provisional
**250 m** from the road graph are rejected with `OUTSIDE_COVERAGE` (prototype
default, not a validated threshold). Terrain distinguishes *outside DEM coverage*,
*NoData* and *DEM unavailable*. A DEM whose CRS is not EPSG:4326 is reported as
incompatible rather than sampled with lon/lat. `MAX_SNAP_DISTANCE_M` is configurable;
`/api/geo/point` reports limitations instead of rejecting. Coverage manifest:
`GET /api/geo/coverage`. **Status:** implemented 2026-10-09 (`test_geo_coverage.py`).
Reprojection of non-4326 DEMs is not implemented.

### ADR-009 Durable route state
Monitored-route status changes (including manual invalidation) and replacement
recommendations/decisions are persisted with actor, time and reason. A manual
invalidation is not cleared by later hazard reassessment; only an approved
replacement ends it. An operator may attach an obstruction location, which is stored
as a CRITICAL threat (`OPERATOR_REPORT`, or `CONTROLLED_DEMO` when flagged simulated).
Manual invalidation never writes hazard scores. Proposal-time audit events
(e.g. NO_BETTER_ROUTE) remain process-local. **Status:** implemented 2026-10-09
(`route_recommendations` table, `test_route_persistence.py`).

### ADR-010 Legacy field evidence stays separate (migration deferred)
The in-memory field-operations evidence path is **not** migrated into the canonical
store. A reliable mapping is not supported by the current code:
- the canonical `evidence.confidence` column is NOT NULL (default 1.0) and legacy
  records have no source confidence; the only candidate, `ai_confidence`, is a random
  number from the filename-keyword mock — mapping would fabricate confidence;
- legacy `file_path` is always the placeholder `/fake/storage/<name>`, so there is no
  media to reference;
- records live only in process memory, so nothing durable exists to migrate;
- no frontend code uses the legacy upload path.
Interim change: the mock analysis now reports `analysis_method:
FILENAME_KEYWORD_MOCK` and `is_mock: true`. Legacy records are not deleted.

Retirement plan: (1) make canonical confidence nullable via a tested table-rebuild
migration for existing SQLite files; (2) route field-app uploads to `/api/evidence`
with real media storage; (3) remove or clearly sandbox the mock analysis; (4) after
one release with no legacy traffic, remove `services/field_operations/evidence_*`.
**Status:** decided 2026-10-10 (`test_legacy_evidence.py`).

### ADR-011 Missing or stale weather is UNKNOWN
Weather is classified by `WeatherAdapter.assess_weather()` as AVAILABLE, STALE (older
than `WEATHER_MAX_AGE_MINUTES`, default 90, or without an observation time) or
UNAVAILABLE (no response or null precipitation). Only AVAILABLE weather contributes.
Unknown components are neither zero rain nor maximum hazard: hazard scores keep each
component's normal weight (`hazard_scoring.combine`) and report `score` (known
components, a lower bound), `score_upper_bound`, `level_range`, `completeness`,
`score_basis` and `confidence` separately. Consequences:
- routing cost uses the known score only (unknown neither penalised nor treated as safe);
- monitored routes are not downgraded on incomplete data (`status_retained_incomplete_data`);
- replacement compares a partial candidate on its upper bound;
- `/api/flood/status` runs no forecast without current weather and does not raise
  rainfall below the 20 mm/h model minimum to 20;
- forecast hourly values missing from the provider stay null (not 0);
- the same rule applies symmetrically when terrain is unknown (weather keeps its 60%).
Controlled scenarios count as AVAILABLE and stay labelled. **Status:** implemented
2026-10-10 (`test_weather_outage.py`).

## Roadmap

| Phase | Goal | Entry/exit criteria |
|---|---|---|
| **4B — Baseline & consolidation** (current) | Reproducible env, offline test suite, restricted data out of tree, COP evidence, full COP layers, route persistence, threat-aware routing, coverage/CRS | Backend criteria met with recorded tests; COP layers browser-verified 2026-10-10. Remaining: publication decision, NRSC registration |
| 4C — Geo correctness | Fill DEM gap west of 75°E (adjacent tile, own licence), drainage coverage flags, spatial weather if justified | Exit: route-level coverage ≥ documented target; coverage tests |
| 5 — Elevation-aware routing | Slope from DEM (projected metric computation), slope penalties, profile explanations | Entry: 4C complete. Exit: slope tests + documented limits (DSM, 30 m) |
| 6 — Evidence ingestion | Real ingestion contracts for imagery/sensor observations, provenance, write-through of field evidence | Entry: input/output contracts and storage plan agreed |
| 7 — Assessment, CV, fusion | Model-assisted detection and multimodal fusion with validation datasets | Entry: labelled validation data and evaluation protocol exist |

## Open questions (need owner decision)

1. **Publication.** When and where to publish this sanitized repository (owner action).
2. **NRSC registration.** Who holds it, and is team use covered?
3. **Legacy evidence retirement.** Approve the ADR-010 plan (nullable canonical
   confidence migration, then retire the legacy path).
4. **Weather staleness threshold.** `WEATHER_MAX_AGE_MINUTES=90` is provisional.
