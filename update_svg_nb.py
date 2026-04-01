import json

with open('c:/Users/sushm/OneDrive/Desktop/llm_engineering-main/Bnmit/junction_signal_renderer.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# The renderer is Cell 7 (index 8 if we count cells, but let's find it dynamically)
cell_idx = -1
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] == 'code' and any('SVG renderer' in line for line in cell['source']):
        cell_idx = i
        break

if cell_idx == -1:
    print("Could not find renderer cell")
    exit(1)

svg_source = """# ── Cell 7: SVG renderer ───────────────────────────────────────────────────
import re
import math
COLORS = {
    "bg":           "#f4f7f6",
    "road":         "#e0e0e0",
    "road_line":    "#9e9e9e",
    "bubble_ok":    "#4caf50",
    "bubble_warn":  "#fb8c00",
    "bubble_crit":  "#e53935",
    "bubble_ped":   "#1e88e5",
    "green_bar":    "#43a047",
    "red_pulse":    "rgba(229,57,53,0.35)",
    "label_text":   "#263238",
    "warn_text":    "#d32f2f",
    "ok_text":      "#2e7d32",
    "centre_bg":    "#ffffff",
    "centre_border":"#cfd8dc",
    "panel_bg":     "#ffffff",
    "panel_border": "#eceff1",
    "text_muted":   "#78909c"
}
BUBBLE_R_BASE = 44

def _vc_fill(s):   return {"ok": COLORS["bubble_ok"], "warning": COLORS["bubble_warn"],
                            "critical": COLORS["bubble_crit"], "info": COLORS["bubble_ped"]}.get(s, COLORS["bubble_ok"])
def _vc_tc(s):     return COLORS["warn_text"] if s in ("critical", "warning") else COLORS["ok_text"]


def render_junction_svg(junction: dict, slot_idx: int = 1) -> str:
    \"\"\"
    Generate a complete light-theme SVG for one junction.
    slot_idx: which time band to visualise (0=07-08, 1=08-11 peak …)
    \"\"\"
    W, H = junction["canvas"]["width"], junction["canvas"]["height"]
    cx, cy = junction["canvas"]["cx"],  junction["canvas"]["cy"]
    approaches = junction["approaches"]
    vc_data    = junction.get("vc_analysis", [])
    if not vc_data:
        # compute on the fly if not present
        pass # we depend on compute_vc_ratios already being run
    vc_map     = {r["phase"]: r for r in vc_data}
    timings    = junction.get("timings", [])
    slot       = timings[min(slot_idx, len(timings)-1)] if timings else None
    cycle      = slot["cycle_time"]["weekday"] if slot else "—"
    ped_g      = slot["ped_phase"]["weekday"]  if slot else 0
    short_name = re.sub(r'\\s*\\(.*?\\)', '', junction["name"]).split(',')[0].strip()
    
    time_slot_label = f"{slot['from_time']} – {slot['to_time']}" if slot else "N/A"

    p = []
    p.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
             f'width="{W}" height="{H}" font-family="Segoe UI,Arial,sans-serif">')
    
    # Grid pattern for details
    p.append(f'<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">'
             f'<path d="M 40 0 L 0 0 0 40" fill="none" stroke="#eceff1" stroke-width="0.5"/></pattern></defs>')
    
    p.append(f'<rect width="{W}" height="{H}" fill="{COLORS["bg"]}"/>')
    p.append(f'<rect width="{W}" height="{H}" fill="url(#grid)"/>')

    # ── Compass ──
    p.append(f'<g transform="translate({W-60}, 50)">'
             f'<circle cx="0" cy="0" r="16" fill="white" stroke="#cfd8dc" stroke-width="1"/>'
             f'<path d="M 0 -10 L 4 0 L 0 10 L -4 0 Z" fill="#cfd8dc"/>'
             f'<path d="M 0 -10 L 0 10 L -4 0 Z" fill="#b0bec5"/>'
             f'<text x="0" y="-14" text-anchor="middle" fill="#78909c" font-size="10" font-weight="600">N</text>'
             f'</g>')

    # ── Road arms ──
    for ap in approaches:
        rad = math.radians(ap["angle_deg"])
        ex  = round(cx + W * 0.52 * math.cos(rad))
        ey  = round(cy - H * 0.52 * math.sin(rad))
        p.append(f'<line x1="{cx}" y1="{cy}" x2="{ex}" y2="{ey}" '
                 f'stroke="{COLORS["road"]}" stroke-width="66" stroke-linecap="square"/>')
        p.append(f'<line x1="{cx}" y1="{cy}" x2="{ex}" y2="{ey}" '
                 f'stroke="{COLORS["road_line"]}" stroke-width="2" '
                 f'stroke-dasharray="8,8" opacity="0.6"/>')

    # ── Intersection box ──
    BOX = 58
    p.append(f'<rect x="{cx-BOX}" y="{cy-BOX}" width="{BOX*2}" height="{BOX*2}" '
             f'fill="{COLORS["road"]}" stroke="{COLORS["road_line"]}" stroke-dasharray="4,4" stroke-width="2"/>')

    # ── Centre label ──
    p.append(f'<rect x="{cx-56}" y="{cy-24}" width="112" height="48" rx="8" '
             f'fill="{COLORS["centre_bg"]}" stroke="{COLORS["centre_border"]}" stroke-width="2" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.06))"/>')
    p.append(f'<text x="{cx}" y="{cy-4}" text-anchor="middle" '
             f'fill="{COLORS["label_text"]}" font-size="11" font-weight="700">{short_name}</text>')
    p.append(f'<text x="{cx}" y="{cy+11}" text-anchor="middle" fill="{COLORS["text_muted"]}" font-size="9">Junction • {junction["control"]}</text>')

    # ── Pedestrian pill ──
    p.append(f'<rect x="{cx-30}" y="{cy+30}" width="60" height="18" rx="9" fill="{COLORS["bubble_ped"]}" filter="drop-shadow(0 2px 3px rgba(33,150,243,0.3))"/>')
    p.append(f'<text x="{cx}" y="{cy+42}" text-anchor="middle" fill="white" '
             f'font-size="9" font-weight="600">Ped: {ped_g}s</text>')

    # ── Title ──
    p.append(f'<text x="{W//2}" y="24" text-anchor="middle" '
             f'fill="{COLORS["label_text"]}" font-size="15" font-weight="800">{short_name} JUNCTION</text>')
    p.append(f'<text x="{W//2}" y="40" text-anchor="middle" fill="{COLORS["text_muted"]}" font-size="11">'
             f'Time Slot: {time_slot_label}  |  Control: {junction["control"]} Signal</text>')

    # ── Signal bubbles ──
    for ap in approaches:
        leg    = ap["leg"]
        bx, by = ap["cx"], ap["cy"]
        vc_r   = vc_map.get(leg, {})
        status = vc_r.get("status", "ok")
        fill   = _vc_fill(status)
        green_s = vc_r.get("green_weekday", 40)
        r = max(32, min(58, round(BUBBLE_R_BASE * (green_s / 90))))

        if status == "critical":
            p.append(f'<circle cx="{bx}" cy="{by}" r="{r+14}" fill="{COLORS["red_pulse"]}"><animate attributeName="r" values="{r+10};{r+18};{r+10}" dur="2s" repeatCount="indefinite" /></circle>')

        # Bubble drop shadow
        p.append(f'<circle cx="{bx}" cy="{by}" r="{r}" fill="{fill}" opacity="0.95" filter="drop-shadow(0px 3px 5px rgba(0,0,0,0.15))"/>')

        # Movement label
        mvmt_icons = {"L": "←L", "R": "→R", "S": "↑S"}
        mvmt_str   = " ".join(mvmt_icons.get(m, m) for m in ap.get("movements", [])[:3])
        p.append(f'<text x="{bx}" y="{by-2}" text-anchor="middle" fill="white" font-size="10" font-weight="700">{mvmt_str}</text>')
        # Green time inside bubble
        p.append(f'<text x="{bx}" y="{by+10}" text-anchor="middle" fill="white" opacity="0.9" font-size="9" font-weight="500">{green_s}s Green</text>')

        # ProgressBar
        bar_w = max(24, min(80, int(green_s * 0.85)))
        p.append(f'<rect x="{bx - bar_w//2}" y="{by+r+8}" width="{bar_w}" height="8" rx="4" fill="{COLORS["green_bar"]}"/>')

        # "From X" label
        lbl_d  = r + 32
        rad_ap = math.radians(ap["angle_deg"])
        lx = round(bx + lbl_d * math.cos(rad_ap))
        ly = round(by - lbl_d * math.sin(rad_ap))
        
        arr_icon = "← " if ap["angle_deg"]==0 else ("→ " if ap["angle_deg"]==180 else ("↓ " if ap["angle_deg"]==90 else "↑ "))
        p.append(f'<text x="{lx}" y="{ly}" text-anchor="middle" '
                 f'fill="{COLORS["label_text"]}" font-size="11" font-weight="600">{arr_icon}From {ap["from"].title()}</text>')

        # Detailed v/c floating label
        vc_val = vc_r.get("vc_ratio")
        if vc_val is not None:
            lbl_vc = f"v/c: {vc_val}"
            p.append(f'<text x="{lx}" y="{ly+12}" text-anchor="middle" fill="{_vc_tc(status)}" font-size="9" font-weight="600">{lbl_vc}</text>')

        # Choke badge
        if status in ("critical", "warning"):
            badge = f"⚠ Choke: {leg}" if status == "critical" else f"Wait: {leg}"
            bw    = len(badge) * 6 + 10
            bx2   = bx - r - 10;  by2 = by - r - 16
            bg_col= COLORS["bubble_crit"] if status == "critical" else COLORS["bubble_warn"]
            p.append(f'<rect x="{bx2-4}" y="{by2-14}" width="{bw}" height="18" '
                     f'rx="5" fill="{bg_col}" opacity="0.9" filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.15))"/>')
            p.append(f'<text x="{bx2+bw/2-4}" y="{by2-1}" text-anchor="middle" '
                     f'fill="white" font-size="9" font-weight="700">{badge}</text>')

    # ── Phase summary panel (bottom-left) ──
    px, py_p = 20, H - 150
    p.append(f'<rect x="{px}" y="{py_p}" width="250" height="135" rx="8" '
             f'fill="{COLORS["panel_bg"]}" stroke="{COLORS["panel_border"]}" '
             f'stroke-width="1" filter="drop-shadow(0px 4px 10px rgba(0,0,0,0.05))"/>')
    p.append(f'<text x="{px+15}" y="{py_p+20}" fill="{COLORS["label_text"]}" '
             f'font-size="12" font-weight="800">Phase Summary</text>')
    for idx, vc_r in enumerate(vc_data):
        ry  = py_p + 38 + idx * 16
        col = _vc_tc(vc_r["status"])
        g_s = f"{vc_r['green_weekday']}s green" if vc_r["phase"]!="Ped" else f"{vc_r['green_weekday']}s wait"
        p.append(f'<text x="{px+15}" y="{ry}" fill="{COLORS["label_text"]}" font-size="10" font-weight="500">'
                 f'Leg {vc_r["phase"]} </text>')
        p.append(f'<text x="{px+50}" y="{ry}" fill="{COLORS["text_muted"]}" font-size="9" font-weight="400">'
                 f'({vc_r["from"][:12].title()}):</text>')
        p.append(f'<text x="{px+160}" y="{ry}" fill="{col}" font-size="10" font-weight="600">{g_s}</text>')

    crit = [r for r in vc_data if r["status"]=="critical" and r.get("vc_ratio") is not None]
    warn = [r for r in vc_data if r["status"]=="warning"  and r.get("vc_ratio") is not None]
    
    # ── Cycle time / Analysis panel (bottom-right) ──
    cpx, cpy2 = W - 180, H - 110
    p.append(f'<rect x="{cpx}" y="{cpy2}" width="160" height="90" rx="8" '
             f'fill="{COLORS["panel_bg"]}" stroke="{COLORS["panel_border"]}" '
             f'stroke-width="1" filter="drop-shadow(0px 4px 10px rgba(0,0,0,0.05))"/>')
    p.append(f'<text x="{cpx+80}" y="{cpy2+22}" text-anchor="middle" fill="{COLORS["text_muted"]}" font-size="11" font-weight="600">Total Cycle Time</text>')
    p.append(f'<text x="{cpx+80}" y="{cpy2+55}" text-anchor="middle" '
             f'fill="{COLORS["label_text"]}" font-size="30" font-weight="800">{cycle}s</text>')
    
    status_text = "System Choked ⚠" if crit else ("Heavy Traffic ⚠" if warn else "Optimal Traffic ✓")
    status_color = COLORS["warn_text"] if crit else (COLORS["bubble_warn"] if warn else COLORS["ok_text"])
    p.append(f'<text x="{cpx+80}" y="{cpy2+78}" text-anchor="middle" fill="{status_color}" font-size="10" font-weight="700">{status_text}</text>')

    p.append('</svg>')
    return '\\n'.join(p)
"""

nb['cells'][cell_idx]['source'] = [line + '\n' for line in svg_source.split('\n')]
nb['cells'][cell_idx]['source'][-1] = nb['cells'][cell_idx]['source'][-1].rstrip('\n')

with open('c:/Users/sushm/OneDrive/Desktop/llm_engineering-main/Bnmit/junction_signal_renderer.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)
