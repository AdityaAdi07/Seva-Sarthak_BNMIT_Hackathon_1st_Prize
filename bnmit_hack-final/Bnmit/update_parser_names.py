import json

with open('c:/Users/sushm/OneDrive/Desktop/llm_engineering-main/Bnmit/junction_signal_renderer.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

cell_idx = -1
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] == 'code' and any('def build_junction_json' in line for line in cell['source']):
        cell_idx = i
        break

if cell_idx == -1:
    print("Could not find Parser cell")
    exit(1)

parser_source = """# ── Cell 4: Parser functions ───────────────────────────────────────────────
import re, math
import pdfplumber

CANVAS_W, CANVAS_H = 900, 560
CX, CY   = CANVAS_W // 2, CANVAS_H // 2
ARM_LEN  = 165
DIR_ANGLE = {"E": 0, "N": 90, "W": 180, "S": 270}
STREET_DIR = {
    "UCO BANK": "E",   "MICO BANDE": "W",  "ANEPALYA": "W",
    "KORAMANGALA": "N", "JAKKASANDRA": "S",  "KRUPANIDHI": "E",
    "WIPRO": "S",       "VENKATAPURA": "N",   "HOSUR": "S",
}

def street_to_direction(name: str) -> str:
    for kw, d in STREET_DIR.items():
        if kw in name.upper():
            return d
    return "?"

def deduplicate_text(text):
    if not text: return ""
    text = text.replace('\\n', ' ')
    res = ""
    i = 0
    t = text.strip()
    while i < len(t):
        res += t[i]
        if i + 1 < len(t) and t[i+1] == t[i] and t[i].isalpha(): i += 2
        else: i += 1
    half = len(res)//2
    if half > 0 and res[:half].strip() == res[half:].strip(): return res[:half].strip()
    return res

def assign_coordinates(approaches: list) -> list:
    default_by_leg = {"A": 0, "B": 90, "C": 180, "D": 270}
    used, result   = set(), []
    for ap in approaches:
        angle = DIR_ANGLE.get(ap["direction"])
        if angle is None or angle in used:
            angle = default_by_leg.get(ap["leg"])
        if angle is None or angle in used:
            angle = next((a for a in [0,90,180,270] if a not in used), 0)
        used.add(angle)
        rad = math.radians(angle)
        result.append({**ap,
            "angle_deg": angle,
            "cx": round(CX + ARM_LEN * math.cos(rad)),
            "cy": round(CY - ARM_LEN * math.sin(rad)),
        })
    return result

def build_junction_json(pdf_path: str) -> dict:
    pdf = pdfplumber.open(pdf_path)
    junctions = []
    
    for page in pdf.pages:
        text_lines = page.extract_text().split('\\n')
        tables = page.extract_tables()
        layout_lines = page.extract_text(layout=True).split('\\n')
        
        titles = []
        ctrls = []
        for line in text_lines:
            if 'JUNCTION' in line.upper() and ('FIXED' in line.upper() or 'VAC' in line.upper() or 'ADAPTIVE' in line.upper()):
                nm = re.sub(r'[,-]?\\s*(?:FIXED|VAC|ACTUATED|ADAPTIVE).*$', '', line, flags=re.I).strip()
                ctrl_m = re.search(r'(FIXED|VAC|ACTUATED|ADAPTIVE)', line, re.I)
                ctrl = ctrl_m.group(1).upper() if ctrl_m else "FIXED"
                titles.append(nm)
                ctrls.append(ctrl)
                
        for t_idx, table in enumerate(tables):
            approaches = []
            timings = []
            name = titles[t_idx] if t_idx < len(titles) else f"Junction {t_idx+1}"
            control = ctrls[t_idx] if t_idx < len(ctrls) else "FIXED"
            
            for row in table:
                if not row: continue
                if len(row) > 2 and row[1] and str(row[1]).strip() in ('A', 'B', 'C', 'D'):
                    leg = str(row[1]).strip()
                    from_str = deduplicate_text(row[2] if row[2] else "")
                    movements = [deduplicate_text(c) for c in row[3:] if c and str(c).strip()]
                    mvs = re.findall(r'[LRS]', " ".join(movements))
                    approaches.append({"leg": leg, "from": from_str, "direction": street_to_direction(from_str), "movements": mvs})
            
            for line in layout_lines:
                m = re.search(r'(\\d{2}:\\d{2})\\s+(\\d{2}:\\d{2})\\s+((?:\\d+(?:\\s*\\(\\d+\\))?\\s*){3,})', line)
                if m:
                    nums = [{"weekday": int(n.group(1)), "sunday": int(n.group(2)) if n.group(2) else int(n.group(1))}
                            for n in re.finditer(r'(\\d+)(?:\\s*\\((\\d+)\\))?', m.group(3))]
                    if len(nums) < 3: continue
                    if not any(t["from_time"] == m.group(1) for t in timings):
                        timings.append({"from_time": m.group(1), "to_time": m.group(2), "phase_greens": nums[:-2], "ped_phase": nums[-2], "cycle_time": nums[-1]})
            
            if approaches:
                approaches = assign_coordinates(approaches)
                junctions.append({"id": len(junctions)+1, "name": name, "control": control, 
                                  "canvas": {"width": CANVAS_W, "height": CANVAS_H, "cx": CX, "cy": CY},
                                  "approaches": approaches, "timings": timings})
    return {"junctions": junctions}
print("✅ Parser functions defined.")
"""

nb['cells'][cell_idx]['source'] = [line + '\n' for line in parser_source.split('\n')]
nb['cells'][cell_idx]['source'][-1] = nb['cells'][cell_idx]['source'][-1].rstrip('\n')

with open('c:/Users/sushm/OneDrive/Desktop/llm_engineering-main/Bnmit/junction_signal_renderer.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)
