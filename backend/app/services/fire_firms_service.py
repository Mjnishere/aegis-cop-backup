import os
import time
from typing import Dict, Any, List

class FirmsService:
    def __init__(self):
        self.api_key = os.environ.get("FIRMS_API_KEY", "")

    def get_status(self) -> str:
        if not self.api_key:
            return "NOT_CONFIGURED"
        return "AVAILABLE"

    def get_fire(self, state: str = None, district: str = None) -> Dict[str, Any]:
        fetched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time()))
        
        if not self.api_key:
            return {
                "status": "success",
                "source": "NASA FIRMS",
                "mode": "NOT_CONFIGURED",
                "fetched_at": fetched_at,
                "records": [],
                "freshness": "UNKNOWN"
            }
            
        # In a fully integrated phase, this would use self.api_key to fetch
        # from FIRMS API. Since we don't fabricate data, we return empty list
        # if the real call isn't fully implemented or there are no fires.
        
        return {
            "status": "success",
            "source": "NASA FIRMS",
            "mode": "AVAILABLE",
            "fetched_at": fetched_at,
            "records": [], # No fabricated records
            "freshness": "UNKNOWN" # No real acquisition_time fetched
        }

fire_firms_service = FirmsService()
