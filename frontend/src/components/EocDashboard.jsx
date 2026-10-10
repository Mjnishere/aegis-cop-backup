import { useState, useEffect } from 'react';
import MapComponent from './Map';
import NationalView from './NationalView';
import ResourceCenter from './ResourceCenter';
import IncidentCenter from './IncidentCenter';
import AlertCenter from './AlertCenter';
import WeatherDashboard from './WeatherDashboard';
import ThreatPanel from './ThreatPanel';
import MissionPanel from './MissionPanel';
import VideoIntelligence from './VideoIntelligence';
import DecisionChain, { DataSourceStrip } from './DecisionChain';
import Icon from './ui/Icon';
import ThemeSelector from './ui/ThemeSelector';
import { useCOP } from '../hooks/useCOP';
import { API_BASE_URL } from '../config';


export default function EocDashboard({
  viewMode,
  setViewMode,
  weatherStatus,
  systemStatus,
  scenarioStatus,
  toggleScenario,
  onRunFloodDemo,
  refreshScenario,
  onOpenCitizenApp
}) {
  // Common Operating Picture (COP) Data Hook (10s polling refresh)
  const { data: copData, loading: copLoading, error: copError, refresh: refreshCop } = useCOP(10000);

  // Navigation active tab includes video intelligence alongside the existing EOC workflows.
  const [activeTab, setActiveTab] = useState('overview');
  const [weatherForecast, setWeatherForecast] = useState(null);

  // Shared Global Selected Incident State
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedIncidentDetail, setSelectedIncidentDetail] = useState(null);
  const [activePlan, setActivePlan] = useState(null);

  // Backend Data States
  const [incidents, setIncidents] = useState([]);
  const [riskData, setRiskData] = useState(null);
  const [resources, setResources] = useState([]);
  const [fieldUnits, setFieldUnits] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [eocStatus, setEocStatus] = useState(null);
  const [satLayers, setSatLayers] = useState([]);

  // Mission (route monitoring) state lives in the backend; MissionPanel reads it from the COP.
  const [proposedRoute, setProposedRoute] = useState(null);
  const [missionRoute, setMissionRoute] = useState(null);
  const [missionState, setMissionState] = useState(null);

  // Field Operations State Machine
  // Overrides only after the backend confirmed a status change.
  const [fieldUnitStates, setFieldUnitStates] = useState({});

  // Drawer & Toast State
  const [toastMessage, setToastMessage] = useState(null);

  // Satellite view controls
  const [satProduct, setSatProduct] = useState('TRUE_COLOR');

  // Map layer controls
  const [layers, setLayers] = useState({
    incidents: true,
    risk: true,
    resources: true,
    fieldUnits: true,
    satellite: false,
    routing: true,
    floodRisk: true,
    waterlogging: true,
    drainage: true,
  });

  const [demoStep, setDemoStep] = useState(null);
  const [planActionStatus, setPlanActionStatus] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date().toLocaleTimeString() + ' IST');

  const [routeInfo, setRouteInfo] = useState(null);
  const [floodOverlay, setFloodOverlay] = useState(null);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetchAllData();
      setLastUpdatedTime(new Date().toLocaleTimeString() + ' IST');
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedIncident?.incident_id) {
      fetchIncidentResponsePlan(selectedIncident.incident_id);
    } else {
      setActivePlan(null);
    }
  }, [selectedIncident]);

  async function fetchIncidentResponsePlan(incId) {
    try {
      const res = await fetch(`${API_BASE_URL}/national/incidents/${incId}/response-plan`);
      if (res.ok) {
        const data = await res.json();
        if (data.records && data.records.length > 0) {
          setActivePlan(data.records[data.records.length - 1]);
        } else {
          setActivePlan(null);
        }
      } else {
        setActivePlan(null);
      }
    } catch (e) {
      setActivePlan(null);
    }
  }

  function showToast(msg, type = "info") {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function fetchAllData() {
    try {
      const [eocRes, incRes, riskRes, resRes, fuRes, altRes, satRes, wfRes] = await Promise.all([
        fetch(`${API_BASE_URL}/national/eoc/status`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}/national/incidents`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}/national/risk`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}/national/resources`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}/national/field-units`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}/national/alerts`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}/national/satellite/layers`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}/weather/forecast`).then(r => r.json()).catch(() => null),
      ]);

      if (eocRes) setEocStatus(eocRes);
      if (incRes?.records) {
        setIncidents(incRes.records);
        if (!selectedIncident && incRes.records.length > 0) {
          setSelectedIncident(incRes.records[0]);
          fetchIncidentDetail(incRes.records[0].incident_id);
        }
      }
      if (riskRes) setRiskData(riskRes);
      if (resRes?.records) setResources(resRes.records);
      if (fuRes?.records) setFieldUnits(fuRes.records);
      if (altRes?.records) setAlerts(altRes.records);
      if (satRes?.records) setSatLayers(satRes.records);
      if (wfRes) setWeatherForecast(wfRes);

    } catch (err) {
      console.error("Failed to fetch EOC data:", err);
    }
  }

  async function fetchIncidentDetail(incidentId) {
    try {
      const res = await fetch(`${API_BASE_URL}/national/incidents/${incidentId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedIncidentDetail(data.record);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleSelectIncident(inc) {
    setSelectedIncident(inc);
    fetchIncidentDetail(inc.incident_id);
  }

  // ============================================================
  // REALISTIC CONTROLLED FLOOD DEMO SCENARIO ENGINE
  // ============================================================
  const handleRunFloodResponseDemo = async () => {
    try {
      setDemoStep('ACTIVATING_SCENARIO');
      if (scenarioStatus?.active) {
        const off = await fetch(`${API_BASE_URL}/scenario/deactivate`, { method: 'POST' });
        if (!off.ok) throw new Error(`scenario deactivation failed (HTTP ${off.status})`);
        await fetchAllData();
        refreshScenario?.();
        setDemoStep(null);
        showToast("Controlled rain scenario deactivated — weather inputs back to live/unavailable", "success");
        return;
      }
      showToast("Activating controlled (SIMULATED) heavy-rain scenario...", "info");
      const act = await fetch(`${API_BASE_URL}/scenario/activate`, { method: 'POST' });
      if (!act.ok) throw new Error(`scenario activation failed (HTTP ${act.status})`);

      setDemoStep('REFRESHING_RISK');
      showToast("Updating regional flood risk scores...", "info");
      await fetch(`${API_BASE_URL}/national/risk`);

      setDemoStep('ASSESSING_INCIDENTS');
      showToast("Creating DEMO incidents from the built-in region list (no regional risk feed configured)...", "info");
      await fetch(`${API_BASE_URL}/national/incidents/recommend`, { method: 'POST' }).catch(() => {});

      setDemoStep('PREPARING_RESPONSE');
      showToast("Running heuristic 3-hour flood nowcast (simulated inputs)...", "info");
      await fetch(`${API_BASE_URL}/flood/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rainfall_mm_hr: 80, blockage_percent: 50, forecast_minutes: 180 })
      }).catch(() => {});

      setDemoStep('DEMO_READY');
      await fetchAllData();
      refreshScenario?.();
      showToast("✓ Controlled SIMULATED rain scenario active — weather inputs are scenario values, not observations", "success");

      setTimeout(() => setDemoStep(null), 3000);
    } catch (e) {
      showToast("Demo initiation failed: " + e.message, "error");
      setDemoStep(null);
    }
  };

  // ============================================================
  // MISSION ACTIONS (see MissionPanel for the main workflow)
  // ============================================================
  const submitFieldTeamReport = async () => {
    if (!missionRoute?.id) {
      showToast("Start a mission on the Overview tab first (Active Mission panel).", "error");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/simulation/field-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: missionRoute.id, profile: 'FIELD_TEAM_BLOCKAGE' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      showToast(`SIMULATED field-team report → threat ${data.threat.incident_id}; mission route ${data.route_assessment?.current_status}. Review it on the Overview tab.`, "info");
      refreshCop();
    } catch (e) {
      showToast("Simulated field report failed: " + e.message, "error");
    }
  };

  // ============================================================
  // RESPONSE PLAN & DISPATCH ENGINE
  // ============================================================
  async function handleGenerateResponsePlan() {
    setPlanActionStatus({ type: 'loading', message: 'GENERATING RESPONSE PLAN...' });
    const incId = selectedIncident?.incident_id;
    if (!incId) {
      showToast("Select an incident first", "error");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/national/incidents/${incId}/response-plan`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.plan) {
        setActivePlan(data.plan);
        setPlanActionStatus({ type: 'success', message: '✓ RESPONSE PLAN GENERATED (PENDING_APPROVAL)' });
        showToast(`✓ Response plan generated for ${selectedIncident.title}`, "success");
      } else {
        throw new Error(data.detail || "Failed to generate plan");
      }
    } catch (e) {
      setPlanActionStatus({ type: 'error', message: 'Generate error: ' + e.message });
    }
  }

  async function handleApproveResponsePlan() {
    setPlanActionStatus({ type: 'loading', message: 'APPROVING RESPONSE PLAN...' });
    const incId = selectedIncident?.incident_id || (incidents[0]?.incident_id);

    if (!incId) {
      setPlanActionStatus({ type: 'error', message: 'NO INCIDENT SELECTED' });
      showToast("Select an incident first", "error");
      return;
    }

    try {
      let currentPlan = activePlan;
      if (!currentPlan) {
        let planRes = await fetch(`${API_BASE_URL}/national/incidents/${incId}/response-plan`);
        let pData = await planRes.json();

        if (!pData.records || pData.records.length === 0) {
          const genRes = await fetch(`${API_BASE_URL}/national/incidents/${incId}/response-plan`, { method: 'POST' });
          const genData = await genRes.json();
          currentPlan = genData.plan;
        } else {
          currentPlan = pData.records[pData.records.length - 1];
        }
      }

      const pId = currentPlan?.response_plan_id || currentPlan?.plan_id;
      if (pId) {
        const approveRes = await fetch(`${API_BASE_URL}/national/response-plans/${pId}/approve`, { method: 'POST' });
        const aData = await approveRes.json();
        if (approveRes.ok && aData.plan) {
          setActivePlan(aData.plan);
          setPlanActionStatus({ type: 'success', message: '✓ RESPONSE PLAN APPROVED — Resources Reserved' });
          showToast("✓ Response plan approved and resources reserved", "success");
          fetchIncidentDetail(incId);
          fetchAllData();
        } else {
          setPlanActionStatus({ type: 'error', message: 'APPROVAL FAILED: ' + (aData.detail || 'Error') });
        }
      }
    } catch (e) {
      setPlanActionStatus({ type: 'error', message: 'Approval error: ' + e.message });
    }
  }

  async function handleSimulateDispatchUnit() {
    setDispatchStatus({ type: 'loading', message: 'SIMULATING DISPATCH...' });
    const incId = selectedIncident?.incident_id || (incidents[0]?.incident_id);

    if (!incId) {
      setDispatchStatus({ type: 'error', message: 'NO INCIDENT SELECTED' });
      return;
    }

    try {
      const planRes = await fetch(`${API_BASE_URL}/national/incidents/${incId}/response-plan`);
      const pData = await planRes.json();

      if (pData.records && pData.records.length > 0) {
        const plan = pData.records[pData.records.length - 1];
        const action = plan.actions ? plan.actions[0] : null;

        if (action && action.action_id) {
          const dispatchRes = await fetch(`${API_BASE_URL}/national/response-actions/${action.action_id}/dispatch`, { method: 'POST' });
          if (dispatchRes.ok) {
            setDispatchStatus({ type: 'success', message: '✓ DISPATCH RECORDED' });
            showToast("✓ Dispatch recorded. Unit set to EN_ROUTE", "success");
            
            // Advance Field Unit State Machine
            setFieldUnitStates(prev => ({ ...prev, 'FU-001': 'EN_ROUTE' }));
            if (activePlan) {
              setActivePlan(prev => ({ ...prev, status: 'DISPATCHED' }));
            }
            fetchIncidentDetail(incId);
            fetchAllData();
          } else {
            setDispatchStatus({ type: 'error', message: 'DISPATCH FAILED: Plan must be APPROVED first' });
            showToast("Action must be APPROVED first", "error");
          }
        } else {
          setDispatchStatus({ type: 'error', message: 'NO RESPONSE ACTION AVAILABLE' });
        }
      } else {
        setDispatchStatus({ type: 'error', message: 'NO RESPONSE PLAN AVAILABLE' });
      }
    } catch (e) {
      setDispatchStatus({ type: 'error', message: e.message });
    }
  }

  const handleUpdateUnitState = async (unitId, nextState) => {
    try {
      const res = await fetch(`${API_BASE_URL}/national/field-units/${unitId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: nextState, actor: 'EOC Operator', role: 'EOC_OPERATOR' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      setFieldUnitStates(prev => ({ ...prev, [unitId]: nextState }));
      setFieldUnits(prev => prev.map(u => u.field_unit_id === unitId ? { ...u, status: nextState } : u));
      showToast(`✓ Field unit status recorded by backend: ${nextState}`, "success");
      return true;
    } catch (e) {
      showToast(`Status change rejected: ${e.message}`, "error");
      return false;
    }
  };

  const activeIncidents = incidents.filter(i => !['RESOLVED', 'CLOSED'].includes(i.status));
  const availableResourcesCount = resources.filter(r => r.status === 'AVAILABLE' || r.status === 'PARTIALLY_AVAILABLE').length;

  // State for Start Operation Modal
  const [activeOperationModal, setActiveOperationModal] = useState(null);

  return (
    <div className="flex h-screen bg-canvas text-slate-900 font-sans overflow-hidden">
      
      {/* Toast Notification Banner (Zero Native Browser Alerts) */}
      {toastMessage && (
        <div className={`fixed top-3 right-3 z-[2000] px-4 py-2.5 rounded-md font-bold text-xs shadow-lg flex items-center gap-2 border transition ${
          toastMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-900 text-white border-slate-700'
        }`}>
          <span>ℹ {toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 font-black hover:opacity-75">&times;</button>
        </div>
      )}

      {/* Start Operation Modal */}
      {activeOperationModal && (
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm uppercase text-accent flex items-center gap-2">
                <Icon name="radio" size={16} /> FIELD OPERATION IN PROGRESS: {activeOperationModal.name}
              </h3>
              <button onClick={() => setActiveOperationModal(null)} className="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 p-3 rounded space-y-1.5 text-slate-800">
              <div><b>SELECTED INCIDENT:</b> <span className="font-bold text-accent">{selectedIncident?.title || 'none selected'}</span></div>
              <div><b>STATUS:</b> <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">OPERATING</span></div>
              <div><b>ASSIGNED TEAM:</b> {activeOperationModal.name} ({activeOperationModal.unit_type})</div>
            </div>

            <div className="space-y-1.5">
              <div className="font-bold uppercase text-[10px] text-slate-500">CURRENT OPERATIONAL TASK</div>
              <p className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 font-medium">
                Status OPERATING recorded by the backend. Task details are not tracked in this prototype.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="font-bold uppercase text-[10px] text-slate-500">FIELD REPORTS & EVIDENCE</div>
              <div className="bg-slate-50 text-slate-700 p-2 rounded border border-slate-200 text-[11px]">
                No field telemetry or evidence uploads are connected; evidence appears in the COP only when recorded through the evidence API.
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <button
                onClick={() => {
                  handleUpdateUnitState(activeOperationModal.field_unit_id, 'COMPLETED');
                  setActiveOperationModal(null);
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded text-xs shadow-sm"
              >
                COMPLETE OPERATION
              </button>
              <button
                onClick={() => setActiveOperationModal(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-2 rounded text-xs"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* APP SHELL: navigation rail (icons below xl, labels from xl)  */}
      {/* ============================================================ */}
      <aside className="w-16 xl:w-56 bg-white border-r border-line flex flex-col justify-between shrink-0 z-30">
        <div>
          <div className="h-14 px-3 xl:px-4 flex items-center gap-2.5 border-b border-line">
            <span className="w-8 h-8 rounded-md bg-accent text-white flex items-center justify-center shadow-panel">
              <Icon name="shield" size={18} />
            </span>
            <span className="sr-only xl:not-sr-only">
              <span className="block text-[13px] font-bold tracking-tight text-slate-900 leading-none">AEGIS-COP</span>
              <span className="block text-[10px] text-slate-500 mt-1 leading-none">Common Operating Picture</span>
            </span>
          </div>

          <nav className="p-2 xl:p-3 space-y-0.5 text-[13px]" aria-label="Command panels">
            <div className="sr-only xl:not-sr-only px-2 pt-1 pb-2 panel-title">Command panels</div>
            {[
              { id: 'overview', label: 'Overview', icon: 'grid' },
              { id: 'incidents', label: 'Incidents', icon: 'alert',
                badge: activeIncidents.length > 0 ? <span className="chip-bad">{activeIncidents.length}</span> : null },
              { id: 'field', label: 'Field Operations', icon: 'users',
                badge: <span className="text-[10px] text-slate-500 font-semibold">{fieldUnits.length}</span> },
              { id: 'weather', label: 'Weather & Preparedness', icon: 'cloud',
                badge: <span className={weatherForecast?.is_controlled_scenario ? 'chip-warn' : weatherForecast?.status === 'success' ? 'chip-ok' : 'chip-muted'}>
                  {weatherForecast?.is_controlled_scenario ? 'SCENARIO' : weatherForecast?.status === 'success' ? 'LIVE' : 'N/A'}
                </span> },
              { id: 'satellite', label: 'Satellite', icon: 'satellite' },
              { id: 'video', label: 'Video Intelligence', icon: 'video' },
              { id: 'national', label: 'Regional Overview', icon: 'globe' },
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} title={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`relative w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors justify-center xl:justify-start ${
                    active ? 'bg-accent-soft text-accent font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}>
                  {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" aria-hidden="true" />}
                  <Icon name={item.icon} size={18} />
                  <span className="sr-only xl:not-sr-only xl:flex-1 text-left">{item.label}</span>
                  {item.badge && <span className="hidden xl:inline-flex">{item.badge}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-2 xl:p-3 border-t border-line text-[11px] text-slate-500 space-y-1">
          <div className="hidden xl:block font-semibold text-slate-700">Hubballi–Dharwad EOC</div>
          <div className="flex items-center gap-1.5 justify-center xl:justify-start" title="Backend connection (COP refresh every 10 s)">
            <span className={`dot ${copError ? 'bg-red-500' : copData ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span className="sr-only xl:not-sr-only">{copError ? 'Backend unreachable' : copData ? 'Backend connected' : 'Connecting…'}</span>
          </div>
          <div className="hidden xl:block font-mono text-[10px]">Last sync {lastUpdatedTime}</div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN CONTENT AREA                                            */}
      {/* ============================================================ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">

        {/* Header */}
        <header className="min-h-14 bg-white border-b border-line px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 z-20 shrink-0">
          <div className="min-w-0 mr-auto">
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900 leading-tight">
              AEGIS-COP <span className="font-normal text-slate-400">/</span>{' '}
              <span className="font-semibold text-slate-600">Geospatial Intelligence &amp; Decision Support</span>
            </h2>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Icon name="pin" size={12} />
              Hubballi–Dharwad, Karnataka · road-network coverage of this prototype only
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button onClick={() => setActiveTab('weather')}
              className={weatherForecast?.status === 'success' ? (weatherForecast.is_controlled_scenario ? 'chip-warn' : 'chip-info') : 'chip-muted'}
              title={weatherForecast?.status === 'success' ? 'Open Weather & Preparedness' : (weatherForecast?.error ? 'Weather provider unavailable' : 'No weather response')}>
              <Icon name="cloud" size={12} />
              {weatherForecast?.status === 'success' ? (
                <>
                  {weatherForecast.is_controlled_scenario && 'SCENARIO · '}
                  {weatherForecast.current?.temperature_c ?? '--'}°C · rain 6h {weatherForecast.summary?.max_prob_6h ?? '--'}%
                  · {weatherForecast.summary?.preparedness_badge ?? 'UNKNOWN'}
                </>
              ) : 'Weather unavailable'}
            </button>

            <span className={copError ? 'chip-bad' : copData ? 'chip-ok' : 'chip-muted'} title="Based on the last COP refresh (every 10 s)">
              <span className={`dot ${copError ? 'bg-red-500' : copData ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {copError ? 'BACKEND UNREACHABLE' : copData ? 'BACKEND CONNECTED' : 'CONNECTING'}
            </span>

            {/* The one implemented scenario: controlled (simulated) rain inputs */}
            <button onClick={handleRunFloodResponseDemo} disabled={!!demoStep}
              className={scenarioStatus?.active ? 'btn-secondary' : 'btn-primary'}
              title="Controlled rain scenario: labelled simulated weather inputs, not observations">
              <Icon name="flask" size={14} />
              <span>
                {demoStep === 'ACTIVATING_SCENARIO' && 'ACTIVATING SCENARIO...'}
                {demoStep === 'REFRESHING_RISK' && 'REFRESHING RISK...'}
                {demoStep === 'ASSESSING_INCIDENTS' && 'ASSESSING INCIDENTS...'}
                {demoStep === 'PREPARING_RESPONSE' && 'PREPARING RESPONSE...'}
                {demoStep === 'DEMO_READY' && '✓ DEMO READY'}
                {!demoStep && (scenarioStatus?.active ? 'END RAIN SCENARIO' : 'RAIN SCENARIO (SIMULATED)')}
              </span>
            </button>

            <ThemeSelector />
          </div>
        </header>

        {/* Controlled Scenario Banner */}
        {scenarioStatus?.active && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-1.5 flex flex-wrap gap-x-4 justify-between items-center text-xs font-semibold shrink-0 z-10">
            <div className="flex items-center gap-2">
              <Icon name="flask" size={14} className="text-amber-700" />
              <span>CONTROLLED DEMONSTRATION SCENARIO — NOT LIVE OBSERVATION</span>
            </div>
            <div className="text-[11px] font-mono text-amber-800">
              {scenarioStatus.config?.label || 'Controlled scenario'}
              {typeof scenarioStatus.config?.precipitation_mm === 'number' && ` · precipitation ${scenarioStatus.config.precipitation_mm} mm`}
              {typeof scenarioStatus.config?.blockage_percent === 'number' && ` · drainage blockage ${scenarioStatus.config.blockage_percent}%`}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 1: EOC OVERVIEW DASHBOARD                               */}
        {/* ============================================================ */}
        {activeTab === 'overview' && (
          <div className="flex-1 min-h-0 overflow-y-auto xl:overflow-hidden bg-canvas p-3 flex flex-col gap-3">

            {/* Operational summary (COP summary contract + active mission record) and data sources */}
            <section className="panel px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 shrink-0" aria-label="Operational summary">
              {copError && copData && (
                <span className="chip-bad" title={`Last refresh failed: ${copError}`}>STALE SNAPSHOT · {new Date(copData.generated_at).toLocaleTimeString()}</span>
              )}
              <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                {[
                  ['Active threats', copData?.summary?.active_threat_count, 'bad'],
                  ['Monitored routes', copData?.summary?.monitored_route_count, null],
                  ['Compromised routes', copData?.summary?.invalidated_route_count, 'bad'],
                  ['Awaiting operator', missionState?.detail ? (missionState.detail.recommendations || []).filter(r => r.status === 'PENDING').length : undefined, 'warn'],
                  ['Active evidence', copData?.summary?.active_evidence_count, null],
                ].map(([label, value, tone]) => (
                  <div key={label} className="flex items-baseline gap-1.5" title={label === 'Awaiting operator' ? 'Pending recommendations on the active mission' : 'From the COP summary'}>
                    <dd className={`text-lg font-semibold font-mono leading-none ${
                      typeof value !== 'number' ? 'text-slate-400' : value > 0 && tone === 'bad' ? 'text-red-700' : value > 0 && tone === 'warn' ? 'text-amber-700' : 'text-slate-900'
                    }`}>{typeof value === 'number' ? value : '–'}</dd>
                    <dt className="text-[11px] text-slate-500">{label}</dt>
                  </div>
                ))}
              </dl>
              <div className="xl:ml-auto min-w-0">
                <DataSourceStrip copData={copData} copError={copError} systemStatus={systemStatus} />
              </div>
            </section>

            <DecisionChain mission={missionState} copData={copData} />

            {/* Map first in the DOM so narrower layouts lead with it */}
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-[17rem_minmax(0,1fr)_24rem] xl:[grid-template-rows:minmax(0,1fr)] xl:flex-1 xl:min-h-0">

              <div className="panel overflow-hidden relative md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1 h-[58vh] min-h-[420px] xl:h-auto xl:min-h-0">
                <MapComponent
                  onRouteCalculated={setRouteInfo}
                  floodOverlay={floodOverlay}
                  showIncidents={layers.incidents}
                  showRisk={layers.risk}
                  showResources={layers.resources}
                  showFieldUnits={layers.fieldUnits}
                  showSatellite={layers.satellite}
                  incidents={incidents}
                  resources={resources}
                  fieldUnits={fieldUnits}
                  copData={copData}
                  copError={copError}
                  copEnabled={true}
                  replacementRoute={proposedRoute}
                />
              </div>

              {/* Threat queue, linked evidence and the selected threat's record timeline */}
              <div className="xl:col-start-1 xl:row-start-1 flex flex-col gap-3 min-h-0 h-[560px] xl:h-auto">
                {copLoading ? (
                  <div className="panel p-4 text-xs text-slate-500">Loading COP…</div>
                ) : copError && !copData ? (
                  <div className="panel p-3 text-xs text-red-800 bg-red-50 border-red-200">
                    <div className="font-semibold mb-0.5">COP unavailable</div>
                    The backend could not be reached ({copError}). Nothing is shown until it responds.
                  </div>
                ) : (
                  <>
                    {copError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800">
                        STALE — last refresh failed ({copError}). Showing snapshot from {new Date(copData.generated_at).toLocaleTimeString()}.
                      </div>
                    )}
                    <div className="flex-1 min-h-0">
                      <ThreatPanel
                        threats={copData?.threats || []}
                        onSelectThreat={(t) => handleSelectIncident({
                          incident_id: t.id,
                          title: t.title,
                          severity: t.severity,
                          status: t.status,
                          latitude: t.latitude,
                          longitude: t.longitude,
                          hazard_type: t.category,
                          description: t.description
                        })}
                        selectedThreatId={selectedIncident?.incident_id}
                      />
                    </div>
                    <SelectedThreatEvidence copData={copData} threatId={selectedIncident?.incident_id}
                      timeline={selectedIncidentDetail?.incident_id === selectedIncident?.incident_id ? selectedIncidentDetail?.timeline : null} />
                  </>
                )}
              </div>

              {/* Active mission (primary decision surface) and field units */}
              <div className="xl:col-start-3 xl:row-start-1 min-h-0 h-[560px] xl:h-auto overflow-y-auto flex flex-col gap-3">
                <MissionPanel
                  copData={copData}
                  refreshCop={refreshCop}
                  showToast={showToast}
                  onProposedRoute={setProposedRoute}
                  onMissionChange={setMissionRoute}
                  onStateChange={setMissionState}
                />

                <details className="panel group shrink-0">
                  <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-2">
                    <span className="panel-title flex items-center gap-1.5">
                      <Icon name="users" size={14} /> Field units{fieldUnits.some(u => u.demo) ? ' · demo roster' : ''}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-slate-500">
                      {fieldUnits.filter(u => ['EN_ROUTE', 'AT_SCENE', 'OPERATING'].includes(fieldUnitStates[u.field_unit_id] || u.status)).length} en route / on scene
                      <Icon name="chevronDown" size={14} className="transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="px-3 pb-3 space-y-1.5 text-xs">
                    <p className="text-[10px] text-slate-500">Positions are manual or seeded updates — there is no live GPS feed.</p>
                    {fieldUnits.length === 0 ? (
                      <div className="text-slate-500 text-[11px]">No field units registered.</div>
                    ) : fieldUnits.map(fu => {
                      const st = fieldUnitStates[fu.field_unit_id] || fu.status || 'UNKNOWN';
                      return (
                        <div key={fu.field_unit_id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{fu.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {fu.unit_type} · {fu.city || fu.district || 'location unknown'} · incident: {incidents.find(i => i.incident_id === fu.incident_id)?.title || 'none'}
                            </div>
                          </div>
                          <span className={st === 'EN_ROUTE' ? 'chip-info' : st === 'AT_SCENE' || st === 'OPERATING' ? 'chip-warn' : st === 'COMPLETED' ? 'chip-ok' : 'chip-muted'}>{st}</span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: INCIDENT COMMAND DASHBOARD                            */}
        {/* ============================================================ */}
        {activeTab === 'incidents' && (
          <div className="flex-1 p-4 overflow-hidden bg-canvas">
            <IncidentCenter
              onClose={() => setActiveTab('overview')}
              sharedSelectedIncident={selectedIncident}
              onSelectIncident={inc => {
                setSelectedIncident(inc);
                fetchIncidentDetail(inc.incident_id);
              }}
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: FIELD OPERATIONS DASHBOARD WITH COMPLETE AUDIT TRAIL  */}
        {/* ============================================================ */}
        {activeTab === 'field' && (
          <div className="flex-1 p-4 overflow-y-auto bg-canvas text-xs space-y-4">
            <div className="panel px-4 py-3 flex flex-wrap gap-3 justify-between items-center">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Icon name="users" size={18} className="text-accent" /> Field Operations</h2>
                <div className="text-[11px] text-slate-500 mt-0.5">Unit status changes are validated by the backend · positions are manual/seeded (no live GPS) · incident audit trail</div>
              </div>
              <button
                onClick={submitFieldTeamReport}
                title="Creates a SIMULATED field-team report on the active mission route"
                className="btn bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
              >
                <Icon name="flask" size={14} />
                SIMULATE FIELD REPORT: ROAD BLOCKED
              </button>
            </div>

            {/* Active Response Units Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fieldUnits.map(fu => {
                const st = fieldUnitStates[fu.field_unit_id] || fu.status || 'UNKNOWN';
                return (
                  <div key={fu.field_unit_id} className="bg-white border border-line p-4 rounded-md space-y-2.5 shadow-sm">
                    <div className="flex justify-between items-center border-b border-line pb-2">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <Icon name="users" size={14} className="text-slate-500" />
                        {fu.name}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 font-bold rounded border ${
                        st === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-blue-50 text-accent border-blue-200'
                      }`}>
                        {st}
                      </span>
                    </div>
                    <div className="text-slate-700"><b>Type:</b> {fu.unit_type}</div>
                    <div className="text-slate-700"><b>Linked incident:</b> {incidents.find(i => i.incident_id === fu.incident_id)?.title || 'none'}</div>
                    <div className="text-slate-700"><b>Current Location:</b> {fu.city || fu.district}</div>

                    {/* Unit State Machine Action Buttons */}
                    <div className="pt-2 border-t border-line grid grid-cols-2 gap-1.5">
                      <button onClick={() => handleUpdateUnitState(fu.field_unit_id, 'EN_ROUTE')} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold p-1.5 rounded text-[10px] border border-slate-300">
                        START TRIP
                      </button>
                      <button onClick={() => handleUpdateUnitState(fu.field_unit_id, 'AT_SCENE')} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold p-1.5 rounded text-[10px] border border-slate-300">
                        ARRIVED SCENE
                      </button>
                      <button
                        onClick={() => {
                          handleUpdateUnitState(fu.field_unit_id, 'OPERATING');
                          setActiveOperationModal(fu);
                        }}
                        className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold p-1.5 rounded text-[10px] border border-purple-300"
                      >
                        START OPERATION
                      </button>
                      <button onClick={() => handleUpdateUnitState(fu.field_unit_id, 'COMPLETED')} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold p-1.5 rounded text-[10px]">
                        COMPLETE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Field Incident Audit Table (Detected, Acknowledged, Assessing, Escalated, Resolved) */}
            <div className="bg-white border border-line rounded-md p-4 space-y-3 shadow-sm">
              <div className="font-extrabold text-xs text-accent uppercase tracking-wider border-b border-line pb-2 flex justify-between items-center">
                <span>FIELD INCIDENT AUDIT & STATUS TRACKING</span>
                <span className="text-[10px] text-slate-500 font-mono">TOTAL INCIDENTS: {incidents.length}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600">
                      <th className="p-2">INCIDENT TITLE</th>
                      <th className="p-2">LOCATION</th>
                      <th className="p-2">HAZARD TYPE</th>
                      <th className="p-2">SEVERITY</th>
                      <th className="p-2">STATUS</th>
                      <th className="p-2">ASSIGNED TEAM</th>
                      <th className="p-2">EVIDENCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc, idx) => (
                      <tr key={inc.incident_id} className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-2 font-bold text-slate-900">{inc.title}</td>
                        <td className="p-2 text-slate-700">{inc.district}, {inc.state}</td>
                        <td className="p-2 text-accent font-medium">{inc.hazard_type}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black text-white ${
                            inc.severity === 'CRITICAL' ? 'bg-red-700' : 'bg-amber-600'
                          }`}>
                            {inc.severity}
                          </span>
                        </td>
                        <td className="p-2 font-bold text-slate-800">{inc.status}</td>
                        <td className="p-2 text-slate-700">{fieldUnits.filter(u => u.incident_id === inc.incident_id).map(u => u.name).join(', ') || '—'}</td>
                        <td className="p-2 font-mono text-[10px] text-slate-700">{(() => { const n = (copData?.evidence || []).filter(e => e.threat_id === inc.incident_id).length; return n ? `${n} evidence record${n > 1 ? 's' : ''}` : 'none'; })()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Real timeline of the selected incident (backend record) */}
            <div className="bg-white border border-line rounded-md p-4 space-y-3 shadow-sm">
              <div className="font-extrabold text-xs text-accent uppercase tracking-wider border-b border-line pb-2">
                INCIDENT TIMELINE {selectedIncidentDetail?.title ? `— ${selectedIncidentDetail.title}` : ''}
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[11px] pr-1">
                {selectedIncidentDetail?.timeline?.length ? selectedIncidentDetail.timeline.map((evt, idx) => (
                  <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200 text-slate-800">
                    <span className="text-slate-500 font-bold">{new Date(evt.timestamp).toLocaleTimeString()}</span> — <span className="font-bold text-accent">{evt.event_type}</span>: {evt.description}
                  </div>
                )) : <div className="text-slate-400 italic">Select an incident (Overview threat list or Incidents tab) to see its recorded timeline.</div>}
              </div>
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: WEATHER & PREPAREDNESS DASHBOARD                     */}
        {/* ============================================================ */}
        {activeTab === 'weather' && (
          <div className="flex-1 flex flex-col p-4 bg-canvas overflow-y-auto">
            <WeatherDashboard onSelectTab={setActiveTab} isScenarioActive={scenarioStatus?.active} />
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: SATELLITE INTELLIGENCE DASHBOARD                      */}
        {/* ============================================================ */}
        {activeTab === 'satellite' && (
          <div className="flex-1 flex flex-col p-4 bg-canvas gap-3 overflow-hidden">
            <div className="panel px-4 py-3 flex flex-wrap gap-3 justify-between items-center shrink-0">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Icon name="satellite" size={18} className="text-accent" /> Satellite</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">NASA GIBS VIIRS SNPP true-colour tiles over Hubballi-Dharwad (native resolution coarse at city scale). Imagery is displayed for context only — it is not analysed.</p>
              </div>
              <span className="chip-muted">Freshness: unknown (latest available GIBS tiles)</span>
            </div>

            <div className="flex-1 bg-white border border-line rounded-md overflow-hidden relative shadow-sm">
              <MapComponent
                showSatellite={true}
                satLayers={satLayers}
                incidents={incidents}
                fieldUnits={fieldUnits}
              />
            </div>
          </div>
        )}

        {/* VIDEO INTELLIGENCE: additive video analysis workflow */}
        {activeTab === 'video' && <VideoIntelligence />}

        {/* ============================================================ */}
        {/* TAB 5: NATIONAL RISK DASHBOARD                              */}
        {/* ============================================================ */}
        {activeTab === 'national' && (
          <div className="flex-1 relative overflow-hidden bg-canvas">
            <NationalView />
          </div>
        )}

      </div>

    </div>
  );
}

// Evidence linked to the threat selected in the left panel (COP canonical evidence),
// plus that threat record's backend timeline when it has been loaded.
function SelectedThreatEvidence({ copData, threatId, timeline }) {
  const threat = (copData?.threats || []).find((t) => t.id === threatId);
  if (!threat) {
    return (
      <div className="panel px-3 py-2.5 text-[11px] text-slate-500 shrink-0">
        Select a threat to inspect its linked evidence and record timeline.
      </div>
    );
  }
  const evidence = (copData?.evidence || []).filter((e) => e.threat_id === threat.id);
  return (
    <div className="panel px-3 py-2.5 text-[11px] space-y-2 shrink-0 max-h-[45%] overflow-y-auto">
      <div>
        <div className="panel-title flex items-center gap-1.5"><Icon name="link" size={13} /> Linked evidence</div>
        <div className="mt-0.5 text-slate-600">
          <span className="font-mono text-slate-800">{threat.id}</span> · {threat.status} · source {threat.source || 'unknown'}
          {threat.is_demo && <span className="text-amber-700 font-semibold"> · DEMO/SIMULATED</span>}
        </div>
      </div>
      {evidence.length === 0 ? (
        <div className="text-slate-500">No evidence records are linked to this threat.</div>
      ) : evidence.map((e) => (
        <div key={e.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-0.5">
          <div className="flex justify-between gap-1">
            <b className="font-mono text-slate-900 truncate">{e.id}</b>
            {e.is_simulation && <span className="chip-warn">SIMULATED</span>}
          </div>
          <div className="text-slate-700">{e.source_type} {e.source_id || ''} · {e.observation_type}</div>
          {e.description && <div className="text-slate-600">{e.description}</div>}
          <div className="text-slate-500">Source-declared confidence {Math.round(e.confidence * 100)}% · {new Date(e.timestamp).toLocaleTimeString()}</div>
        </div>
      ))}
      {timeline?.length > 0 && (
        <div>
          <div className="panel-title flex items-center gap-1.5 mb-1"><Icon name="clock" size={13} /> Threat record timeline</div>
          <ol className="space-y-1 border-l border-slate-200 pl-2.5">
            {timeline.map((evt, idx) => (
              <li key={idx} className="text-slate-700">
                <span className="font-mono text-[10px] text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</span>{' '}
                <span className="font-semibold text-accent">{evt.event_type}</span>{evt.description ? ` — ${evt.description}` : ''}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
