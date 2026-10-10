
"""Video intelligence and explainable threat assessment for AEGIS-COP."""

from __future__ import annotations

import os
import time
import uuid
from collections import Counter
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.services.evidence import EvidenceCreate, evidence_service
from app.services.threat_assessment import assess_potential_threat

router = APIRouter(prefix="/api/vision", tags=["video intelligence"])

ROOT_DIR = Path(__file__).resolve().parents[3]
RUN_DIR = ROOT_DIR / "data" / "vision_runs"
MAX_UPLOAD_BYTES = 150 * 1024 * 1024

ALLOWED_SUFFIXES = {
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"
}

# Standard COCO class IDs used by yolov8n.pt.
# COCO ID 8 is boat. This is NOT a military-specific detector.
NAVAL_COCO_CLASSES = [8]


def _vision_dependencies():
    try:
        import cv2
        from ultralytics import YOLO
        return cv2, YOLO
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Video dependencies are missing. Install "
                "backend/requirements-vision.txt from the project root."
            ),
        ) from exc


@router.get("/status")
def vision_status():
    try:
        import cv2
        import ultralytics

        installed = True
        dependency_error = None
    except ImportError as exc:
        installed = False
        dependency_error = str(exc)

    return {
        "status": "ready" if installed else "dependencies_missing",
        "model": os.getenv("AEGIS_YOLO_MODEL", "yolov8n.pt"),
        "default_naval_class_filter": NAVAL_COCO_CLASSES,
        "note": (
            "Generic object detection only. Threat scores are review "
            "priorities and require human review."
        ),
        "dependency_error": dependency_error,
    }


@router.post("/analyze-video")
async def analyze_video(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    description: str = Form("Video observation submitted for review"),
    confidence_threshold: float = Form(0.40),
    sample_fps: float = Form(3.0),
    detection_mode: str = Form("naval"),
    restricted_zone_entry: bool = Form(False),
    ais_status: str = Form("unknown"),
    unusual_behavior_observed: bool = Form(False),
    near_protected_asset: bool = Form(False),
):
    if not file.filename:
        raise HTTPException(status_code=415, detail="A filename is required.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail="Supported formats: mp4, mov, avi, mkv, webm, m4v.",
        )

    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=422,
            detail="Provide both latitude and longitude, or neither.",
        )

    if latitude is not None and not -90 <= latitude <= 90:
        raise HTTPException(status_code=422, detail="Invalid latitude.")

    if longitude is not None and not -180 <= longitude <= 180:
        raise HTTPException(status_code=422, detail="Invalid longitude.")

    if not 0.05 <= confidence_threshold <= 0.95:
        raise HTTPException(
            status_code=422,
            detail="Confidence threshold must be between 0.05 and 0.95.",
        )

    if not 0.25 <= sample_fps <= 8:
        raise HTTPException(
            status_code=422,
            detail="Sampling rate must be between 0.25 and 8 FPS.",
        )

    if detection_mode not in {"naval", "general"}:
        raise HTTPException(
            status_code=422,
            detail="detection_mode must be 'naval' or 'general'.",
        )

    if ais_status not in {"unknown", "matched", "missing", "mismatch"}:
        raise HTTPException(status_code=422, detail="Invalid AIS status.")

    cv2, YOLO = _vision_dependencies()

    RUN_DIR.mkdir(parents=True, exist_ok=True)

    run_id = uuid.uuid4().hex
    input_path = RUN_DIR / f"{run_id}_input{suffix}"
    output_path = RUN_DIR / f"{run_id}_annotated.mp4"

    try:
        size = 0

        with input_path.open("wb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break

                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Video exceeds the 150 MB upload limit.",
                    )

                destination.write(chunk)

        if size == 0:
            raise HTTPException(status_code=400, detail="Uploaded video is empty.")

        capture = cv2.VideoCapture(str(input_path))
        if not capture.isOpened():
            capture.release()
            raise HTTPException(
                status_code=422,
                detail="Could not decode video. Try a standard H.264 MP4.",
            )

        source_fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        duration_seconds = frame_count / source_fps if source_fps > 0 else 0

        stride = max(1, round(source_fps / sample_fps))
        effective_fps = source_fps / stride

        writer = None
        frame_results = []
        frames_processed = 0
        frame_index = 0
        # Counts detections per sampled frame; useful for diagnostics only.
        frame_detection_counts = Counter()
        # Count unique tracked objects; untracked detections are kept separate.
        unique_tracks = set()
        untracked_counts = Counter()
        started = time.perf_counter()

        model_name = os.getenv("AEGIS_YOLO_MODEL", "yolov8n.pt")

        try:
            model = YOLO(model_name)

            while True:
                ok, frame = capture.read()
                if not ok:
                    break

                if frame_index % stride == 0:
                    track_options = {
                        "persist": True,
                        "conf": confidence_threshold,
                        "tracker": "bytetrack.yaml",
                        "verbose": False,
                    }

                    if detection_mode == "naval":
                        track_options["classes"] = NAVAL_COCO_CLASSES

                    result = model.track(frame, **track_options)[0]
                    annotated = result.plot()

                    if writer is None:
                        out_height, out_width = annotated.shape[:2]
                        writer = cv2.VideoWriter(
                            str(output_path),
                            cv2.VideoWriter_fourcc(*"mp4v"),
                            max(0.25, effective_fps),
                            (out_width, out_height),
                        )

                        if not writer.isOpened():
                            raise HTTPException(
                                status_code=500,
                                detail="Could not create annotated output video.",
                            )

                    writer.write(annotated)
                    detections = []
                    boxes = result.boxes

                    if boxes is not None:
                        names = result.names

                        for index in range(len(boxes)):
                            class_id = int(boxes.cls[index].item())
                            label = str(names.get(class_id, class_id)).lower()
                            confidence = float(boxes.conf[index].item())

                            track_id = None
                            if boxes.id is not None and index < len(boxes.id):
                                raw_id = boxes.id[index]
                                if raw_id is not None:
                                    track_id = int(raw_id.item())

                            frame_detection_counts[label] += 1

                            if track_id is not None:
                                # Include class in the key to avoid collisions.
                                unique_tracks.add((label, track_id))
                            else:
                                untracked_counts[label] += 1

                            detections.append({
                                "label": label,
                                "class_id": class_id,
                                "confidence": round(confidence, 4),
                                "track_id": track_id,
                            })

                    frame_results.append({
                        "frame": frame_index,
                        "timestamp_seconds": round(frame_index / source_fps, 2),
                        "detections": detections,
                    })

                    frames_processed += 1

                frame_index += 1

        finally:
            capture.release()
            if writer is not None:
                writer.release()

        if frames_processed == 0 or not output_path.exists():
            raise HTTPException(
                status_code=422,
                detail="No decodable frames were found in the video.",
            )

        elapsed = time.perf_counter() - started

        # One count per tracked object, plus detections with no track ID.
        unique_object_counts = Counter(label for label, _ in unique_tracks)
        unique_object_counts.update(untracked_counts)

        classes_seen = sorted(frame_detection_counts.keys())
        detection_total = sum(frame_detection_counts.values())

        threat_assessment = assess_potential_threat(
            dict(unique_object_counts),
            restricted_zone_entry=restricted_zone_entry,
            ais_status=ais_status,
            unusual_behavior_observed=unusual_behavior_observed,
            near_protected_asset=near_protected_asset,
        )

        evidence = evidence_service.create_evidence(
            EvidenceCreate(
                source_type="DRONE",
                source_id=f"VIDEO-{run_id[:8]}",
                observation_type="VIDEO_OBJECT_DETECTION",
                latitude=latitude,
                longitude=longitude,
                confidence=max(
                    (
                        detection["confidence"]
                        for frame in frame_results
                        for detection in frame["detections"]
                    ),
                    default=0.0,
                ),
                provenance={
                    "origin": "uploaded_video",
                    "source_system": "AEGIS-COP_VIDEO_INTELLIGENCE",
                    "is_simulation": False,
                    "analysis_method": "YOLO_OBJECT_DETECTION",
                    "model": model_name,
                    "detection_mode": detection_mode,
                    "class_filter": (
                        NAVAL_COCO_CLASSES if detection_mode == "naval" else None
                    ),
                    "human_review_required": True,
                    "run_id": run_id,
                    "original_filename": Path(file.filename).name,
                    "classes_seen": classes_seen,
                    "unique_object_counts": dict(unique_object_counts),
                    "potential_threat_assessment": threat_assessment,
                },
                media_reference=f"/api/vision/runs/{run_id}/video",
                description=(
                    (description.strip() or "Video observation for review")
                    + f" | {frames_processed} sampled frames; "
                    + f"{detection_total} frame detections. "
                    + f"Review priority: {threat_assessment['level']}. "
                    + "Human review required."
                ),
            )
        )

        return {
            "run_id": run_id,
            "evidence_id": evidence["evidence_id"],
            "status": "completed",
            "review_status": "UNVERIFIED_REQUIRES_HUMAN_REVIEW",
            "model": model_name,
            "detection_mode": detection_mode,
            "source_video": Path(file.filename).name,
            "video": {
                "width": width,
                "height": height,
                "source_fps": round(source_fps, 2),
                "duration_seconds": round(duration_seconds, 2),
                "file_size_bytes": size,
            },
            "metrics": {
                "frames_processed": frames_processed,
                "detections_total": detection_total,
                "detections_by_class_per_frame": dict(frame_detection_counts),
                "unique_object_counts_approx": dict(unique_object_counts),
                "unique_classes": classes_seen,
                "processing_seconds": round(elapsed, 3),
                "analysis_fps": round(frames_processed / elapsed, 2)
                if elapsed > 0 else 0,
                "sampled_fps": round(effective_fps, 2),
            },
            "frames": frame_results[:500],
            "threat_assessment": threat_assessment,
            "annotated_video_url": f"/api/vision/runs/{run_id}/video",
            "note": (
                "Generic object detection cannot establish hostile intent. "
                "Naval mode filters to the standard COCO boat class only. "
                "Class filtering can suppress false labels but does not "
                "improve model accuracy. Context indicators require verification."
            ),
        }

    finally:
        input_path.unlink(missing_ok=True)
        await file.close()


@router.get("/runs/{run_id}/video")
def get_annotated_video(run_id: str):
    if len(run_id) != 32 or not run_id.isalnum():
        raise HTTPException(status_code=400, detail="Invalid run ID.")

    path = RUN_DIR / f"{run_id}_annotated.mp4"

    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Annotated video not found. Run analysis again.",
        )

    return FileResponse(
        path,
        media_type="video/mp4",
        filename=f"aegis-{run_id[:8]}-annotated.mp4",
    )
