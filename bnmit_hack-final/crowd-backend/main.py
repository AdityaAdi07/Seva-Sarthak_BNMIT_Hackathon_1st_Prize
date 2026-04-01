from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import random
import json
import joblib
from pydantic import BaseModel
import os
import shutil

from detection import CrowdDetector, GateTracker

# Create uploads directory for video files
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI(title="Bengaluru Crowd Management API")

# Allow CORS for real-time frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HOTSPOTS = [
    "Commercial Street", "MG Road", "Brigade Road", "Indiranagar", 
    "Koramangala", "UB City", "VV Puram Food Street", "Lalbagh Botanical Garden", 
    "Cubbon Park", "ISKCON", "Bull Temple", "Ranga Shankara", "Fun World"
]

HOTSPOTS_COORDS = {
  "Commercial Street": [12.9822, 77.6083],
  "MG Road": [12.9716, 77.5946],
  "Brigade Road": [12.9738, 77.6075],
  "Indiranagar": [12.9784, 77.6408],
  "Koramangala": [12.9279, 77.6271],
  "UB City": [12.9719, 77.5960],
  "VV Puram Food Street": [12.9482, 77.5756],
  "Lalbagh Botanical Garden": [12.9507, 77.5848],
  "Cubbon Park": [12.9779, 77.5952],
  "ISKCON": [13.0098, 77.5511],
  "Bull Temple": [12.9366, 77.5683],
  "Ranga Shankara": [12.9238, 77.5855],
  "Fun World": [13.0076, 77.5902]
}

import urllib.request
import urllib.parse
import json

GOOGLE_MAPS_API_KEY = "AIzaSyABBjCZkcODLrGPH8Kjivc3CEaF2TnpQuQ"

# ========================
# YOLO Crowd Detection 
# ========================
detector = None  # Will be initialized on demand

@app.post("/detection/upload-video")
async def upload_detection_video(file: UploadFile = File(...)):
    """Upload a video file for crowd detection."""
    file_path = os.path.join(UPLOADS_DIR, f"detection_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"status": "uploaded", "path": file_path, "filename": file.filename}

@app.post("/detection/start")
def start_detection(
    source: str = Query(default="0", description="0 for webcam, path to video file, or RTSP URL"),
    confidence: float = Query(default=0.35, description="YOLO confidence threshold")
):
    """Start the YOLO crowd detection on a given source."""
    global detector
    
    if detector and detector.running:
        return {"status": "already_running", "message": "Detection is already active.", **detector.get_status()}
    
    # Convert "0" string to int 0 for webcam
    actual_source = int(source) if source.isdigit() else source
    
    detector = CrowdDetector(source=actual_source, confidence=confidence)
    detector.start()
    
    return {"status": "started", "source": str(actual_source), "message": "YOLO detection started!"}

@app.post("/detection/stop")
def stop_detection():
    """Stop the YOLO crowd detection."""
    global detector
    if detector:
        detector.stop()
        detector = None
        return {"status": "stopped", "message": "Detection stopped."}
    return {"status": "not_running", "message": "No detection was running."}

@app.get("/detection/status")
def detection_status():
    """Get current YOLO detection status (person count, density, fps)."""
    if detector and detector.running:
        return {"status": "running", **detector.get_status()}
    return {"status": "not_running", "person_count": 0, "density_level": "N/A"}

@app.get("/detection/video-feed")
def video_feed():
    """Live MJPEG video stream of YOLO-annotated frames."""
    def generate_frames():
        while detector and detector.running:
            frame = detector.get_frame()
            if frame:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                )
            import time
            time.sleep(0.05)  # ~20fps max stream rate
    
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# ========================
# Tracker Component Endpoints
# ========================
gate_tracker = None

@app.post("/gate/upload-video")
async def upload_gate_video(file: UploadFile = File(...)):
    """Upload a video file for gate tracking."""
    file_path = os.path.join(UPLOADS_DIR, f"gate_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"status": "uploaded", "path": file_path, "filename": file.filename}

@app.post("/gate/start")
def start_gate_tracking(source: str = Query(default="0", description="Source for gate tracking"), line_y: int = Query(default=300)):
    global gate_tracker
    if gate_tracker and gate_tracker.running:
        return {"status": "already_running"}
    actual_source = int(source) if source.isdigit() else source
    gate_tracker = GateTracker(source=actual_source, line_y=line_y)
    gate_tracker.start()
    return {"status": "started"}

@app.post("/gate/stop")
def stop_gate_tracking():
    global gate_tracker
    if gate_tracker:
        gate_tracker.stop()
        gate_tracker = None
        return {"status": "stopped"}
    return {"status": "not_running"}

@app.get("/gate/status")
def gate_status():
    if gate_tracker and gate_tracker.running:
        return {"status": "running", **gate_tracker.get_status()}
    return {"status": "not_running", "counts": {}}

@app.get("/gate/video-feed")
def gate_video_feed():
    def generate_frames():
        while gate_tracker and gate_tracker.running:
            frame = gate_tracker.get_frame()
            if frame:
                yield (b"--frame\r\n" b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
            import time
            time.sleep(0.05)
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")


def get_live_traffic_multiplier(destination: str):
    """
    Queries Google maps from Majestic Bus Stand to the target hotspot 
    to calculate current traffic delays vs normal time.
    """
    origin_encoded = urllib.parse.quote("Majestic Bus Stand, Bengaluru")
    dest_encoded = urllib.parse.quote(f"{destination}, Bengaluru")
    
    url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={origin_encoded}&destinations={dest_encoded}&departure_time=now&key={GOOGLE_MAPS_API_KEY}"
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            element = data['rows'][0]['elements'][0]
            
            if element['status'] == 'OK' and 'duration_in_traffic' in element:
                standard_time = element['duration']['value']
                traffic_time = element['duration_in_traffic']['value']
                
                # Calculate ratio (e.g. 1.5 means 50% longer due to traffic)
                return max(1.0, float(traffic_time) / float(standard_time))
            
            return 1.0
    except Exception as e:
        print("Google API Error:", e)
        return 1.0

@app.get("/api/live-traffic/{location}")
def get_live_traffic(location: str):
    multiplier = get_live_traffic_multiplier(location)
    status = "Normal"
    if multiplier > 1.25:
        status = "Heavy Traffic (Delayed)"
    elif multiplier > 1.05:
        status = "Moderate Congestion"
        
    return {
        "location": location, 
        "multiplier": round(multiplier, 2),
        "status": status
    }

@app.get("/")
def root():
    return {"message": "Welcome to the Bengaluru Crowd Management Platform API"}

# Density-based alert configuration
DENSITY_ALERTS = {
    "LOW": {
        "severity": "normal",
        "color": "green",
        "message": "Normal crowd levels — no action required.",
        "actions": ["Standard patrols active", "All sectors clear"]
    },
    "MEDIUM": {
        "severity": "moderate",
        "color": "yellow",
        "message": "Moderate crowd build-up detected — monitor closely.",
        "actions": ["Increase patrol frequency", "Alert nearby traffic police", "Monitor CCTV feeds actively"]
    },
    "HIGH": {
        "severity": "high",
        "color": "orange",
        "message": "HIGH crowd density — potential risk zone!",
        "actions": ["Deploy additional traffic police", "Activate crowd control barriers", "Alert medical units on standby", "Prepare evacuation routes"]
    },
    "CRITICAL": {
        "severity": "critical",
        "color": "red",
        "message": "CRITICAL OVERCROWDING — Immediate intervention needed!",
        "actions": ["Deploy riot control units", "Dispatch QRT immediately", "Activate PA system for crowd dispersal", "Alert all nearby hospitals", "Open emergency evacuation corridors"]
    }
}

POLICE_STATIONS = [
    "Cubbon Park Police Station", "Ashok Nagar Police Station", "Halasuru Police Station",
    "Indiranagar Police Station", "Koramangala Police Station", "Basavanagudi Police Station"
]

FIRE_STATIONS = [
    "High Grounds Fire Station", "Mayo Hall Fire Station", "Jayanagar Fire Station"
]

def generate_station_broadcast(location: str, density: str):
    """Generates a simulated broadcast log to nearby stations."""
    import time
    timestamp = time.strftime('%H:%M:%S')
    
    stations_contacted = random.sample(POLICE_STATIONS, 2) + random.sample(FIRE_STATIONS, 1) + ["Bowring Hospital", "Victoria Hospital"]
    random.shuffle(stations_contacted)
    
    log = []
    log.append(f"> [{timestamp}] AUTO-BROADCAST: {density} DENSITY AT {location.upper()}")
    
    for i, station in enumerate(stations_contacted[:3]):  # Show top 3 fastest responses
        eta = random.randint(3, 8)
        log.append(f"> [{timestamp}] {station} ... ACKNOWLEDGED (ETA: {eta} mins)")
        
    return log

# WebSocket Endpoint for Live Updates — POWERED BY YOLO WITH DENSITY-BASED ALERTS
@app.websocket("/ws/live-updates")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    previous_density = "LOW"
    alert_cooldowns = {"MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}  # cooldown counters
    tick = 0
    
    try:
        while True:
            tick += 1
            
            if detector and detector.running:
                # ===== REAL YOLO DATA =====
                status = detector.get_status()
                count = status["person_count"]
                density = status["density_level"]
                alert_config = DENSITY_ALERTS.get(density, DENSITY_ALERTS["LOW"])
                
                # Always send live status update with density info
                live_data = {
                    "type": "live_detection",
                    "person_count": count,
                    "density_level": density,
                    "fps": status["fps"],
                    "source": status["source"],
                    "severity": alert_config["severity"],
                    "alert_color": alert_config["color"],
                    "status_message": alert_config["message"],
                    "recommended_actions": alert_config["actions"]
                }
                await websocket.send_text(json.dumps(live_data))
                
                # Decrement cooldowns
                for key in alert_cooldowns:
                    if alert_cooldowns[key] > 0:
                        alert_cooldowns[key] -= 1
                
                # === DENSITY-BASED SURGE ALERTS ===
                
                # Alert when density ESCALATES (changes to a higher level)
                density_order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
                prev_idx = density_order.index(previous_density) if previous_density in density_order else 0
                curr_idx = density_order.index(density) if density in density_order else 0
                
                if curr_idx > prev_idx:
                    # Density escalated! Send alert
                    location = random.choice(HOTSPOTS)
                    surge_data = {
                        "type": "surge_alert",
                        "location": location,
                        "crowd_density": count,
                        "severity": alert_config["severity"],
                        "message": f"⚠ {alert_config['message']} ({count} persons detected)",
                        "real_count": count,
                        "density_level": density,
                        "recommended_actions": alert_config["actions"],
                        "alert_type": "escalation",
                        "transition": f"{previous_density} → {density}"
                    }
                    await websocket.send_text(json.dumps(surge_data))
                    
                    if density in ["HIGH", "CRITICAL"]:
                        # Send Automated Broadcast to Simulation UI
                        broadcast_data = {
                            "type": "broadcast_alert",
                            "location": location,
                            "density": density,
                            "log": generate_station_broadcast(location, density)
                        }
                        await websocket.send_text(json.dumps(broadcast_data))
                        
                    alert_cooldowns[density] = 15  # 30 second cooldown (15 ticks * 2s)
                
                # Continuous alerts for HIGH/CRITICAL (with cooldown to avoid spam)
                elif density == "CRITICAL" and alert_cooldowns["CRITICAL"] <= 0:
                    location = random.choice(HOTSPOTS)
                    surge_data = {
                        "type": "surge_alert",
                        "location": location,
                        "crowd_density": count,
                        "severity": "critical",
                        "message": f"🚨 CRITICAL: {count} persons detected! Immediate action required!",
                        "real_count": count,
                        "density_level": "CRITICAL",
                        "recommended_actions": DENSITY_ALERTS["CRITICAL"]["actions"],
                        "alert_type": "sustained_critical"
                    }
                    await websocket.send_text(json.dumps(surge_data))
                    
                    broadcast_data = {
                        "type": "broadcast_alert",
                        "location": location,
                        "density": density,
                        "log": generate_station_broadcast(location, density)
                    }
                    await websocket.send_text(json.dumps(broadcast_data))
                    
                    alert_cooldowns["CRITICAL"] = 10  # 20 second cooldown
                
                elif density == "HIGH" and alert_cooldowns["HIGH"] <= 0:
                    location = random.choice(HOTSPOTS)
                    surge_data = {
                        "type": "surge_alert",
                        "location": location,
                        "crowd_density": count,
                        "severity": "high",
                        "message": f"⚠ HIGH density persists: {count} persons in zone",
                        "real_count": count,
                        "density_level": "HIGH",
                        "recommended_actions": DENSITY_ALERTS["HIGH"]["actions"],
                        "alert_type": "sustained_high"
                    }
                    await websocket.send_text(json.dumps(surge_data))
                    alert_cooldowns["HIGH"] = 15  # 30 second cooldown
                
                # Alert when density DE-ESCALATES (good news)
                elif curr_idx < prev_idx and previous_density in ["HIGH", "CRITICAL"]:
                    surge_data = {
                        "type": "surge_alert",
                        "location": random.choice(HOTSPOTS),
                        "crowd_density": count,
                        "severity": "resolved",
                        "message": f"✅ Crowd dispersing: {previous_density} → {density} ({count} persons)",
                        "real_count": count,
                        "density_level": density,
                        "recommended_actions": ["Continue monitoring", "Maintain standby positions"],
                        "alert_type": "de_escalation",
                        "transition": f"{previous_density} → {density}"
                    }
                    await websocket.send_text(json.dumps(surge_data))
                
                previous_density = density
            else:
                # ===== FALLBACK: Simulated data when YOLO is not running =====
                if random.random() < 0.3:
                    sim_count = random.randint(5, 80)
                    sim_density = "CRITICAL" if sim_count >= 50 else "HIGH" if sim_count >= 25 else "MEDIUM" if sim_count >= 10 else "LOW"
                    sim_config = DENSITY_ALERTS.get(sim_density, DENSITY_ALERTS["LOW"])
                    surge_data = {
                        "type": "surge_alert",
                        "location": random.choice(HOTSPOTS),
                        "crowd_density": sim_count,
                        "severity": sim_config["severity"],
                        "message": f"{sim_config['message']} (Simulated: {sim_count} persons)",
                        "real_count": sim_count,
                        "density_level": sim_density,
                        "recommended_actions": sim_config["actions"],
                        "alert_type": "simulated"
                    }
                    await websocket.send_text(json.dumps(surge_data))
            
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        print("Client disconnected")

# Load ML Models if exists
model, le_loc, le_event = None, None, None
explainer = None
SHAP_ERR = None

if os.path.exists("models/rf_crowd_model.pkl"):
    model = joblib.load("models/rf_crowd_model.pkl")
    le_loc = joblib.load("models/le_loc.pkl")
    le_event = joblib.load("models/le_event.pkl")
    try:
        import shap
        explainer = shap.TreeExplainer(model)
        print(">>> SHAP XAI SYSTEM LOADED SUCCESSFULLY")
    except Exception as e:
        import traceback
        SHAP_ERR = traceback.format_exc()
        print("SHAP Load Error:", e)

class PredictionRequest(BaseModel):
    hour: int
    day_of_week: int
    is_weekend: int
    location: str
    event: str
    traffic_volume: int

@app.post("/predict-crowd")
def predict_crowd(req: PredictionRequest):
    if not model:
        return {"error": "Model not trained yet."}
    
    try:
        loc_encoded = le_loc.transform([req.location])[0]
        event_encoded = le_event.transform([req.event])[0]
        
        # Check LIVE Google Maps traffic congestion metric
        multiplier = get_live_traffic_multiplier(req.location)
        
        # Override and compound the requested traffic volume if the API detects massive live city delays
        final_traffic_volume = req.traffic_volume
        if multiplier > 1.1:
            final_traffic_volume = int(req.traffic_volume * (multiplier ** 2))
            print(f">>> GOOGLE MAPS DETECTED TRAFFIC DELAY: Multiplier = {multiplier:.2f}x! Scaling Traffic from {req.traffic_volume} to {final_traffic_volume}")

        import numpy as np
        features = np.array([[req.hour, req.day_of_week, req.is_weekend, loc_encoded, event_encoded, final_traffic_volume]])
        prediction = model.predict(features)[0]
        
        # Calculate SHAP explainability
        shap_data = []
        if explainer:
            try:
                sv = explainer.shap_values(features)[0]
                feature_names = ["Time of Day", "Day of Week", "Weekend Status", "Location Profile", "Event Gravity", "Live Traffic Volume"]
                
                for i, name in enumerate(feature_names):
                    shap_data.append({
                        "feature": name,
                        "impact": float(sv[i])
                    })
                shap_data = sorted(shap_data, key=lambda x: abs(x["impact"]), reverse=True)
            except Exception as e:
                import traceback
                shap_data.append({"feature": "SHAP_PARSE_ERR", "impact": str(traceback.format_exc())})
        else:
            shap_data.append({"feature": "SHAP_LOAD_ERR", "impact": str(SHAP_ERR)})
        
        return {
            "predicted_crowd_density": int(prediction),
            "severity": "critical" if prediction > 80000 else "high" if prediction > 30000 else "normal",
            "shap_explainability": shap_data
        }
    except Exception as e:
        return {"error": str(e)}

class AllocationRequest(BaseModel):
    total_personnel: int
    crowd_density: int
    severity: str
    location: str

import math

MEDICAL_BASES = [
  { "id": 'H1', "name": 'Bowring and Lady Curzon Hospital', "lat": 12.9818, "lng": 77.6015, "contact": '080-2559-1362' },
  { "id": 'H2', "name": 'Fortis Hospital (Cunningham Rd)', "lat": 12.9862, "lng": 77.5959, "contact": '080-4199-4444' },
  { "id": 'H3', "name": 'Victoria Hospital', "lat": 12.9580, "lng": 77.5710, "contact": '080-2670-1150' },
  { "id": 'H4', "name": 'St John Medical College', "lat": 12.9304, "lng": 77.6189, "contact": '080-2206-5000' },
  { "id": 'H5', "name": 'Chinmaya Mission Hospital', "lat": 12.9782, "lng": 77.6385, "contact": '080-2528-0461' },
  { "id": 'H6', "name": 'Manipal Hospital', "lat": 12.9591, "lng": 77.6407, "contact": '080-4502-4444' },
  { "id": 'H7', "name": 'Apollo Cradle', "lat": 12.9351, "lng": 77.6245, "contact": '080-4030-2222' },
  { "id": 'H8', "name": 'NIMHANS', "lat": 12.9377, "lng": 77.5947, "contact": '080-2699-5000' },
]

@app.post("/allocate-resources")
def allocate_resources(req: AllocationRequest):
    if req.severity == "critical":
        traffic_police = int(req.total_personnel * 0.3)
        riot_control = int(req.total_personnel * 0.4)
        medical_response = req.total_personnel - traffic_police - riot_control
    elif req.severity == "high":
        traffic_police = int(req.total_personnel * 0.4)
        riot_control = int(req.total_personnel * 0.2)
        medical_response = req.total_personnel - traffic_police - riot_control
    else:
        traffic_police = int(req.total_personnel * 0.6)
        riot_control = int(req.total_personnel * 0.1)
        medical_response = req.total_personnel - traffic_police - riot_control
        
    deployments = []
    base_lat, base_lng = HOTSPOTS_COORDS.get(req.location, [12.9716, 77.5946])
    
    def scatter(lat, lng):
        r = 0.005 * math.sqrt(random.random())
        theta = random.random() * 2 * math.pi
        return round(lat + r * math.cos(theta), 6), round(lng + r * math.sin(theta), 6)
        
    pid = 1
    for count, tag in [(traffic_police, "Traffic Police"), (riot_control, "Riot Control"), (medical_response, "Medical Unit")]:
        for _ in range(count):
            plat, plng = scatter(base_lat, base_lng)
            deployments.append({
                "id": f"UNIT-{pid}",
                "role": tag,
                "lat": plat,
                "lng": plng
            })
            pid += 1

    ambulances = []
    amb_count = 5 if req.severity == "critical" else 3 if req.severity == "high" else 1
    for i in range(1, amb_count + 1):
        r = 0.008 * math.sqrt(random.random())
        theta = random.random() * 2 * math.pi
        ambulances.append({
            "id": f"AMB-{i}",
            "role": "Ambulance Station",
            "lat": round(base_lat + r * math.cos(theta), 6),
            "lng": round(base_lng + r * math.sin(theta), 6)
        })
        
    def haversine(lat1, lon1, lat2, lng2):
        R = 6371
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lng2 - lon1)
        a = math.sin(dLat/2) * math.sin(dLat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dLon/2) * math.sin(dLon/2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
        
    nearest_hospitals = []
    for h in MEDICAL_BASES:
        dist = haversine(base_lat, base_lng, h["lat"], h["lng"])
        eta = max(1, int((dist / 30) * 60))
        nearest_hospitals.append({
            "name": h["name"],
            "contact": h["contact"],
            "distance": round(dist, 1),
            "eta": eta,
            "capacity": random.randint(40, 95),
            "active_units": random.randint(1, 4)
        })
    nearest_hospitals = sorted(nearest_hospitals, key=lambda x: x["distance"])[:3]

    return {
        "strategy": {
            "traffic_police_count": traffic_police,
            "riot_control_count": riot_control,
            "medical_response_count": medical_response,
            "deployments": deployments,
            "ambulances": ambulances,
            "nearest_hospitals": nearest_hospitals,
            "recommended_precautions": [
                "Deploy drones for aerial surveillance." if req.severity in ["high", "critical"] else "Standard patrols.",
                "Erect temporary barricades." if req.severity == "critical" else "Keep emergency lanes open."
            ]
        }
    }

class DispatchRequest(BaseModel):
    location: str

@app.post("/dispatch-qrt")
def dispatch_qrt(req: DispatchRequest):
    base_lat, base_lng = HOTSPOTS_COORDS.get(req.location, [12.9716, 77.5946])
    
    base = random.choice(MEDICAL_BASES)
    
    def haversine(lat1, lon1, lat2, lng2):
        R = 6371  
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lng2 - lon1)
        a = math.sin(dLat/2) * math.sin(dLat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dLon/2) * math.sin(dLon/2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
        
    dist = haversine(base_lat, base_lng, base["lat"], base["lng"])
    eta = max(1, int((dist / 40) * 60))
    
    return {
        "status": "DISPATCHED",
        "team_id": f"QRT-Alpha-{random.randint(10, 99)}",
        "origin_base": base["name"],
        "destination": req.location,
        "eta_mins": eta,
        "personnel_count": random.randint(4, 12)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
