import Icon from './ui/Icon';
import React, { useState } from 'react';
import { Circle, CircleMarker, Polyline, Popup, Rectangle, Tooltip } from 'react-leaflet';

// Canonical COP layers rendered from GET /api/cop. The backend is authoritative:
// nothing here invents positions, counts or statuses.

const THREAT_COLORS = { CRITICAL: '#991B1B', HIGH: '#DC2626', MODERATE: '#D97706', LOW: '#2563EB' };
// Mission route: blue = active, amber = at risk, red dashed = compromised, green = approved replacement.
const ROUTE_COLORS = { ACTIVE: '#1D4ED8', AT_RISK: '#D97706', INVALIDATED: '#DC2626', REPLACED: '#059669' };
const UNIT_COLORS = { EN_ROUTE: '#0B4F8A', AT_SCENE: '#7C3AED', OPERATING: '#7C3AED', RETURNING: '#0891B2', COMPLETED: '#64748B', UNAVAILABLE: '#94A3B8', ASSIGNED: '#059669' };
const EVIDENCE_COLOR = '#7C3AED';

const INACTIVE_THREAT = new Set(['CLOSED', 'RESOLVED']);

const hasCoords = (o) => o && typeof o.latitude === 'number' && typeof o.longitude === 'number'
  && !isNaN(o.latitude) && !isNaN(o.longitude);

function Badge({ children, className }) {
  return <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${className}`}>{children}</span>;
}

export function COPLayers({ copData, visible, missionArea }) {
  if (!copData) return null;
  const { threats = [], field_units = [], monitored_routes = [], evidence = [] } = copData;
  // Same rule as MissionPanel: the active mission is the most recently created monitored route.
  const activeMissionId = [...monitored_routes].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]?.id;

  return (
    <>
      {missionArea && (
        <Rectangle
          bounds={[[missionArea.min_lat, missionArea.min_lon], [missionArea.max_lat, missionArea.max_lon]]}
          pathOptions={{ color: '#475569', weight: 1, dashArray: '6, 6', fill: false, interactive: false }}
        />
      )}

      {visible.routes && monitored_routes.flatMap(r => [['origin', r.origin], ['destination', r.destination]]
        .map(([kind, p]) => [kind, p, r.id === activeMissionId])
        .filter(([, p]) => p && typeof p.lat === 'number' && typeof p.lon === 'number')
        .map(([kind, p, isActive]) => (
          <CircleMarker
            key={`mission-${kind}-${r.id}-${isActive ? "active" : "earlier"}`}
            center={[p.lat, p.lon]}
            radius={8}
            pathOptions={{ color: '#0F172A', fillColor: kind === 'origin' ? '#FFFFFF' : '#0F172A', fillOpacity: 1, weight: 3 }}
          >
            {/* Permanent labels only for the active (newest) mission, to keep the map readable */}
            <Tooltip direction="top" offset={[0, -8]} permanent={isActive}>
              {isActive ? 'Mission ' : 'Earlier mission '}{kind === 'origin' ? 'origin' : 'destination'}
            </Tooltip>
          </CircleMarker>
        )))}
      {visible.routes && monitored_routes.filter(r => r.geometry?.coordinates?.length > 1).map(r => {
        const color = ROUTE_COLORS[r.status] || '#334155';
        return (
          <Polyline
            key={`cop-route-${r.id}`}
            positions={r.geometry.coordinates.map(c => [c[1], c[0]])}
            pathOptions={{ color, weight: r.status === 'INVALIDATED' ? 6 : 5, opacity: 0.85 }}
          >
            <Popup>
              <div className="text-xs space-y-1 font-sans">
                <div className="font-extrabold text-slate-900">Monitored route</div>
                <div><b>Status:</b> <span className="font-bold" style={{ color }}>{r.status}</span></div>
                <div><b>Distance:</b> {(r.distance_m / 1000).toFixed(2)} km · <b>ETA:</b> {Math.round(r.estimated_time_s / 60)} min</div>
                {r.hazard_summary?.overall_level && (
                  <div><b>Hazard (heuristic):</b> {r.hazard_summary.overall_level} ({r.hazard_summary.overall_score})
                    {r.hazard_summary.score_basis && r.hazard_summary.score_basis !== 'COMPLETE' && (
                      <span className="text-amber-700"> — partial data, could be up to {r.hazard_summary.score_upper_bound}</span>
                    )}
                  </div>
                )}
                {r.hazard_summary?.confidence && (
                  <div><b>Confidence:</b> {r.hazard_summary.confidence}
                    {r.hazard_summary.weather?.state && r.hazard_summary.weather.state !== 'AVAILABLE' && (
                      <span className="text-amber-700"> (weather {r.hazard_summary.weather.state.toLowerCase()})</span>
                    )}
                  </div>
                )}
                {r.hazard_summary?.threat_exposure?.critical_threat_ids?.length > 0 && (
                  <div className="text-red-700"><b>Critical threats:</b> {r.hazard_summary.threat_exposure.critical_threat_ids.join(', ')}</div>
                )}
                <div className="text-[9px] text-slate-500 font-mono">{r.id}</div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {visible.threats && threats.filter(t => hasCoords(t) && !INACTIVE_THREAT.has(t.status)).map(t => {
        const color = THREAT_COLORS[t.severity] || '#334155';
        return (
          <React.Fragment key={`cop-threat-${t.id}`}>
            <Circle
              center={[t.latitude, t.longitude]}
              radius={t.radius_m}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 1.5, dashArray: '4, 4' }}
            />
            <CircleMarker
              center={[t.latitude, t.longitude]}
              radius={9}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
            >
              <Popup>
                <div className="text-xs space-y-1.5 p-0.5 max-w-xs font-sans">
                  <div className="flex justify-between items-center gap-2 border-b border-slate-200 pb-1">
                    <span className="font-extrabold text-slate-900 text-sm">{t.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-black text-white" style={{ background: color }}>{t.severity}</span>
                  </div>
                  {t.is_demo && <Badge className="bg-amber-100 text-amber-800">DEMO DATA</Badge>}
                  <div><b>Category:</b> <span className="font-bold text-accent">{t.category}</span></div>
                  <div><b>Confidence:</b> <strong className="text-slate-800">{t.confidence}</strong></div>
                  <div><b>Status:</b> <span className="font-bold text-emerald-800">{t.status}</span></div>
                  <div><b>Threat radius:</b> {t.radius_m} m</div>
                  {t.description && <div className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">{t.description}</div>}
                  <div className="bg-slate-100 text-[9px] text-slate-600 p-1 rounded mt-1 font-mono">
                    SOURCE: {t.source || 'UNKNOWN'} · {t.id}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        );
      })}

      {visible.units && field_units.filter(hasCoords).map(u => {
        const color = UNIT_COLORS[u.status] || '#334155';
        return (
          <CircleMarker
            key={`cop-unit-${u.id}`}
            center={[u.latitude, u.longitude]}
            radius={7}
            pathOptions={{ color: '#ffffff', fillColor: color, fillOpacity: 1, weight: 2 }}
          >
            <Popup>
              <div className="text-xs space-y-1 font-sans">
                <div className="font-extrabold text-slate-900">{u.name}</div>
                {u.is_demo && <Badge className="bg-amber-100 text-amber-800">DEMO UNIT</Badge>}
                <div><b>Type:</b> {u.type}</div>
                <div><b>Status:</b> <span className="font-bold" style={{ color }}>{u.status}</span></div>
                <div><b>Last seen:</b> {u.last_seen || 'unknown'}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {visible.evidence && evidence.filter(hasCoords).map(e => (
        <CircleMarker
          key={`cop-evidence-${e.id}`}
          center={[e.latitude, e.longitude]}
          radius={6}
          pathOptions={{ color: EVIDENCE_COLOR, fillColor: '#ffffff', fillOpacity: 1, weight: 3, dashArray: e.is_simulation ? '3, 3' : null }}
        >
          <Popup>
            <div className="text-xs space-y-1 font-sans max-w-xs">
              <div className="font-extrabold text-slate-900">{e.observation_type}</div>
              {e.is_simulation && <Badge className="bg-amber-100 text-amber-800">SIMULATED</Badge>}
              <div><b>Source:</b> {e.source_type}{e.source_id ? ` (${e.source_id})` : ''}</div>
              <div><b>Observed:</b> {e.timestamp}</div>
              <div><b>Source confidence:</b> {(e.confidence * 100).toFixed(0)}%</div>
              <div><b>Status:</b> {e.status}{e.threat_id ? ` → ${e.threat_id}` : ''}</div>
              {e.description && <div className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">{e.description}</div>}
              <div className="text-[9px] text-slate-500 font-mono">{e.id}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

const LAYER_ROWS = [
  { key: 'threats', label: 'Threats', count: s => s.active_threat_count, swatch: THREAT_COLORS.CRITICAL },
  { key: 'units', label: 'Field units (active)', count: s => s.active_unit_count, swatch: UNIT_COLORS.ASSIGNED },
  { key: 'routes', label: 'Monitored routes', count: s => s.monitored_route_count, swatch: ROUTE_COLORS.ACTIVE },
  { key: 'evidence', label: 'Evidence', count: s => s.active_evidence_count, swatch: EVIDENCE_COLOR },
];

function unplottedCount(copData, key) {
  if (!copData) return 0;
  if (key === 'routes') return copData.monitored_routes.filter(r => !(r.geometry?.coordinates?.length > 1)).length;
  const list = { threats: copData.threats.filter(t => !INACTIVE_THREAT.has(t.status)), units: copData.field_units, evidence: copData.evidence }[key];
  return list.filter(o => !hasCoords(o)).length;
}

export function COPLayerPanel({ copData, copError, visible, onToggle }) {
  // Expanded by default only when the map is likely wide enough not to be covered.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1700);
  const summary = copData?.summary;
  const updatedAt = copData ? new Date(copData.generated_at).toLocaleTimeString() : null;
  const weatherMode = copData?.system?.weather_mode;
  const notices = [];
  if (copError) notices.push(['bad', `${copData ? 'STALE — last refresh failed' : 'COP unavailable'}: ${copError}`]);
  if (weatherMode === 'CONTROLLED_SCENARIO') notices.push(['warn', 'CONTROLLED SCENARIO weather — not live observation']);
  else if (weatherMode && weatherMode !== 'AVAILABLE') notices.push(['warn', `Weather ${weatherMode.toLowerCase()} — hazard scores are partial`]);
  if (summary?.invalidated_route_count > 0) notices.push(['bad', `${summary.invalidated_route_count} route(s) INVALIDATED`]);

  return (
    <div className="absolute bottom-6 right-3 z-[1000] w-60 font-sans text-[11px] rounded-lg border border-line bg-white/95 shadow-raised backdrop-blur-sm">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left">
        <span className="panel-title flex items-center gap-1.5"><Icon name="layers" size={13} /> COP layers</span>
        <span className="flex items-center gap-1.5 text-slate-500">
          {updatedAt && <span className="font-mono text-[10px]" title="Snapshot generated_at">{updatedAt}</span>}
          <Icon name={open ? 'chevronDown' : 'chevronUp'} size={14} />
        </span>
      </button>
      {!open && (
        <div className="px-2.5 pb-2 -mt-1 text-[10px] text-slate-600 space-y-0.5">
          <div className="font-mono">
            Threats {summary ? summary.active_threat_count : '–'} · Routes {summary ? summary.monitored_route_count : '–'} · Evidence {summary ? summary.active_evidence_count : '–'}
          </div>
          {notices.length > 0 && <div className="font-semibold text-amber-700">{notices.length} notice(s) — expand to read</div>}
        </div>
      )}
      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          {notices.map(([tone, text]) => (
            <div key={text} className={`rounded-md border px-2 py-1 font-semibold ${tone === 'bad' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              {text}
            </div>
          ))}
          <div className="space-y-0.5">
            {LAYER_ROWS.map(row => {
              const missing = unplottedCount(copData, row.key);
              return (
                <label key={row.key} className="flex items-center gap-1.5 py-0.5 cursor-pointer">
                  <input type="checkbox" className="accent-blue-600" checked={visible[row.key]} onChange={() => onToggle(row.key)} />
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.swatch }} />
                  <span className="flex-1 font-medium text-slate-800">{row.label}</span>
                  <span className="font-mono text-slate-900">{summary ? row.count(summary) : '–'}</span>
                  {missing > 0 && <span className="text-[9px] text-slate-500" title="Records without coordinates or geometry are counted but not plotted">({missing} unplotted)</span>}
                </label>
              );
            })}
          </div>
          <div className="pt-1.5 border-t border-slate-200 text-[10px] text-slate-600 grid grid-cols-1 gap-0.5">
            <div><span className="inline-block w-4 border-t-4 align-middle mr-1.5" style={{ borderColor: ROUTE_COLORS.ACTIVE }} />Mission route (active)</div>
            <div><span className="inline-block w-4 border-t-4 align-middle mr-1.5" style={{ borderColor: ROUTE_COLORS.INVALIDATED }} />Compromised route</div>
            <div><span className="inline-block w-4 border-t-4 border-dashed align-middle mr-1.5" style={{ borderColor: ROUTE_COLORS.REPLACED }} />Proposed alternative (dashed)</div>
            <div><span className="inline-block w-4 border-t-4 align-middle mr-1.5" style={{ borderColor: ROUTE_COLORS.REPLACED }} />Approved replacement</div>
            <div><span className="inline-block w-4 border-t border-dashed align-middle mr-1.5 border-slate-500" />Mission area (road-network coverage)</div>
          </div>
        </div>
      )}
    </div>
  );
}
