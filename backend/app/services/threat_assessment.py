
"""Explainable potential-threat triage for AEGIS-COP.

Scores review priority, NOT probabilities of hostile intent.
Context indicators are unverified unless supplied by trusted integrations.
"""

from typing import Any

VESSEL_LABELS = {
    "boat",
    "ship",
    "vessel",
    "motorboat",
    "sailboat",
}


def assess_potential_threat(
    detections_by_class: dict[str, int],
    *,
    restricted_zone_entry: bool = False,
    ais_status: str = "unknown",
    unusual_behavior_observed: bool = False,
    near_protected_asset: bool = False,
) -> dict[str, Any]:
    """Return an explainable review-priority assessment."""

    if ais_status not in {"unknown", "matched", "missing", "mismatch"}:
        ais_status = "unknown"

    vessel_count = sum(
        max(0, int(count))
        for label, count in detections_by_class.items()
        if str(label).strip().lower() in VESSEL_LABELS
    )

    score = 0
    indicators: list[dict[str, Any]] = []

    if vessel_count > 0:
        indicators.append({
            "code": "VESSEL_VISUAL_DETECTION",
            "points": 0,
            "evidence": (
                f"The vision pipeline reported {vessel_count} "
                "unique or untracked vessel observations. "
                "Visual classification has not been independently verified."
            ),
            "source": "computer_vision",
            "status": "unverified",
        })

    if restricted_zone_entry:
        score += 40
        indicators.append({
            "code": "RESTRICTED_ZONE_ENTRY",
            "points": 40,
            "evidence": (
                "Restricted-zone entry was reported. Verify the "
                "geospatial boundary, location, and timestamp."
            ),
            "source": "operator_or_geospatial_adapter",
            "status": "reported",
        })

    if ais_status == "mismatch":
        score += 25
        indicators.append({
            "code": "AIS_IDENTITY_MISMATCH",
            "points": 25,
            "evidence": (
                "An AIS identity or position mismatch was reported. "
                "Verify against a trusted AIS source and timestamps."
            ),
            "source": "AIS_context",
            "status": "reported",
        })
    elif ais_status == "missing":
        score += 12
        indicators.append({
            "code": "AIS_SIGNAL_MISSING",
            "points": 12,
            "evidence": (
                "No AIS match was reported. Missing AIS alone "
                "does not establish hostile intent."
            ),
            "source": "AIS_context",
            "status": "reported",
        })

    if unusual_behavior_observed:
        score += 20
        indicators.append({
            "code": "UNUSUAL_BEHAVIOR",
            "points": 20,
            "evidence": (
                "Unusual behavior was reported. Review the supporting "
                "footage; this is not an automatically verified finding."
            ),
            "source": "operator_or_behavior_model",
            "status": "reported",
        })

    if near_protected_asset:
        score += 15
        indicators.append({
            "code": "PROXIMITY_TO_PROTECTED_ASSET",
            "points": 15,
            "evidence": (
                "Proximity to a protected asset was reported. "
                "Verify coordinates and the relevant geospatial data."
            ),
            "source": "operator_or_geospatial_adapter",
            "status": "reported",
        })

    # Never infer a threat from generic object detections alone.
    if vessel_count == 0:
        level = (
            "CONTEXT_REVIEW_REQUIRED"
            if score > 0
            else "INSUFFICIENT_VISUAL_EVIDENCE"
        )
    elif score >= 60:
        level = "HIGH_PRIORITY_REVIEW"
    elif score >= 30:
        level = "ELEVATED_REVIEW"
    elif score > 0:
        level = "REVIEW"
    else:
        level = "NO_RULE_TRIGGERED"

    return {
        "assessment_type": "EXPLAINABLE_RULE_BASED_TRIAGE",
        "level": level,
        "score": min(score, 100),
        "score_max": 100,
        "score_is_probability": False,
        "vessel_detections": vessel_count,
        "indicators": indicators,
        "ais_status": ais_status,
        "human_review_required": True,
        "limitations": [
            "Scores are configurable review-priority rules, not calibrated probabilities.",
            "Generic object detections can be false positives.",
            "AIS and contextual indicators are unverified unless connected to trusted sources.",
            "Visual object detection alone cannot establish hostile intent.",
        ],
    }
