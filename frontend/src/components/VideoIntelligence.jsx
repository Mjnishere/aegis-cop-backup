
import { useState } from 'react';
import { API_BASE_URL, BACKEND_HOST } from '../config';

export default function VideoIntelligence() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [restrictedZone, setRestrictedZone] = useState(false);
  const [unusualBehavior, setUnusualBehavior] = useState(false);
  const [nearAsset, setNearAsset] = useState(false);
  const [aisStatus, setAisStatus] = useState('unknown');

  async function analyzeVideo(event) {
    event.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);

    const body = new FormData();
    body.append('file', file);
    body.append('description', description);
    body.append('confidence_threshold', '0.35');
    body.append('sample_fps', '2');
    body.append('restricted_zone_entry', String(restrictedZone));
    body.append('unusual_behavior_observed', String(unusualBehavior));
    body.append('near_protected_asset', String(nearAsset));
    body.append('ais_status', aisStatus);

    if (latitude.trim()) body.append('latitude', latitude);
    if (longitude.trim()) body.append('longitude', longitude);

    try {
      const response = await fetch(
        `${API_BASE_URL}/vision/analyze-video`,
        { method: 'POST', body }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Request failed: ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Video analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-canvas p-4 space-y-4">
      <section className="panel p-4">
        <h2 className="text-lg font-bold text-slate-900">
          Video Intelligence & Threat Assessment
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Analyze surveillance footage and combine visual detections
          with contextual indicators. All results require human review.
        </p>
      </section>

      <form onSubmit={analyzeVideo} className="panel p-4 space-y-4">
        <label className="block text-sm font-semibold">
          Surveillance video
          <input
            type="file"
            accept="video/*"
            required
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block mt-2 text-sm"
          />
        </label>

        {file && (
          <p className="text-xs text-slate-500">
            {file.name} — {(file.size / 1048576).toFixed(1)} MB
          </p>
        )}

        <label className="block text-sm">
          Observation notes
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="block w-full mt-1 border rounded p-2"
            rows={2}
            placeholder="Describe what the operator observed"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            Latitude (optional)
            <input
              type="number"
              min="-90"
              max="90"
              step="any"
              value={latitude}
              onChange={e => setLatitude(e.target.value)}
              className="block w-full mt-1 border rounded p-2"
            />
          </label>
          <label className="text-sm">
            Longitude (optional)
            <input
              type="number"
              min="-180"
              max="180"
              step="any"
              value={longitude}
              onChange={e => setLongitude(e.target.value)}
              className="block w-full mt-1 border rounded p-2"
            />
          </label>
        </div>

        <div className="border rounded p-3 space-y-3">
          <h3 className="font-semibold text-sm">Context for review</h3>
          <p className="text-xs text-slate-500">
            These indicators are operator supplied, not automatically
            verified by the current detector.
          </p>

          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={restrictedZone}
              onChange={e => setRestrictedZone(e.target.checked)}
            />
            Restricted-zone entry reported
          </label>

          <label className="block text-sm">
            AIS status
            <select
              value={aisStatus}
              onChange={e => setAisStatus(e.target.value)}
              className="block w-full mt-1 border rounded p-2"
            >
              <option value="unknown">Unknown / not checked</option>
              <option value="matched">Identity/position matched</option>
              <option value="missing">No AIS match reported</option>
              <option value="mismatch">Identity/position mismatch reported</option>
            </select>
          </label>

          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={unusualBehavior}
              onChange={e => setUnusualBehavior(e.target.checked)}
            />
            Unusual behavior reported
          </label>

          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={nearAsset}
              onChange={e => setNearAsset(e.target.checked)}
            />
            Near a protected asset, according to available context
          </label>
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="rounded bg-indigo-600 text-white px-4 py-2 font-semibold disabled:opacity-50"
        >
          {loading ? 'Analyzing video…' : 'Analyze video'}
        </button>

        {error && (
          <p role="alert" className="text-sm text-red-700">{error}</p>
        )}
      </form>

      {result && (
        <>
          <section className="panel p-4 space-y-3">
            <h3 className="font-bold text-slate-900">Detection results</h3>
            <p className="text-sm">
              Evidence ID: <code>{result.evidence_id}</code>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Frames', result.metrics.frames_processed],
                ['Detections', result.metrics.detections_total],
                ['Seconds', result.metrics.processing_seconds],
                ['Analysis FPS', result.metrics.analysis_fps],
              ].map(([label, value]) => (
                <div className="border rounded p-3" key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-sm">
              Classes detected: {result.metrics.unique_classes.join(', ') || 'None'}
            </p>
            <p className="text-xs text-amber-700">
              Detection is not proof of a threat. Review the footage.
            </p>
          </section>

          <section className="panel p-4 space-y-3">
            <h3 className="font-bold text-slate-900">Potential threat assessment</h3>
            <p className="text-lg font-bold">
              {result.threat_assessment.level}
            </p>
            <p className="text-sm">
              Review score: {result.threat_assessment.score}/100
              {' — not a probability'}
            </p>
            {result.threat_assessment.indicators.map(item => (
              <div className="border rounded p-3" key={item.code}>
                <p className="font-semibold text-sm">
                  {item.code.replaceAll('_', ' ')} (+{item.points})
                </p>
                <p className="text-sm text-slate-600">{item.evidence}</p>
                <p className="text-xs text-slate-500">
                  Source: {item.source} · {item.status}
                </p>
              </div>
            ))}
            <p className="text-xs text-amber-700">
              Human confirmation required. Context flags are not verified
              automatically by this prototype.
            </p>
          </section>

          <section className="panel p-4">
            <h3 className="font-bold mb-2">Annotated video</h3>
            <video
              controls
              className="w-full rounded bg-black"
              src={`${BACKEND_HOST}${result.annotated_video_url}`}
            />
            <a
              className="inline-block mt-3 text-sm text-indigo-700 underline"
              href={`${BACKEND_HOST}${result.annotated_video_url}`}
              target="_blank"
              rel="noreferrer"
            >
              Open annotated video separately
            </a>
          </section>
        </>
      )}
    </div>
  );
}
