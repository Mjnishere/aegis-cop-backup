# AEGIS — Geospatial Data Register and Validation

Datasets are governed dependencies. Every value below marked *measured* was read
directly from the local files on 2026-10-09; re-measure after replacing any dataset.

## 1. Dataset register

### 1.1 CartoDEM V3 R1, tile D43D — terrain

| Field | Value |
|---|---|
| Source / acquisition | NRSC Bhuvan Open Earth Data portal (bhuvan-noeda.nrsc.gov.in), manual download after registration |
| Licence | NRSC single-user, non-exclusive, non-transferable. §2(i) excludes Internet-based hosting; §2(vi) allows only 1K×1K visualisations online with no download of the original. Citation required. |
| Redistribution | **Not permitted.** Never tracked in this repository (`.gitignore`: `data/terrain/*`); see §4. |
| Local path | `data/terrain/cdnd43d_v3r1/cdnd43d.tif` (default `DEM_PATH`) |
| Extent (*measured*) | lon 74.99986–75.99986, lat 15.00014–16.00014 |
| Resolution / grid (*measured*) | 1 arc-second (0.000277…°), 3600 × 3600, int16, metres, 64×64 tiles, uncompressed |
| CRS | Geographic WGS 84 (`.prj` GCS_WGS_1984; GeoKeys geographic) |
| NoData (*measured*) | No NoData tag; value range 384–900 m, no negative or zero pixels |
| Surface type | Metadata topic category **Digital Surface Model** — includes buildings and canopy; not a bare-earth DTM |
| Date | Source imagery 2005–2014; metadata stamp 2015-05-04 |
| Vertical accuracy | Not stated in the bundled metadata. Integer metres → 1 m quantization |
| Intended use here | Point elevation, 9×9-pixel (~270 m) local-relative-elevation "susceptibility", elevation profile along routes |
| Known limitations | Does not cover lon < 75°E (see §2). DSM, not DTM. Thresholds (−5 m / +2 m) unvalidated |

### 1.2 OpenStreetMap drive network — routing graph

| Field | Value |
|---|---|
| Source / acquisition | OpenStreetMap via OSMnx 2.1.1 `graph_from_point((15.41, 75.06), dist=15000, network_type="drive")` (`scripts/download_osm_graph.py`) |
| Licence | ODbL 1.0 — redistribution permitted with attribution ("© OpenStreetMap contributors") and share-alike for derived databases |
| Local path | `data/osm/hubballi_dharwad_drive.graphml` (tracked, 26.9 MB) |
| Created | 2026-09-08 23:13 (graph attribute `created_date`) |
| Size (*measured*) | 25,471 nodes, 70,723 directed edges, simplified |
| Extent (*measured*) | lat 15.2754–15.5449, lon 74.9203–75.1998 |
| CRS | `epsg:4326` (graph attribute) |
| Travel times | Imputed by `ox.add_edge_speeds` / `add_edge_travel_times` from highway-type means; unvalidated |
| Known limitations | Static snapshot; no turn restrictions beyond OSM topology; no closures |

### 1.3 Weather — Open-Meteo

| Field | Value |
|---|---|
| Access | `https://api.open-meteo.com/v1/forecast`, no key; free for non-commercial use (check terms before any commercial use) |
| Spatial model | **One point** (`WEATHER_LAT`/`WEATHER_LON`, default 15.3647, 75.1240). Every road segment receives the same weather value |
| Caching | 60 s current, 120 s forecast, in process |
| Failure mode | `assess_weather()` → UNAVAILABLE (no response / null precipitation) or STALE (> `WEATHER_MAX_AGE_MINUTES`, default 90, or no observation time). Weather is then UNKNOWN: hazard scores keep terrain at its 40% weight, report an upper bound, `completeness` 0.4 and `confidence: LIMITED` (ADR-011) |

### 1.4 Drainage network — synthetic

`services/flood/drainage_service.py` builds an 11 × 9 grid (lat 15.32–15.42, lon
75.06–75.14, 0.01° spacing) with invented capacities. Labelled
`SYNTHETIC/PROTOTYPE` in API output. It does not reach Dharwad (lat ≈ 15.45–15.49).
If the DEM is missing it substitutes an invented elevation formula
(`drainage_service.py:32`).

### 1.5 Other providers

| Provider | Use | Status |
|---|---|---|
| NASA GIBS (WMTS tiles) | Satellite basemap overlays | URL templates only; no key |
| IMD (mausam.imd.gov.in) | National weather/warnings | Disabled unless `IMD_API_KEY` or `IMD_ACCESS_AUTHORIZED=true` |
| MOSDAC | Satellite products | Stub; returns `None` if a key is set (bug) |
| NASA FIRMS | Fire detections | Stub; always empty |
| Nominatim (frontend) | Place search in `Map.jsx` | Public OSM service; usage policy limits apply; query suffixed with "Hubballi Dharwad Karnataka" |

## 2. Coverage facts (measured)

| Fact | Value |
|---|---|
| Graph nodes west of the DEM edge (lon < 74.99986) | 3,221 of 25,471 (**12.6%**), western Dharwad |
| Graph nodes within 4 px of the DEM west edge (truncated 9×9 window) | 63 |
| Elevation range at graph nodes inside the DEM | 495–687 m |
| Demo point "Hubballi centre" (15.3647, 75.1240) | 546 m |
| Demo point "Dharwad Central" (15.4589, 75.0078) | 651 m, ~28 px inside the DEM edge |
| Synthetic drainage grid vs graph | Grid covers lat ≤ 15.42; graph extends to 15.545 |

## 3. Region-specific assumptions in code

`config/settings.py` (default data paths), `routing_service.py` (region string),
`cop/cop_service.py` + `cop/models.py` (map centre/zoom), `terrain_service.py` and
`road_hazard_service.py` (DEM source label "D43D"), `weather_service.py` (weather point,
recommendation text naming Hubballi streets), `threat/models.py` (default
state/district/city), `incidents/incident_service.py` (demo incidents),
`flood/drainage_service.py` (grid), `field_operations/field_service.py`,
`resources/resource_service.py`, `citizens/citizen_service.py` (demo seed data),
`frontend/src/components/Map.jsx` (geocoder suffix), `NationalView.jsx` (fallback regions).

## 4. Licence and distribution status

- This repository was created from a sanitized tree with fresh history: it contains
  no CartoDEM originals, archives or raster derivatives (`.gitignore`: `data/terrain/*`).
- An earlier repository of this project distributed the DEM originals. Remediation of
  that repository is the owner's responsibility and is tracked outside this codebase.
- The NRSC licence is single-user and excludes Internet hosting. Each developer must
  download the tile under their own NRSC registration (`data/terrain/README.md`).
  The registrant of the tile used during development could not be established from
  the bundled metadata.

## 5. Validation status

| Item | Status |
|---|---|
| Terrain susceptibility vs. observed waterlogging | **Not validated** (no ground truth in repo) |
| Hazard weights (0.6/0.4, 0.7/0.3) and thresholds (25/50/75) | **Uncalibrated** |
| Flood depth estimates | **Not validated**; self-described "not a validated hydrodynamic prediction" |
| Imputed travel times | **Not validated** |
| Regional portability | **Not tested** on any other region |

## 6. Validation plan (future)

1. Collect geolocated historical waterlogging/closure reports for Hubballi-Dharwad.
2. Measure hit rate / false-alarm rate of terrain susceptibility at those points.
3. Compare CartoDEM DSM with a bare-earth source where available.
4. Re-run with a second region's graph + DEM before any portability claim.
