import { useState, useEffect } from 'react';
import MapAutoResize from './ui/MapAutoResize';
import Icon from './ui/Icon';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AlertCenter from './AlertCenter';
import IncidentCenter from './IncidentCenter';
import ResourceCenter from './ResourceCenter';
import { API_BASE_URL } from '../config';

import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: icon2x,
  iconUrl: icon,
  shadowUrl: iconShadow
});

function getRiskColor(level) {
    if (level === "CRITICAL") return "#C62828";
    if (level === "HIGH") return "#D97706";
    if (level === "WARNING") return "#B7791F";
    if (level === "WATCH") return "#0B4F8A";
    return "#2E7D32";
}

export default function NationalView() {
  const [riskData, setRiskData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [satLayers, setSatLayers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [showAlertCenter, setShowAlertCenter] = useState(false);
  const [showIncidentCenter, setShowIncidentCenter] = useState(false);
  const [showResourceCenter, setShowResourceCenter] = useState(false);

  // Municipal Notification Draft state
  const [municipalNotification, setMunicipalNotification] = useState(null);
  const [ndrfRecommendation, setNdrfRecommendation] = useState(null);
  const [nationalAuditLog, setNationalAuditLog] = useState([
    { time: new Date().toLocaleTimeString(), event: 'NATIONAL VIEW OPENED', details: 'Client-side log of actions taken in this session' }
  ]);

  const [fieldUnits, setFieldUnits] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [riskRes, fcRes, layersRes, fuRes] = await Promise.all([
          fetch(`${API_BASE_URL}/national/risk`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE_URL}/national/risk/forecast`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE_URL}/national/satellite/layers`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE_URL}/national/field-units`).then(r => r.json()).catch(() => null),
        ]);
        if (riskRes) setRiskData(riskRes);
        if (fcRes) setForecastData(fcRes);
        if (layersRes?.records) setSatLayers(layersRes.records);
        if (fuRes?.records) setFieldUnits(fuRes.records);
      } catch (err) {
        console.error("Failed to load national data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="p-4 bg-canvas text-slate-700 font-bold">Loading National Risk Intelligence...</div>;

  // Only backend regions are shown; no placeholder regions or scores are substituted.
  const regions = riskData?.regions || [];
  
  const validRegions = regions.filter(r => r && typeof r.latitude === 'number' && typeof r.longitude === 'number' && !isNaN(r.latitude) && !isNaN(r.longitude));
  const selectedRegion = selectedRegionId ? validRegions.find(r => r.id === selectedRegionId) : validRegions[0];

  function handleIssueMunicipalNotification(region) {
    setMunicipalNotification({
      to: `Hubballi-Dharwad Municipal Corporation — Demo Coordination Channel`,
      subject: `Urgent Drainage & Inundation Warning: ${region.district} Sector`,
      status: 'DRAFT — NOT SENT',
      region: region.district
    });
  }

  return (
    <div className="flex flex-col h-full bg-canvas text-slate-900 p-4 font-sans overflow-hidden">
      
      {/* Header Summary */}
      <div className="mb-3 panel px-4 py-3 shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Icon name="globe" size={18} className="text-accent" /> Regional Overview</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Regional risk feed: <b className="text-slate-700">{riskData?.mode || (riskData ? 'unknown' : 'unreachable')}</b> · links to resources, incidents and the alert centre
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowResourceCenter(true)} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1.5 px-3 rounded text-xs">
              OPEN RESOURCES
            </button>
            <button onClick={() => setShowIncidentCenter(true)} className="bg-accent hover:bg-accent-strong text-white font-bold py-1.5 px-3 rounded text-xs">
              OPEN INCIDENTS
            </button>
            <button onClick={() => setShowAlertCenter(true)} className="bg-red-700 hover:bg-red-800 text-white font-bold py-1.5 px-3 rounded text-xs">
              OPEN ALERT CENTER
            </button>
          </div>
        </div>
      </div>

      {/* Overlays */}
      {showAlertCenter && <AlertCenter onClose={() => setShowAlertCenter(false)} selectedRegion={selectedRegion} />}
      {showIncidentCenter && <IncidentCenter onClose={() => setShowIncidentCenter(false)} />}
      {showResourceCenter && <ResourceCenter onClose={() => setShowResourceCenter(false)} />}

      {/* Main Layout */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* Left Affected Areas Table & Region Operations */}
        <div className="w-1/3 flex flex-col gap-3 overflow-y-auto">
          
          {/* Affected Areas Table */}
          <div className="bg-white border border-line p-3.5 rounded-md shadow-sm">
            <h2 className="font-extrabold text-xs uppercase tracking-wider text-accent border-b border-line pb-2 mb-2">
              AFFECTED REGIONS DIRECTORY
            </h2>
            <div className="space-y-2">
              {regions.length === 0 && (
                <div className="text-[11px] text-slate-600 bg-slate-50 border border-dashed border-slate-300 rounded p-3">
                  No regional assessments available. The backend's regional risk feed returned no regions
                  (feed mode: {riskData?.mode || (riskData ? 'unknown' : 'backend unreachable')}; it requires
                  configured IMD access). Nothing is substituted. The Hubballi-Dharwad mission workflow on the
                  Overview tab does not depend on this feed.
                </div>
              )}
              {regions.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRegionId(r.id)}
                  className={`p-2.5 rounded border text-xs cursor-pointer transition ${
                    selectedRegion?.id === r.id ? 'bg-blue-50 border-accent ring-1 ring-accent' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900">{r.district}, {r.state}</span>
                    <span className="font-bold text-xs" style={{ color: getRiskColor(r.risk.level) }}>
                      {r.risk.score} ({r.risk.level})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>Roads: {r.roads ?? '—'} | Drains: {r.drainageAlerts ?? '—'}</span>
                    {r.demo
                      ? <span className="text-amber-700 font-bold">DEMO PLACEHOLDER (backend data unavailable)</span>
                      : <span className="text-slate-600 font-bold">BACKEND HEURISTIC</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Region Operations Panel */}
          {selectedRegion && (
            <div className="bg-white border border-line p-3.5 rounded-md shadow-sm space-y-3 text-xs">
              <div className="border-b border-line pb-2">
                <h3 className="font-extrabold text-sm text-slate-900">REGION OPERATIONS: {selectedRegion.district}</h3>
                <p className="text-slate-600">Risk Score: <strong className="text-red-700">{selectedRegion.risk.score}/100</strong></p>
              </div>

              {/* Simulated Response Options */}
              <div className="space-y-1.5">
                <p className="font-extrabold text-[10px] text-slate-500 uppercase">NATIONAL RESPONSE OPTIONS</p>
                <button
                  onClick={() => handleIssueMunicipalNotification(selectedRegion)}
                  className="w-full text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 text-accent p-2 rounded font-bold transition"
                >
                  ISSUE MUNICIPAL DRAINAGE ALERT
                </button>
                <button
                  onClick={() => {
                    setNdrfRecommendation({
                      region: selectedRegion,
                      team: 'National Flood Response Battalion 04',
                      status: 'RECOMMENDED',
                      origin: 'Regional Disaster Response Base',
                      destination: `${selectedRegion.district}, ${selectedRegion.state}`,
                      timestamp: new Date().toLocaleTimeString() + ' IST'
                    });
                    setNationalAuditLog(prev => [
                      { time: new Date().toLocaleTimeString(), event: 'NDRF RESPONSE RECOMMENDATION CREATED', details: `Unit: Battalion 04 -> Target: ${selectedRegion.district}` },
                      ...prev
                    ]);
                  }}
                  className="w-full text-left bg-accent hover:bg-accent-strong text-white p-2 rounded font-bold transition"
                >
                  RECOMMEND NDRF RESPONSE SIMULATION
                </button>
              </div>

              {/* NDRF Simulation Panel */}
              {ndrfRecommendation && (
                <div className="bg-accent-soft border border-accent/20 p-3 rounded space-y-2">
                  <div className="font-bold text-accent uppercase text-[10px] flex justify-between border-b border-accent/10 pb-1">
                    <span>NATIONAL NDRF RESPONSE SIMULATION</span>
                    <span className="text-emerald-700 font-bold">{ndrfRecommendation.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-700"><b>Target Region:</b> {ndrfRecommendation.destination}</div>
                  <div className="text-[11px] text-slate-700"><b>Assigned Unit:</b> {ndrfRecommendation.team}</div>
                  <div className="text-[10px] text-amber-800 font-bold bg-amber-50 p-1 rounded border border-amber-200">
                    CONTROLLED DEMONSTRATION SIMULATION — NOT ACTUAL GOVERNMENT DISPATCH
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setNdrfRecommendation({ ...ndrfRecommendation, status: 'EN_ROUTE — MOVING TO DESTINATION' });
                        setNationalAuditLog(prev => [
                          { time: new Date().toLocaleTimeString(), event: 'NDRF RESPONSE TRIP STARTED', details: `Battalion 04 en route to ${ndrfRecommendation.destination}` },
                          ...prev
                        ]);
                      }}
                      className="flex-1 bg-accent hover:bg-accent-strong text-white font-bold py-1.5 rounded text-[10px]"
                    >
                      START RESPONSE TRIP
                    </button>
                    <button
                      onClick={() => setNdrfRecommendation(null)}
                      className="bg-slate-200 text-slate-700 font-bold px-2 py-1.5 rounded text-[10px]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* National Audit Log Card */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1.5">
                <div className="font-bold text-slate-700 uppercase text-[10px]">NATIONAL AUDIT LOG</div>
                <div className="space-y-1 max-h-28 overflow-y-auto font-mono text-[10px]">
                  {nationalAuditLog.map((item, idx) => (
                    <div key={idx} className="bg-white p-1 rounded border border-slate-200 text-slate-800">
                      <span className="text-slate-500">[{item.time}]</span> <strong className="text-accent">{item.event}</strong>: {item.details}
                    </div>
                  ))}
                </div>
              </div>

              {/* Municipal Draft Modal Card */}
              {municipalNotification && (
                <div className="bg-slate-50 border border-amber-300 p-3 rounded space-y-2">
                  <div className="font-bold text-amber-900 uppercase text-[10px] flex justify-between">
                    <span>MUNICIPAL DRAINAGE NOTIFICATION (SIMULATED DRAFT)</span>
                    <span className="text-amber-700 font-bold">{municipalNotification.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-700"><b>To:</b> {municipalNotification.to}</div>
                  <div className="text-[11px] text-slate-700"><b>Subject:</b> {municipalNotification.subject}</div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setMunicipalNotification({ ...municipalNotification, status: '✓ APPROVED & SIMULATED SENT (NOT REAL MESSAGE)' })}
                      className="flex-1 bg-emerald-700 text-white font-bold py-1 rounded text-[10px]"
                    >
                      APPROVE DEMO MESSAGE
                    </button>
                    <button
                      onClick={() => setMunicipalNotification(null)}
                      className="bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded text-[10px]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Right Map Display (Standard OpenStreetMap Tiles) */}
        <div className="w-2/3 bg-white border border-line rounded-md overflow-hidden shadow-sm relative">
          <MapContainer
            center={[selectedRegion?.latitude || 15.4589, selectedRegion?.longitude || 75.0078]}
            zoom={selectedRegionId ? 11 : 7}
            className="h-full w-full"
          >
            <MapAutoResize />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="basemap-tiles"
            />

            {validRegions.map(r => (
              <CircleMarker
                key={r.id}
                center={[r.latitude, r.longitude]}
                radius={r.risk.level === 'CRITICAL' ? 14 : 10}
                pathOptions={{
                  color: getRiskColor(r.risk.level),
                  fillColor: getRiskColor(r.risk.level),
                  fillOpacity: 0.6
                }}
              >
                <Popup>
                  <div className="text-xs font-sans">
                    <div className="font-bold text-slate-900">{r.district}, {r.state}</div>
                    <div className="font-bold" style={{ color: getRiskColor(r.risk.level) }}>
                      Risk Level: {r.risk.level} ({r.risk.score}/100)
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

      </div>

    </div>
  );
}
