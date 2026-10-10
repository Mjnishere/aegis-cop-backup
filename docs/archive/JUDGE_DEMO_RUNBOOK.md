# ResilienceRoute - Judge Demo Runbook

> **Historical document (pre-AEGIS, September 2026).** Several statements are now stale (e.g. state is partly persisted in SQLite since Phase 1B; test claims were not re-verified). Current status: [`docs/project/IMPLEMENTATION_STATUS.md`](project/IMPLEMENTATION_STATUS.md).

This guide provides a step-by-step walkthrough to successfully run the ResilienceRoute demonstration scenario locally. The scenario showcases the complete end-to-end flow from weather-induced risk detection to citizen alert acknowledgement.

## 1. Prerequisites
- **Python 3.9+**
- **Node.js 18+**
- **Git**
- (Optional) Valid Open-Meteo, IMD, NASA GIBS, and MapmyIndia API Keys (System safely defaults to `NOT_CONFIGURED` or `SIMULATED` modes for demonstration if omitted).

## 2. Backend Command
Open a terminal and navigate to the project directory:
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Windows
# source venv/bin/activate # On Unix
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 3. Frontend Command
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
# The application will be available at http://localhost:3000
```

## 4. Health Check
Once both servers are running:
1. Open the browser to `http://localhost:3000`
2. You should see the National Risk map populated with Hubballi/Dharwad data.
3. Check the **Data Freshness** indicators in the UI. Unconfigured external providers will explicitly display `NOT_CONFIGURED` or `UNKNOWN FRESHNESS`—this is expected and safe behavior.

## 5. Demo Scenario: Extreme Flood Response
We will walk through the core demonstration of ResilienceRoute's capabilities.

### Step 1: Detect Weather Risk
1. In the bottom left **Control Panel**, click `Enable Flood Scenario`.
2. Notice the UI explicitly states: `CONTROLLED DEMONSTRATION SCENARIO` and `NOT LIVE OBSERVATION`.
3. The risk map updates to show **CRITICAL** risk in Hubballi due to the simulated 80mm/hr rainfall input.

### Step 2: Route Assessment & Replacement
1. The hazard-aware routing engine automatically detects that the active critical route is flooded.
2. A popup or timeline event will show: `Replacement route is recommended`.
3. Open **Open Incidents** (top right) -> find the `DEMO EXTREME FLOOD` incident.

### Step 3: Response Planning
1. Click the `DEMO EXTREME FLOOD` incident to expand it.
2. Click **Recommend Response Plan** under the Action panel.
3. The system generates resource requirements (e.g., Rescue Teams, Boats) and distances based on proximity using the haversine formula.
4. Click **APPROVE PLAN** (Requires EOC Operator action).
5. Click **SIMULATE DISPATCH**. The UI will remind you: `DEMO / SIMULATED RESPONSE. NO REAL RESOURCE HAS BEEN DISPATCHED`.

### Step 4: Field Operations & Evidence
1. The assigned field unit enters the `EN_ROUTE` -> `AT_SCENE` status.
2. Under the **FIELD OPERATIONS** tab, click **UPLOAD EVIDENCE (DEMO)**.
3. Input `flood_view.jpg`. The mock Computer Vision service will run, labeling it `FLOOD_WATER_VISIBLE`.
4. The system logs an `EVIDENCE_CONFIRMED` and subsequently triggers a `REASSESSMENT_RECOMMENDED` alert.

### Step 5: Citizen Safety & Alerts
1. Click **RUN ALERT WORKFLOW** in the `CITIZEN SAFETY & ALERTS` section.
2. The EOC automatically targets citizens within a 15km radius, creates a draft, approves it, and initiates a simulated send (using the Mock Provider).
3. On the map view, toggle **Target Citizens**. Click **OPEN CITIZEN APP**.
4. The simulated mobile app appears. The target citizen will see the warning and the preparedness checklist.
5. Click **ACKNOWLEDGE ALERT** inside the Citizen App.
6. Check the EOC Dashboard or Incident Timeline: The status updates to `ALERT_ACKNOWLEDGED`.

## 6. Fallback / Expected Behavior
- **No IMD Keys:** The system gracefully handles the lack of IMD API tokens. IMD data falls back to `NOT_CONFIGURED`.
- **No SMS Provider (Twilio) Keys:** Alert sends will transition to `SENT` via `MOCK PROVIDER`. The system explicitly will not fake a real delivery status.

## 7. Reset Instructions
ResilienceRoute currently utilizes an MVP In-Memory State. 
To completely reset the scenario:
1. Stop the FastAPI process (`Ctrl+C`).
2. Restart Uvicorn: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`.
3. Refresh the React Frontend (`F5`). All demo states, simulated dispatches, and mock alerts are cleared.

## 8. Troubleshooting
- **Connection Refused:** Ensure `uvicorn` is running on port 8000 and `npm run dev` points to `127.0.0.1:8000`.
- **Map Not Loading:** Ensure you have internet access (Leaflet tiles require OSM connectivity).
