# AEGIS — Project Brief

## Vision

AEGIS is intended to become a geospatial disaster-response intelligence and
operational decision-support platform. It should bring together geographic and
environmental context, threat and incident management, field units and monitored
routes, a unified Common Operating Picture (COP), evidence from heterogeneous
sources, traceable threat assessments, and hazard-aware route analysis.

The vision describes direction, **not** current capability. What exists today is
recorded in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Current scope

- **Hazard:** urban flooding (rainfall, terrain depressions, synthetic drainage).
- **Region:** Hubballi-Dharwad, Karnataka, India. No other region has data or tests.
- **Maturity:** research/demo **prototype**. Not validated, not operationally approved,
  not suitable for real emergency decisions.
- **Users (intended):** municipal Emergency Operations Centre (EOC) operators.
- **Origin:** built as *ResilienceRoute* for SIH problem statement SIH26085 (urban
  flood nowcasting); extended in phases 1A–4A (Oct 2026) as *AEGIS-COP*.

## Maturity levels (used throughout these docs)

| Level | Meaning |
|---|---|
| Prototype | Runs on local demo data; behaviour is heuristic and unvalidated |
| Validated research capability | Evaluated against ground truth with recorded metrics |
| Operationally approved | Validated, reliability-tested and approved by the responsible authority |

Everything in AEGIS is currently at **prototype** level.

## Non-goals for the current phase

- New infrastructure (PostGIS, CesiumJS, message buses, microservices, vector DBs)
  without a demonstrated requirement.
- AI/CV and multimodal fusion before evidence contracts, tests and validation
  requirements exist.
- Multi-region support before geographic coverage is explicit and enforced.

## Terminology

| Term | Meaning in this codebase |
|---|---|
| Threat | A located hazard event with severity, radius and lifecycle. Stored as a row in the `incidents` table (`IncidentModel`); `threat_id == incident_id`. |
| Incident | The EOC case-management view of the same row (response plans, alerts, timeline). |
| Threat zone | Circle (centre + `radius_m`) derived from an active threat. |
| COP | `GET /api/cop`: one snapshot of threats, field units, monitored routes and evidence. |
| Evidence (canonical) | Phase 4A record in the `evidence` table, `/api/evidence`. |
| Evidence (legacy) | In-memory field-operations uploads with **mock** keyword "analysis" (`services/field_operations/`). |
| Monitored route | A saved route reassessed for hazard; status `ACTIVE` / `AT_RISK` / `INVALIDATED`. |
| Scenario mode | Operator-toggled controlled rainfall that replaces live weather; always labelled. |
| Hazard score | 0–100 heuristic. **Not a probability and not calibrated.** |

## Related documents

- [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS_AND_ROADMAP.md](DECISIONS_AND_ROADMAP.md),
  [GEO_DATA_AND_VALIDATION.md](GEO_DATA_AND_VALIDATION.md)
- Historical (pre-AEGIS, partly stale): `docs/archive/` (`FINAL_SYSTEM_AUDIT.md`,
  `JUDGE_DEMO_RUNBOOK.md`, `phase5b_report.md`, `phase5c_report.md`)
