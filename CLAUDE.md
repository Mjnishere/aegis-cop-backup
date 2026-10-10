# AEGIS-COP — guidance for Claude Code

AEGIS is a geospatial disaster-response decision-support prototype. The current
codebase (historically "ResilienceRoute") is a **flood-response prototype for
Hubballi-Dharwad, India**: FastAPI + SQLite backend, React + Leaflet frontend,
OSMnx/NetworkX routing, CartoDEM terrain.

Read before significant work:
- `docs/project/PROJECT_BRIEF.md` — vision, scope, terminology
- `docs/project/ARCHITECTURE.md` — layers A–E, module map, boundaries
- `docs/project/IMPLEMENTATION_STATUS.md` — what is verified vs. unverified vs. mock
- `docs/project/DECISIONS_AND_ROADMAP.md` — ADRs and phase plan
- `docs/project/GEO_DATA_AND_VALIDATION.md` — dataset register, licences, coverage
- `docs/DEMO.md` — deterministic offline demo runbook (start, seed, script, fallbacks)

## Non-negotiable rules

- **Never commit restricted data.** `data/terrain/*` (NRSC CartoDEM originals) is
  gitignored; the licence forbids Internet hosting. Do not `git add -f` it.
- **Never commit, push, rewrite history or change repo visibility unless the user
  explicitly asks.**
- **Tests must not touch `data/aegis.db` or the network.** Use the pytest setup
  below; it redirects `DATABASE_PATH` to a temp dir and blocks sockets.
- **Never run `pytest` on `backend/` root or the repo root**, and never run the scripts
  in `backend/legacy_checks/` (e.g. `test_phase5b.py`, `test_phase5c.py`, `e2e_test.py`,
  `test_operational_fixes.py`) or `scripts/legacy_checks/test_hazard.py`: they execute
  HTTP calls against `127.0.0.1:8000` and can mutate a running server's DB.
- Do not describe heuristic scores as calibrated risk, mock CV as AI, or
  Hubballi-only behaviour as regional portability. Status labels are defined in
  `docs/project/IMPLEMENTATION_STATUS.md`; update that file when status changes.
- Simulated/demo data must stay labelled. Missing coordinates or coverage must not
  be fabricated.

## Environment

- Python 3.10-compatible dependency baseline, venv at repo root `.venv/` (gitignored). Node 20.19+.
- Backend deps: `backend/requirements.txt` (top level), `backend/requirements-dev.txt`
  (tests), `backend/requirements.lock.txt` (direct dependency constraints).
- Frontend deps: `frontend/package-lock.json`; use `npm ci`, never `npm install`
  / `npm update` / `npm audit fix` (they rewrite the lock).

```bash
# from repo root
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt -c backend/requirements.lock.txt

# from frontend/
npm ci --ignore-scripts --no-audit --no-fund
npm run lint && npm run build
```

Local data (not in git): `data/osm/hubballi_dharwad_drive.graphml` (tracked, ODbL)
and `data/terrain/cdnd43d_v3r1/cdnd43d.tif` (untracked, see `data/terrain/README.md`).
Override with `OSM_GRAPH_PATH`, `DEM_PATH`, `DATABASE_PATH`.

## Running

```bash
# backend tests (from backend/) — offline, temp SQLite, deterministic
../.venv/bin/python -m pytest

# backend server (from backend/)
../.venv/bin/python -m uvicorn app.main:app --port 8000

# frontend dev server (from frontend/)
npm run dev
```

Tests needing the OSM graph or DEM are marked `requires_graph` / `requires_dem` and
skip with a reason when the files are absent. Mark tests that genuinely need the
internet with `@pytest.mark.network` (off by default; enable with `--run-network`).

## Code conventions

- Domain logic lives in `backend/app/services/<domain>/`; HTTP handlers in
  `backend/app/routes/`. Do not add new inline routes to `app/main.py` or reach
  into another service's private attributes.
- Persistence goes through `backend/app/repositories/`. Schema changes must also
  migrate existing SQLite files (`app/database/connection.py:init_db`), not only
  fresh ones.
- Services are module-level singletons; tests reset them via fixtures in
  `backend/tests/conftest.py`.
- Pydantic is v2 at runtime but the code uses v1-style `.dict()`/`@validator`;
  match the surrounding style, don't mass-migrate.
- All coordinates are EPSG:4326 lon/lat; GeoJSON order is `[lon, lat]`.
- Threat-routing penalties, buffer and blocking severities live only in
  `backend/app/config/routing_policy.py` (uncalibrated; keep them labelled as such).
- Coverage: inputs beyond `MAX_SNAP_DISTANCE_M` (default 250 m) are rejected with
  `OUTSIDE_COVERAGE`; terrain "unavailable" results carry a `reason` code. Don't add
  code paths that snap or sample without these checks.
- Missing or stale weather is UNKNOWN (ADR-011): never treat it as 0 mm or as maximum
  hazard. Combine hazard components with `app/services/hazard_scoring.combine` and keep
  `score`, `score_upper_bound`, `completeness` and `confidence` separate.
- Tests that depend on hazard levels must pin weather (e.g. a 0 mm controlled scenario
  or a fake Open-Meteo response); default tests run with weather UNAVAILABLE.
- `RoutingService.load_graph()` must stay thread-safe (lock + publish when complete);
  endpoints run in a thread pool and the graph costs ~600 MB per copy.
