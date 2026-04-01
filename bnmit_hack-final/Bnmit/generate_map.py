import os
import glob
import random
import json

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
            # map by the prefix
            prefix = os.path.basename(j_file).split("_junctions")[0]
            json_data_map[prefix] = j_data
    except Exception as e:
        pass

junctions_data = []
for idx, svg in enumerate(svg_files):
    lat, lon = None, None
    upper_name = svg.upper()
    prefix = svg.split("_")[0]
    
    # Try to find corresponding json data
    choked = False
    peak_hrs = "08:00 - 11:00" # Default
    
    related_json = json_data_map.get(prefix)
    if related_json and "junctions" in related_json:
        # Just grab the first junction or try to match
        for jn in related_json["junctions"]:
            # Check safely if choke
            vc_list = jn.get("vc_analysis", [])
            for phase in vc_list:
                if phase.get("status") == "critical":
                    choked = True
            
            # Highest cycle time usually is peak
            timings = jn.get("timings", [])
            if timings:
                max_cycle = 0
                for t in timings:
                    c = t.get("cycle_time", {}).get("weekday", 0)
                    if c > max_cycle:
                        max_cycle = c
                        peak_hrs = f"{t.get('from_time')} - {t.get('to_time')}"
    
    if "CHOKE" in upper_name or "CRIT" in upper_name:
        choked = True

    for key, coords in known_coords.items():
        if key in upper_name:
            lat = coords[0] + random.uniform(-0.005, 0.005)
            lon = coords[1] + random.uniform(-0.005, 0.005)
            break
            
    if lat is None:
        lat = center_lat + random.uniform(-0.08, 0.08)
        lon = center_lon + random.uniform(-0.08, 0.08)
        
    junctions_data.append({
        "id": idx + 1,
        "name": svg.replace(".svg", ""),
        "svg_file": f"SVG renderer/{svg}",
        "lat": lat,
        "lon": lon,
        "choked": choked,
        "peak_hrs": peak_hrs
    })

# Compute stats
total_nodes = len(junctions_data)
choked_nodes = sum(1 for j in junctions_data if j["choked"])

html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Bengaluru Smart Junction Control</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        :root {{
            --primary: #2563eb;
            --primary-light: #eff6ff;
            --danger: #ef4444;
            --danger-light: #fef2f2;
            --success: #10b981;
            --success-light: #ecfdf5;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --bg-glass: rgba(255, 255, 255, 0.85);
            --border: rgba(203, 213, 225, 0.6);
        }}
        
        body, html {{ 
            margin: 0; padding: 0; height: 100%; 
            font-family: 'Inter', sans-serif; 
            background: #f8fafc; 
            overflow: hidden;
            color: var(--text-main);
        }}
        
        #map {{ 
            width: 100%; height: 100vh; z-index: 1;
        }}

        /* Premium Light Theme Glass UI Elements */
        .glass-panel {{
            background: var(--bg-glass);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
            z-index: 1000;
        }}

        /* Top Header */
        .header-panel {{
            position: absolute;
            top: 24px; left: 24px;
            padding: 24px;
            width: 340px;
        }}
        .header-panel h2 {{ 
            margin: 0 0 8px 0; font-size: 24px; font-weight: 800; font-family: 'Outfit', sans-serif;
            color: #0f172a; 
            display: flex; align-items: center; gap: 8px;
        }}
        .header-panel p {{ margin: 0; color: var(--text-muted); font-size: 14px; font-weight: 400; line-height: 1.5; }}
        
        /* Stats summary in header */
        .stat-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }}
        .stat-box {{ 
            background: #ffffff;
            border: 1px solid var(--border);
            padding: 16px; border-radius: 12px;
            display: flex; flex-direction: column;
            box-shadow: 0 2px 10px rgba(0,0,0,0.02);
        }}
        .stat-value {{ font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--primary); }}
        .stat-value.choked {{ color: var(--danger); }}
        .stat-label {{ font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }}

        /* Sidebar List */
        .sidebar {{
            position: absolute;
            top: 240px; left: 24px; bottom: 24px;
            width: 340px;
            display: flex; flex-direction: column;
            overflow: hidden;
        }}
        .sidebar-header {{
            padding: 16px 24px;
            font-size: 13px; font-weight: 700; color: var(--text-main);
            border-bottom: 1px solid var(--border);
            background: rgba(248, 250, 252, 0.9);
            display: flex; justify-content: space-between; align-items: center;
        }}
        
        .filter-btn {{
            background: none; border: 1px solid var(--border);
            padding: 4px 10px; border-radius: 12px;
            font-size: 11px; font-weight: 600; color: var(--text-muted);
            cursor: pointer; transition: 0.2s;
        }}
        .filter-btn:hover {{ background: #f1f5f9; }}
        .filter-btn.active {{ background: var(--danger-light); color: var(--danger); border-color: var(--danger); }}

        .sidebar-list {{
            flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 0;
        }}
        .sidebar-list::-webkit-scrollbar {{ width: 6px; }}
        .sidebar-list::-webkit-scrollbar-track {{ background: transparent; }}
        .sidebar-list::-webkit-scrollbar-thumb {{ background: #cbd5e1; border-radius: 10px; }}
        .sidebar-list::-webkit-scrollbar-thumb:hover {{ background: #94a3b8; }}

        .junction-item {{
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        .junction-item:hover {{
            background: #f8fafc;
            transform: translateX(4px);
        }}
        
        .item-header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }}
        .jcn-name-text {{ 
            font-size: 14px; font-weight: 600; color: var(--text-main);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;
            font-family: 'Outfit', sans-serif;
        }}
        
        .badge {{ padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }}
        .badge.ok {{ background: var(--success-light); color: var(--success); }}
        .badge.choked {{ background: var(--danger-light); color: var(--danger); box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); }}
        
        .item-details {{ display: flex; align-items: center; font-size: 12px; color: var(--text-muted); font-weight: 500; }}
        .item-details span {{ display: flex; align-items: center; gap: 4px; }}
        .item-details .peak-icon {{ font-size: 14px; }}

        /* Light Theme Map Marker */
        .custom-marker {{
            width: 20px; height: 20px;
            background: var(--primary);
            border-radius: 50%;
            border: 3px solid #fff;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.4);
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }}
        .custom-marker.choked {{
            background: var(--danger);
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.5);
            animation: pulse-danger 2s infinite;
        }}
        .custom-marker:hover {{
            transform: scale(1.2);
            background: #1d4ed8;
        }}
        .custom-marker.choked:hover {{ background: #dc2626; }}
        
        @keyframes pulse-danger {{
            0% {{ box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }}
            70% {{ box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }}
            100% {{ box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }}
        }}

        /* Clean Light Popup */
        .leaflet-popup-content-wrapper {{
            background: #ffffff;
            color: var(--text-main);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 0;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(15,23,42,0.1);
        }}
        .leaflet-popup-content {{ margin: 0; width: 900px !important; text-align: center; }}
        .leaflet-popup-tip {{ background: #ffffff; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }}
        
        .leaflet-container a.leaflet-popup-close-button {{
            color: var(--text-muted);
            padding: 8px 12px; font-size: 20px; border-radius: 50%; z-index: 10;
            transition: all 0.2s;
        }}
        .leaflet-container a.leaflet-popup-close-button:hover {{ color: var(--text-main); background: #f1f5f9; }}

        .popup-header {{
            background: #f8fafc;
            border-bottom: 1px solid var(--border);
            padding: 16px 24px;
            display: flex; align-items: center; justify-content: space-between;
        }}
        .popup-title {{ font-size: 16px; font-weight: 700; font-family: 'Outfit', sans-serif; color: #0f172a; }}
        
        object {{
            width: 900px; height: 560px; border: none; display: block;
            background: #f4f7f6; /* Force light backdrop for SVGs */
        }}
        
        .leaflet-control-zoom a {{ background: #fff !important; color: var(--text-main) !important; border: 1px solid var(--border) !important; font-weight: 500 !important; }}
        .leaflet-control-zoom a:hover {{ background: #f8fafc !important; }}
    </style>
</head>
<body>

    <!-- Header Overlay -->
    <div class="glass-panel header-panel">
        <h2>🚦 Traffic Control</h2>
        <p>Bengaluru Smart Routing & Signal Optimization Interface.</p>
        <div class="stat-grid">
            <div class="stat-box">
                <span class="stat-value">{total_nodes}</span>
                <span class="stat-label">Active Nodes</span>
            </div>
            <div class="stat-box">
                <span class="stat-value choked">{choked_nodes}</span>
                <span class="stat-label">Critical Chokes</span>
            </div>
        </div>
    </div>

    <!-- Details Sidebar -->
    <div class="glass-panel sidebar">
        <div class="sidebar-header">
            <span>Network Directory</span>
            <button class="filter-btn" id="filterChokeBtn" onclick="toggleChokes()">⚠️ Show Choked</button>
        </div>
        <div class="sidebar-list" id="sidebarList">
            <!-- Populated by JS -->
        </div>
    </div>
    
    <div id="map"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        var map = L.map('map', {{ zoomControl: false }}).setView([{center_lat}, {center_lon}], 12);
        L.control.zoom({{ position: 'topright' }}).addTo(map);
        
        // CartoDB Voyager - Premium Light Map Base
        L.tileLayer('https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png', {{
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }}).addTo(map);

        var junctions = {json.dumps(junctions_data)};
        var markers = [];
        var sidebarEl = document.getElementById('sidebarList');
        var showingOnlyChoked = false;

        var normalIcon = L.divIcon({{
            className: 'custom-marker-wrapper',
            html: '<div class="custom-marker"></div>',
            iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10]
        }});

        var chokedIcon = L.divIcon({{
            className: 'custom-marker-wrapper',
            html: '<div class="custom-marker choked"></div>',
            iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10]
        }});

        function renderList() {{
            sidebarEl.innerHTML = '';
            
            junctions.forEach(function(jn, idx) {{
                if (showingOnlyChoked && !jn.choked) return;

                var shortTitle = jn.name;
                if(shortTitle.includes("_")) {{
                    var parts = shortTitle.split("_");
                    shortTitle = parts.length > 1 ? parts[1].replace(/([A-Z])/g, ' $1').trim() : parts[0];
                }}
                
                if(!markers[idx]) {{
                    var marker = L.marker([jn.lat, jn.lon], {{ 
                        icon: jn.choked ? chokedIcon : normalIcon 
                    }}).addTo(map);
                    
                    var popupContent = `
                        <div class="popup-header">
                            <span class="popup-title">${{shortTitle}}</span>
                            <span class="badge ${{jn.choked ? 'choked' : 'ok'}}">${{jn.choked ? '⚠ CRITICAL CHOKE' : '✓ OPTIMAL'}}</span>
                        </div>
                        <object type="image/svg+xml" data="${{jn.svg_file}}">Error loading SVG.</object>
                    `;
                    marker.bindPopup(popupContent, {{ maxWidth: 920, minWidth: 900 }});
                    markers[idx] = marker;
                }}
                
                var item = document.createElement('div');
                item.className = 'junction-item';
                var badgeHtml = jn.choked ? '<span class="badge choked">Choked</span>' : '<span class="badge ok">Optimal</span>';
                
                item.innerHTML = `
                    <div class="item-header">
                        <div class="jcn-name-text">${{shortTitle}}</div>
                        ${{badgeHtml}}
                    </div>
                    <div class="item-details">
                        <span><span class="peak-icon">⏱️</span> Peak: ${{jn.peak_hrs}}</span>
                    </div>
                `;
                item.onclick = function() {{
                    map.flyTo([jn.lat, jn.lon], 15, {{ duration: 1.5 }});
                    setTimeout(() => markers[idx].openPopup(), 1500);
                }};
                sidebarEl.appendChild(item);
            }});
        }}

        function toggleChokes() {{
            showingOnlyChoked = !showingOnlyChoked;
            var btn = document.getElementById('filterChokeBtn');
            if (showingOnlyChoked) {{
                btn.classList.add('active');
                btn.innerText = "Show All";
                // Hide non-choked markers
                junctions.forEach((jn, idx) => {{ if(!jn.choked && markers[idx]) map.removeLayer(markers[idx]); }});
            }} else {{
                btn.classList.remove('active');
                btn.innerText = "⚠️ Show Choked";
                // Show all markers
                junctions.forEach((jn, idx) => {{ if(!jn.choked && markers[idx]) markers[idx].addTo(map); }});
            }}
            renderList();
        }}

        renderList();
    </script>
</body>
</html>
"""

with open(r"c:\Users\sushm\OneDrive\Desktop\llm_engineering-main\Bnmit\map_dashboard.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print("✅ Generated map_dashboard.html explicitly with light theme and choke-point dashboard.")
