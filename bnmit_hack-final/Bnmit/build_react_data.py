import os
import glob
import random
import json
import re

base_dir = r"c:\Users\sushm\OneDrive\Desktop\llm_engineering-main\Bnmit"
svg_dir = os.path.join(base_dir, "SVG renderer")
svg_files = [f for f in os.listdir(svg_dir) if f.endswith('.svg')]

known_coords = {
    "ADUGODI": [12.9431, 77.6083],
    "BANASHANKARI": [12.9255, 77.5468],
    "BNSK": [12.9255, 77.5468],
    "HENNUR": [12.9997, 77.6223],
    "WIPRO": [12.8447, 77.6631],
    "SHIVAJINAGAR": [12.9904, 77.6082],
    "JOHNSON": [12.9647, 77.6052],
    "HOODI": [12.9908, 77.7126],
    "RAMAMURTHY": [13.0163, 77.6785],
    "K_R_MARKET": [12.9650, 77.5760],
    "MICO": [12.9103, 77.6015],
    "YESHVANTAPUR": [13.0334, 77.5584],
    "JAYANAGAR": [12.9200, 77.5950],
    "YAMALUR": [12.9463, 77.6832],
    "KORAMANGALA": [12.9372, 77.6269],
    "KORM": [12.9372, 77.6269],
    "R_T_NAGAR": [13.0245, 77.5958],
    "RAJAJINAGAR": [13.0185, 77.5372],
    "DICKENSON": [12.9818, 77.6163],
    "WILSON": [12.9490, 77.5992],
    "AIRPORT": [12.9592, 77.6406],
    "ASHOK": [12.9660, 77.5960],
    "RICHMOND": [12.9654, 77.5975],
    "KAMMANAHALLI": [13.0083, 77.6367],
    "CENTRAL": [12.9602, 77.5746],
    "ULSOOR": [12.9723, 77.5855],
    "KATRIGUPPE": [12.9277, 77.5516],
    "CUBBON": [12.9715, 77.5956],
    "WHITEFIELD": [12.9841, 77.7501],
    "ITTAMADU": [12.9216, 77.5458],
    "MADIWALA": [12.9213, 77.6186],
    "KENGERI": [12.9150, 77.4831],
    "VIJAYANAGAR": [12.9926, 77.5387],
    "PEENYA": [13.0315, 77.5218],
    "MALLESHWARAM": [13.0068, 77.5702],
    "INDRANAGAR": [12.9784, 77.6408],
    "BASVANGUDI": [12.9421, 77.5755],
    "GURUGUNTA": [13.0285, 77.5409]
}

center_lat, center_lon = 12.9716, 77.5946

# Read all json files
json_data_map = {}
for j_file in glob.glob(os.path.join(svg_dir, "*_junctions.json")):
    try:
        with open(j_file, 'r') as f:
            j_data = json.load(f)
            prefix = os.path.basename(j_file).split("_junctions")[0]
            json_data_map[prefix] = j_data
    except Exception:
        pass

import csv

csv_file = os.path.join(base_dir, "Banglore_traffic_Dataset.csv")
traffic_map = {}
if os.path.exists(csv_file):
    with open(csv_file, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            area = row.get("Area Name", "").upper()
            road = row.get("Road/Intersection Name", "").upper()
            vol = float(row.get("Traffic Volume", "10000"))
            weather = row.get("Weather Conditions", "Clear")
            traffic_map[area] = {"vol": vol, "weather": weather}
            traffic_map[road] = {"vol": vol, "weather": weather}

junctions_data = []
for idx, svg in enumerate(svg_files):
    lat, lon = None, None
    upper_name = svg.upper()
    prefix = svg.split("_")[0].title()
    shortTitle = svg.replace(".svg", "")
    
    if "_" in shortTitle:
        parts = shortTitle.split("_")
        # If it's a generic "Junction_1", append the number
        if len(parts) >= 3 and parts[1] == "Junction":
            shortTitle = f"{prefix} (Junction {parts[2]})"
        elif len(parts) >= 2 and parts[1].startswith("Junction"):
            shortTitle = f"{prefix} (Junction {parts[1].replace('Junction', '')})"
        else:
            shortTitle = prefix
    else:
        shortTitle = shortTitle.title()
    
    for key, coords in known_coords.items():
        if key in upper_name:
            lat = coords[0] + random.uniform(-0.005, 0.005)
            lon = coords[1] + random.uniform(-0.005, 0.005)
            break
            
    if lat is None:
        lat = center_lat + random.uniform(-0.08, 0.08)
        lon = center_lon + random.uniform(-0.08, 0.08)
        
    base_vol = 20000
    weather = "Clear"
    for k, v in traffic_map.items():
        if k in upper_name or k.replace(" ", "") in upper_name:
            base_vol = v["vol"]
            weather = v["weather"]
            break
            
    # Simulate 24h
    hourly_traffic = []
    # Morning peak 9AM, Evening peak 18 (6PM)
    peak_1 = 9
    peak_2 = 18
    for h in range(24):
        # 0.1 base + distance to peak
        d1 = abs(h - peak_1)
        d2 = abs(h - peak_2)
        factor = max(0, 1 - min(d1, d2)/4) 
        val = base_vol * (0.2 + factor * random.uniform(0.6, 0.9))
        hourly_traffic.append({
            "hour": h,
            "volume": int(val),
            "choked": val > (base_vol * 0.8)
        })

    junctions_data.append({
        "id": idx + 1,
        "name": shortTitle,
        "svg_file": f"/SVG renderer/{svg}",
        "lat": lat,
        "lon": lon,
        "weather": weather,
        "hourly": hourly_traffic
    })


js_file = os.path.join(base_dir, "sim", "src", "data.js")
with open(js_file, "w", encoding="utf-8") as f:
    f.write("export const mapCenter = [12.9716, 77.5946];\n")
    f.write("export const junctions = ")
    json.dump(junctions_data, f, indent=2)
    f.write(";\n")
print(f"Written data.js to {js_file}")
