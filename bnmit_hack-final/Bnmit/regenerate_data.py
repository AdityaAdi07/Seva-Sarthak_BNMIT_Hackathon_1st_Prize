import os
import json
import random

base_dir = r"c:\Users\sushm\OneDrive\Desktop\llm_engineering-main\Bnmit"
svg_dir = os.path.join(base_dir, r"sim\public\SVG renderer")
svg_files = [f for f in os.listdir(svg_dir) if f.endswith('.svg')]

junctions_data = []
center_lat, center_lon = 12.9716, 77.5946

for idx, svg in enumerate(svg_files):
    lat = center_lat + random.uniform(-0.08, 0.08)
    lon = center_lon + random.uniform(-0.08, 0.08)
    h_traffic = []
    
    for h in range(24):
        d1 = abs(h - 9)
        d2 = abs(h - 18)
        f = max(0, 1 - min(d1, d2) / 4.0)
        v = 20000 * (0.2 + f * random.uniform(0.6, 0.9))
        h_traffic.append({
            'hour': h,
            'volume': int(v),
            'choked': v > 16000
        })
        
    n = svg.replace('Mock_', '').replace('_Junction_1.svg', '').replace('.svg', '')
    n = n.replace('_', ' ').title()
    if '(' in n: n = n.split('(')[0].strip()
        
    junctions_data.append({
        'id': idx + 1,
        'name': n[:25],
        'svg_file': '/SVG renderer/' + svg,
        'lat': lat,
        'lon': lon,
        'weather': 'Clear',
        'hourly': h_traffic
    })

out_path = os.path.join(base_dir, 'sim', 'src', 'data.js')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write('export const mapCenter = [12.9716, 77.5946];\n')
    f.write('export const junctions = ' + json.dumps(junctions_data, indent=2) + ';\n')
