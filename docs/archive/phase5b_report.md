# ResilienceRoute Phase 5B — Implementation Report

## Overview
Phase 5B of the ResilienceRoute system introduces a full modular flood-intelligence layer that models the interaction between rainfall, surface runoff, terrain, and drainage capacity to calculate estimated flood risk and depths on the road network over a 3-hour forecast horizon.

## 1. Files Created
* `backend/app/services/flood/__init__.py`
* `backend/app/services/flood/rainfall_service.py`
* `backend/app/services/flood/runoff_service.py`
* `backend/app/services/flood/drainage_service.py`
* `backend/app/services/flood/inundation_service.py`
* `backend/app/services/flood/flood_forecast_service.py`
* `backend/test_phase5b.py`

## 2. Files Modified
* `backend/app/main.py` (Added `/api/flood/status` and `/api/flood/simulate` endpoints)
* `backend/app/services/terrain_service.py` (Added `get_terrain_susceptibility_batch` using a single rasterio load)
* `frontend/src/App.jsx` (Added Flood Nowcast simulation panel)
* `frontend/src/components/Map.jsx` (Added map overlay rendering for flood risk)

## 3. APIs Added
* `GET /api/flood/status` - Returns the baseline flood status over the next 30 minutes based on live open-meteo rainfall.
* `POST /api/flood/simulate` - Runs a custom user-defined scenario (rainfall: 20-100 mm/hr, blockage: 0-75%) over a 0-3 hour forecast (180 minutes).

## 4. Flood Model Equations
* **Runoff**: `runoff_mm_hr = rainfall_mm_hr * 0.85` (Using an urban coefficient)
* **Drainage Inflow**: `local_inflow_lps = runoff_mm_hr * cell_area_m2 / 3600.0`
* **Drainage Effective Capacity**: `effective_capacity = base_capacity * (1 - blockage_percent / 100.0)`
* **Overflow**: `overflow = max(0.0, total_inflow - effective_capacity)`
* **Utilization**: `utilization = total_inflow / effective_capacity`
* **Flood Score (0-100)**: `0.25 * rainfall_factor + 0.30 * terrain_susceptibility + 0.45 * drainage_utilization`
* **Estimated Depth**: `depth_cm = overflow_mm_hr * duration_hr * (1.0 + terrain_susceptibility / 100.0) * 0.70 / 10.0`

## 5. Subsystems Overview
* **Drainage Model**: Built a NetworkX DiGraph grid for Hubballi-Dharwad. Nodes are placed evenly and connected downhill. Overflow cascades topologically through the synthetic network.
* **Terrain Integration**: Optimized with batched point queries using `rasterio` and pre-built raster transforms. Evaluates relative low-lying areas.
* **Road Integration**: Associates the OSM road network with the drainage model via proximity mapping, optimized via batched spatial coordinate matching (`ox.distance.nearest_edges`).
* **Forecast Methodology**: Steps through 0, 30, 60, 90, 120, 150, 180 minutes accumulating overflow and deepening estimated water levels.

## 6. Frontend Changes
* Added a comprehensive side-panel for configuring rainfall intensity and blockage scenarios.
* Displays a timeline forecast switcher (`NOW` to `+3h`).
* Updates an active map overlay dynamically displaying Polyline road segments colored by flood risk (SAFE: Green, LOW: Yellow, MODERATE: Orange, HIGH: Dark Orange, CRITICAL: Red).

## 7. Testing Results
* `test_phase5b.py` was executed and successfully verified all required regression and simulation tests.
* **Passed: 7/7**
* Handled invalid API inputs cleanly with HTTP 400 errors.
* `npm run build` executed successfully without compilation or CSS errors.

## 8. SIH Demonstration Status
**SUCCESS:** The implementation fully realizes and demonstrates the required SIH flow:
**Rainfall → Surface Runoff → Terrain / Flow Accumulation → Drainage Network → Drainage Capacity / Blockage → Water Accumulation → Road Flood Risk / Estimated Depth → 0–3 Hour Flood Nowcast**

## 9. Known Limitations
* The drainage network is purely synthetic and topology-driven; it is NOT real municipal infrastructure data.
* Estimated water depth is a localized prototype extrapolation, not a validated hydrodynamic model (e.g. SWMM).
* Runoff coefficient is statically applied across all nodes instead of being derived from real land-use categorization (LULC).

## 10. Recommendations for Phase 5C
* Integrate real SWMM network data or shapefiles if available.
* Connect the generated `flood_score` natively into the `routing_service` algorithm's weight/cost function as an avoidance penalty to enable dynamic safe rerouting.
