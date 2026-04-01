import pdfplumber, re, json
import glob

def deduplicate_text(text):
    if not text: return ""
    text = text.replace('\n', ' ')
    
    res = ""
    i = 0
    t = text.strip()
    while i < len(t):
        res += t[i]
        if i + 1 < len(t) and t[i+1] == t[i] and t[i].isalpha():
            i += 2
        else:
            i += 1
            
    half = len(res)//2
    if half > 0 and res[:half].strip() == res[half:].strip():
        return res[:half].strip()
    return res

def parse_pdf(pdf_path):
    pdf = pdfplumber.open(pdf_path)
    junctions = []
    
    for page in pdf.pages:
        # Extract title from text for junction names
        text_lines = page.extract_text().split('\n')
        # We need headers like '... JUNCTION ... FIXED'
        
        # We use explicit table borders to help pdfplumber
        # table_settings = {"vertical_strategy": "text", "horizontal_strategy": "text"}
        
        tables = page.extract_tables()
        # Fallback to layout=True for timings if table splits numbers badly
        layout_text = page.extract_text(layout=True)
        layout_lines = layout_text.split('\n')
        
        for t_idx, table in enumerate(tables):
            approaches = []
            timings = []
            name = f"Junction {t_idx+1}"
            control = "FIXED"
            
            # Find the header before the table
            for i, line in enumerate(text_lines):
                if 'JUNCTION' in line.upper() and ('FIXED' in line.upper() or 'VAC' in line.upper()):
                    # just take the first matching or try to match table indices
                    name = re.sub(r'[,-]?\s*(?:FIXED|VAC|ACTUATED|ADAPTIVE).*$', '', line, flags=re.I).strip()
                    ctrl_m = re.search(r'(FIXED|VAC|ACTUATED|ADAPTIVE)', line, re.I)
                    if ctrl_m: control = ctrl_m.group(1).upper()
                    # if we have multiple, this is tricky, let's keep it simple
            
            for row in table:
                if not row: continue
                
                # Check approaches
                if len(row) > 2 and row[1]:
                    leg = row[1].strip()
                    if leg in ('A', 'B', 'C', 'D'):
                        from_str = deduplicate_text(row[2] if row[2] else "")
                        # Flatten cells after column 2 for movements
                        movements = [deduplicate_text(c) for c in row[3:] if c and c.strip()]
                        mv_str = " ".join(movements)
                        mvs = re.findall(r'[LRS]', mv_str)
                        if not mvs and "EVISULCXE" in row[-1]: # pedestrian row?
                            pass
                        approaches.append({
                            "leg": leg, "from": from_str, "direction": "?", "movements": mvs
                        })

            # parse timings using layout text, which is WAY more reliable!
            # look for typical timing lines in this page
            # layout text maintains spacing
            for line in layout_lines:
                # e.g. "  07:00 09:00    35     25    25     10  120"
                m = re.search(r'(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+((?:\d+(?:\s*\(\d+\))?\s*){3,})', line)
                if m:
                    from_t = m.group(1)
                    to_t   = m.group(2)
                    num_str = m.group(3)
                    num_re = re.compile(r'(\d+)(?:\s*\((\d+)\))?')
                    nums = [
                        {"weekday": int(n.group(1)),
                         "sunday": int(n.group(2)) if n.group(2) else int(n.group(1))}
                        for n in num_re.finditer(num_str)
                    ]
                    if len(nums) < 3: continue
                    # the timings parsed this way apply to the FIRST/CURRENT table 
                    # assuming 1 table per page or we split them somehow
                    # Let's just append to the current table
                    # Wait, if page has 2 tables, layout_lines parses ALL lines!
                    timings.append({
                        "from_time": from_t, "to_time": to_t,
                        "phase_greens": nums[:-2], "ped_phase": nums[-2], "cycle_time": nums[-1]
                    })
                    
            if approaches:
                junctions.append({
                    "name": name, "control": control,
                    "approaches": approaches, "timings": timings
                })
                
    return junctions

print(json.dumps(parse_pdf('c:/Users/sushm/OneDrive/Desktop/llm_engineering-main/Bnmit/data/ashok nagar 2.pdf'), indent=2))
