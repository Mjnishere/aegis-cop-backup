import React, { useState, useEffect } from 'react';
import MapAutoResize from './ui/MapAutoResize';
import Icon from './ui/Icon';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE_URL } from '../config';

export default function WeatherDashboard({ onSelectTab, isScenarioActive }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(6); // 6, 12, 24, 48

  const fetchForecast = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/weather/forecast`);
      if (res.ok) {
        const data = await res.json();
        setForecast(data);
        setError(null);
      } else {
        setError("Unable to retrieve weather forecast");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
    const interval = setInterval(fetchForecast, 120000); // 2 min refresh
    return () => clearInterval(interval);
  }, [isScenarioActive]);

  const summary = forecast?.summary || {};
  const current = forecast?.current || {};
  const hourly = forecast?.hourly || [];
  const displayHourly = hourly.slice(0, timeRange);

  const getBadgeStyle = (badge) => {
    switch (badge) {
      case 'CRITICAL':
        return 'bg-red-600 text-white border-red-700';
      case 'HIGH':
        return 'bg-amber-600 text-white border-amber-700';
      case 'MODERATE':
      case 'PREPARE':
        return 'bg-yellow-500 text-slate-900 border-yellow-600';
      case 'WATCH':
        return 'bg-blue-600 text-white border-blue-700';
      default:
        return 'bg-emerald-600 text-white border-emerald-700';
    }
  };

  const formatTimeString = (timeStr) => {
    if (!timeStr) return '--';
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? String(timeStr) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return String(timeStr);
    }
  };

  const formatHourLabel = (timeStr) => {
    if (!timeStr) return '--';
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? String(timeStr) : d.toLocaleTimeString([], { hour: 'numeric' });
    } catch (e) {
      return String(timeStr);
    }
  };

  const HubballiDharwadSectors = [
    { name: 'Gokul Road Sector', lat: 15.3647, lon: 75.1240, issue: 'Drainage Outlet Overflow', severity: 'HIGH', riskScore: 88 },
    { name: 'Keshwapur Corridor', lat: 15.3750, lon: 75.1350, issue: 'Open Drain Blockage', severity: 'HIGH', riskScore: 82 },
    { name: 'Dharwad Central', lat: 15.4589, lon: 75.0078, issue: 'Culvert Capacity Exceeded', severity: 'CRITICAL', riskScore: 92 },
    { name: 'Vidyanagar - Unkal', lat: 15.3750, lon: 75.1300, issue: 'Low-Lying Water Accumulation', severity: 'MODERATE', riskScore: 68 }
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner & Mode */}
      <div className="panel flex flex-col md:flex-row justify-between items-start md:items-center px-4 py-3 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Icon name="cloud" size={18} className="text-accent" /> Weather &amp; Preparedness</h1>
          </div>
          <p className="text-slate-500 text-[11px]">
            Open-Meteo forecast (single point, when reachable) & heuristic preparedness levels
          </p>
        </div>

        <div className="flex items-center gap-3">
          {forecast?.is_controlled_scenario ? (
            <span className="chip-warn"><Icon name="flask" size={12} /> CONTROLLED SCENARIO — not observation</span>
          ) : forecast?.status === 'success' ? (
            <span className="chip-ok"><span className="dot bg-emerald-500" /> LIVE FORECAST (Open-Meteo)</span>
          ) : (
            <span className="chip-muted"><span className="dot bg-slate-400" /> FORECAST UNAVAILABLE</span>
          )}
          <button onClick={fetchForecast} className="btn-secondary">
            <Icon name="refresh" size={13} /> Refresh
          </button>
        </div>
      </div>

      {loading && !forecast ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm animate-pulse font-mono">
          Loading weather forecast...
        </div>
      ) : (error || forecast?.status === 'unavailable') ? (
        <div className="p-6 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl space-y-3 max-w-3xl">
          <div className="text-base font-bold">Weather data unavailable — conditions are unknown</div>
          <p className="text-sm">
            {error
              ? 'The backend could not be reached, so no forecast was loaded.'
              : 'The backend could not obtain a forecast from its weather provider (Open-Meteo). This is expected when the backend runs offline.'}
          </p>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>Hazard scores treat weather as <b>unknown</b>, not as zero rain: they are marked partial and show an upper bound.</li>
            <li>Threat-zone routing, route monitoring and the mission workflow do not depend on weather and keep working.</li>
            <li>For a demonstration with weather inputs, use <b>RAIN SCENARIO (SIMULATED)</b> in the header (a labelled, controlled scenario — not an observation).</li>
          </ul>
          {(error || forecast?.error) && (
            <details className="text-xs text-amber-800">
              <summary className="cursor-pointer font-semibold">Technical detail</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all font-mono bg-white/60 p-2 rounded border border-amber-200">{error || forecast?.error}</pre>
            </details>
          )}
        </div>
      ) : (
        <>
          {/* Main Grid: Preparedness Banner + Current Conditions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Municipal Preparedness Banner (2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    MUNICIPAL PREPAREDNESS LEVEL
                  </span>
                  <span className="text-xs text-slate-400 font-mono">| Decision-Support Status</span>
                </div>
                <span className={`px-3 py-1 rounded-md text-xs font-black tracking-wider uppercase border shadow-sm ${getBadgeStyle(summary.preparedness_badge)}`}>
                  {summary.preparedness_level || 'NORMAL'}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Operational Assessment:
                </h3>
                <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200 font-medium">
                  {summary.preparedness_reason}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                  Recommended Pre-Rain Action Items:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(summary.recommendations || []).map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-md border border-slate-200 text-xs text-slate-800 transition">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500 font-mono">
                <div>Next 6h Max Rain Prob: <strong className="text-slate-900">{summary.max_prob_6h}%</strong></div>
                <div>Next 6h Expected Rain: <strong className="text-slate-900">{summary.expected_rain_6h_mm} mm</strong></div>
                <div>Active Vulnerable Sectors: <strong className="text-red-700">{summary.active_drainage_issues || 0}</strong></div>
              </div>
            </div>

            {/* Current Weather Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-md space-y-4 border border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start border-b border-slate-700 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-white">Hubballi-Dharwad</h3>
                    <p className="text-xs text-slate-400 font-mono">{forecast?.is_controlled_scenario ? 'Current conditions (scenario values)' : 'Current conditions'}</p>
                  </div>
                  <span className="text-3xl">
                    {current.precipitation_mm === null || current.precipitation_mm === undefined
                      ? <span className="text-xs text-slate-500">unknown</span>
                      : <Icon name={current.precipitation_mm > 0 ? 'cloud' : 'sun'} size={28} title={current.precipitation_mm > 0 ? 'Rain' : 'No rain'} />}
                  </span>
                </div>

                <div className="py-4 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-4xl font-extrabold text-white">
                      {current.temperature_c !== undefined && current.temperature_c !== null ? `${current.temperature_c}°C` : '--'}
                    </span>
                    <span className="text-xs font-mono text-slate-300">
                      Wind: {current.wind_speed_kmh ?? '--'} km/h
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 font-mono border-t border-slate-700/60 pt-3">
                    <div className="flex justify-between">
                      <span>Current Rain:</span>
                      <strong className="text-white">{current.precipitation_mm ?? 'unknown'}{current.precipitation_mm === null || current.precipitation_mm === undefined ? '' : ' mm/h'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Humidity:</span>
                      <strong className="text-white">{current.humidity_pct !== undefined && current.humidity_pct !== null ? `${current.humidity_pct}%` : '--'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Forecast Source:</span>
                      <strong className="text-emerald-400">{forecast.source}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 border-t border-slate-700/80 pt-3 font-mono flex justify-between">
                <span>Last Updated:</span>
                <span>{formatTimeString(forecast.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Rainfall & Probability Forecast Timeline & Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Icon name="activity" size={14} /> HOURLY RAINFALL PROBABILITY & EXPECTED PRECIPITATION
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Chronological forecast beginning at current hour (6H, 12H, 24H, 48H windows)
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                {[6, 12, 24, 48].map((hrs) => (
                  <button
                    key={hrs}
                    onClick={() => setTimeRange(hrs)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                      timeRange === hrs
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {hrs}H
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Bar Chart Comparison */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-2 max-h-72 overflow-x-auto pb-2">
                {displayHourly.map((pt, idx) => {
                  const hourLabel = formatHourLabel(pt.time);
                  // null = provider gave no value for this hour; shown as "n/a", not 0.
                  const probKnown = pt.rain_probability_pct !== null && pt.rain_probability_pct !== undefined;
                  const rainKnown = pt.expected_rain_mm !== null && pt.expected_rain_mm !== undefined;
                  const probPct = probKnown ? pt.rain_probability_pct : 0;
                  const rainMm = rainKnown ? pt.expected_rain_mm : 0;
                  const tempC = pt.temperature_c ?? '--';

                  return (
                    <div key={idx} className="flex flex-col items-center bg-slate-50 p-2 rounded-lg border border-slate-200 text-center hover:bg-slate-100 transition">
                      <span className="text-[10px] font-bold text-slate-600 font-mono mb-1">{hourLabel}</span>
                      
                      {/* Bar Container */}
                      <div className="h-28 w-full flex items-end justify-center gap-1 bg-slate-200/60 rounded p-1 relative">
                        {/* Probability Bar */}
                        <div
                          className="w-2.5 bg-blue-600 rounded-t transition-all duration-300"
                          style={{ height: `${Math.max(5, probPct)}%`, opacity: probKnown ? 1 : 0.15 }}
                          title={`Rain Probability: ${probPct}%`}
                        />
                        {/* Rain Volume Bar */}
                        <div
                          className="w-2.5 bg-indigo-900 rounded-t transition-all duration-300"
                          style={{ height: `${Math.min(100, Math.max(5, rainMm * 10))}%`, opacity: rainKnown ? 1 : 0.15 }}
                          title={`Expected Rain: ${rainMm} mm`}
                        />
                      </div>

                      <div className="mt-1.5 space-y-0.5 font-mono text-[9px]">
                        <div className="text-blue-700 font-bold">{probKnown ? `${probPct}%` : 'n/a'}</div>
                        <div className="text-slate-800 font-bold">{rainKnown ? `${rainMm} mm` : 'n/a'}</div>
                        <div className="text-slate-500">{tempC}°C</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-6 text-xs text-slate-600 font-mono pt-2 border-t border-slate-100 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-600 rounded-sm inline-block" />
                  <span>Rain Probability (%) — Likelihood of rainfall</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-indigo-900 rounded-sm inline-block" />
                  <span>Expected Rain (mm) — Total rainfall depth</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">°C</span>
                  <span>Temperature (°C) per hour</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sector Drainage Vulnerability + Weather Map */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sector Drainage Risks List */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Icon name="layers" size={14} /> SECTOR DRAINAGE RISKS
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Hubballi-Dharwad Urban Sectors & Vulnerability
                </p>
              </div>

              <div className="space-y-3">
                {HubballiDharwadSectors.map((sector, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 text-xs">{sector.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black text-white ${
                        sector.severity === 'CRITICAL' ? 'bg-red-700' : 'bg-amber-600'
                      }`}>
                        {sector.severity}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">Issue: {sector.issue}</div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200">
                      <span>Flood Risk: <strong className="text-red-700">{sector.riskScore}/100</strong></span>
                      <span>Action: Pre-Inspect</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hubballi-Dharwad Weather & Sector Map (2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="globe" size={14} /> WEATHER & VULNERABILITY CONTEXT MAP
                </h3>
                <span className="text-[10px] font-mono text-slate-500">
                  Hubballi-Dharwad Sector Overlay (Modeled Drainage Corridors)
                </span>
              </div>

              <div className="h-80 w-full rounded-lg overflow-hidden border border-slate-300 relative">
                <MapContainer center={[15.3647, 75.1240]} zoom={12} className="h-full w-full z-0">
        <MapAutoResize />
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="basemap-tiles"
                  />
                  {HubballiDharwadSectors.map((sec, i) => (
                    <CircleMarker
                      key={i}
                      center={[sec.lat, sec.lon]}
                      radius={12}
                      pathOptions={{
                        color: sec.severity === 'CRITICAL' ? '#991B1B' : '#D97706',
                        fillColor: sec.severity === 'CRITICAL' ? '#991B1B' : '#D97706',
                        fillOpacity: 0.7
                      }}
                    >
                      <Popup>
                        <div className="text-xs space-y-1 p-0.5">
                          <strong className="text-slate-900 font-bold">{sec.name}</strong>
                          <div>Issue: {sec.issue}</div>
                          <div>Risk Score: {sec.riskScore}/100</div>
                          <div className="text-blue-700 font-bold">Recommended: Drainage Clearance</div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
