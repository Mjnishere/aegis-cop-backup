# AEGIS — Architecture

Target shape: a **modular monolith** (one FastAPI process, one SQLite database, one
React app) with explicit domain boundaries. This file maps the intended layers to the
code that exists today. Status labels follow
[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Conceptual data flow

```
Data sources ─► ingestion + provenance ─► normalized domain records ─► threat assessment
            ─► geospatial impact analysis ─► COP APIs ─► operator visualization
```

Routing consumes the road graph, supported geographic context, active threats and an
explicit routing policy, and returns a route **with** status, coverage, exposure and
limitations. The COP is a read model over canonical persisted records; it is not a
data store of its own.

## Layer A — Foundation and persistence

| Concern | Current code |
|---|---|
| Configuration | `backend/app/config/settings.py` (`DEM_PATH`, `OSM_GRAPH_PATH`, `DATABASE_PATH`, `DEMO_MODE`); provider keys read ad hoc via `os.environ` in services |
| App / routing | `backend/app/main.py` (app, routers, **plus legacy inline routes** for route, flood, scenario, route-monitor) |
| DB | `backend/app/database/connection.py` (SQLite engine, `init_db()` = `create_all` + additive `ALTER TABLE`s). No migration framework |
| Models | `backend/app/models/` — `IncidentModel` (threats/incidents), `FieldUnitModel`, `MonitoredRouteModel`, `EvidenceModel` |
| Repositories | `backend/app/repositories/` — dict-in/dict-out wrappers per model |
| Health | `/api/health`; `/api/system/status` returns partly hard-coded values (known issue) |

Still process-memory only: resources, alerts, citizens, legacy evidence and field
reports, audit logs, scenario state.

## Layer B — Threat domain

- `services/threat/threat_service.py`, `services/threat/models.py`, `routes/threats.py`
  (`/api/threats`): create, update, close, zone, route exposure, geo-context.
- Shares the `incidents` table with `services/incidents/incident_service.py`
  (`/api/national/incidents`). Two services, one store, two dict shapes — a known
  duplication to converge, not to extend.
- Severity → `risk_score` mapping is hard-coded in `create_threat`.

## Layer C — Common Operating Picture

- Backend: `services/cop/cop_service.py`, `services/cop/models.py`, `routes/cop.py`
  (`/api/cop`, `/api/cop/summary`).
- Frontend: `frontend/src/api/cop.js` → `hooks/useCOP.js` (10 s polling) →
  `components/COPLayers.jsx` (threats, field units, monitored routes, evidence +
  layer panel with backend summary counts) inside `components/Map.jsx`;
  `components/ThreatPanel.jsx`, `components/EocDashboard.jsx`.
- Other dashboard panels still fetch `/api/national/*` directly; those are not COP.

## Layer D — Geospatial context and routing

| Concern | Current code |
|---|---|
| Road graph | `services/routing_service.py` (lazy `ox.load_graphml`, imputed speeds/travel times) |
| Shortest path | NetworkX Dijkstra on `travel_time`; hazard-aware weight function in `routing_service.calculate_route` |
| Terrain | `services/terrain_service.py` (rasterio point/window sampling, "local relative elevation" susceptibility) |
| Segment hazard | `services/road_hazard_service.py` (0.6 weather + 0.4 terrain per edge) |
| Score combination | `services/hazard_scoring.py` (unknown components: no re-weighting; score, upper bound, completeness, confidence) |
| Weather assessment | `WeatherAdapter.assess_weather()` → AVAILABLE / STALE / UNAVAILABLE |
| Flood model | `services/flood/*` (synthetic drainage grid, inundation heuristic), `services/flood_routing_service.py` |
| Weather | `services/weather_service.py` (Open-Meteo, single point), `weather_adapter.py`, `scenario_service.py` |
| Monitoring | `services/route_monitor_service.py`, `services/route_replacement_service.py` |
| Geo context API | `services/geo/geo_context_service.py`, `routes/geo.py` (`/api/geo/*`) |
| Threat zones | `services/threat/zones.py` (zone geometry, segment distance), policy in `config/routing_policy.py` |
| Threat-aware routing | `RoutingService.calculate_route(avoid_threats=True)`; `NoSafeRouteError`, `OutsideCoverageError` |
| Coverage | `RoutingService.snap` (250 m limit), `TerrainService` reason codes + CRS guard, `GeoContextService.get_coverage_manifest` (`/api/geo/coverage`) |
| Replacement decisions | `models/route_recommendation.py`, `repositories/route_recommendation_repository.py` |

Not present: slope, CRS transformation (non-4326 DEMs are refused), map matching,
spatially varying weather.

## Layer E — Evidence and intelligence (mostly planned)

- Canonical evidence store: `services/evidence/*`, `repositories/evidence_repository.py`,
  `routes/evidence.py` (`/api/evidence`). Accepts `DRONE`, `SATELLITE`, `SENSOR`,
  `HUMAN_REPORT`, `SYSTEM_GENERATED`, `SIMULATION`; links to threats.
- Legacy field evidence: `services/field_operations/evidence_service.py` (in-memory) and
  `evidence_analysis_service.py` — **mock** analysis (filename keywords + random
  confidence). Must never be presented as AI inference.
- No ingestion pipelines, no CV models, no fusion, no assessment engine.

## Boundary rules

1. HTTP handlers validate and translate; domain services decide; repositories persist.
2. A service must not mutate another service's private state (`_monitored_routes`,
   `_recommendations`, …). Add a public method instead.
3. One canonical store per entity. The COP reads canonical stores only.
4. Coverage, CRS and data availability are explicit outputs, never silent fallbacks.
5. External providers are configurable, disableable, and absent from default tests.
6. New infrastructure requires a recorded decision in
   [DECISIONS_AND_ROADMAP.md](DECISIONS_AND_ROADMAP.md).

## Known structural debt

- `app/main.py` mixes app wiring with ~20 inline legacy routes.
- `init_db()` runs at import of `app/database/connection.py` and again in `main.py`.
- Service singletons are constructed at import and some seed demo data into the DB
  (`FieldService` seeds four demo units when the table is empty).
- Two evidence stores (COP reads only the canonical one); two services over the
  threat/incident table.
- CORS allows `*` with credentials; there is no authentication.
