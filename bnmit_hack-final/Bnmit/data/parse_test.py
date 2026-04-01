import pdfplumber, re, json

def deduplicate_text(text):
    if not text: return ""
    text = text.replace('\n', ' ')
    
    # Remove spacing and deduplicate adjacent characters
    # SSHHAANNTT -> SHANT
    res = ""
    i = 0
    t = text.strip()
    while i < len(t):
        res += t[i]
        if i + 1 < len(t) and t[i+1] == t[i] and t[i].isalpha():
            i += 2
        else:
            i += 1
    
    # Detect if it has mostly double letters
    doubles = sum(1 for j in range(len(t)-1) if t[j] == t[j+1] and t[j].isalpha())
    if doubles > len(t)/4 and len(res) >= 3:
        pass
    else:
        res = t
    
    # If it wasn't doubled character by character, check if it was doubled word by word
    half = len(res)//2
    if half > 0 and res[:half].strip() == res[half:].strip():
        return res[:half].strip()
    
    return res

pdf = pdfplumber.open('c:/Users/sushm/OneDrive/Desktop/llm_engineering-main/Bnmit/data/ashok nagar 2.pdf')
out_data = []
for page in pdf.pages:
    tables = page.extract_tables()
    for table in tables:
        approaches = []
        timings = []
        for row in table:
            if not row: continue
            
            # row[1] could be 'A', 'B', 'C', 'D'
            if len(row) > 2 and row[1]:
                leg = row[1].strip()
                if leg in ('A', 'B', 'C', 'D'):
                    from_str = row[2] if row[2] else ""
                    from_str = deduplicate_text(from_str)
                    
                    movements = [deduplicate_text(c) for c in row[3:] if c and c.strip()]
                    # flatten movements
                    mv_str = " ".join(movements)
                    mvs = re.findall(r'[LRS]', mv_str)
                    approaches.append({"leg": leg, "from": from_str, "mvs": mvs})
            
            # timings
            # typical row: [ 'TIMINGS', '07:00', '09:00', '35', None, ... ]
            if len(row) > 2 and row[1] and re.match(r'\d{2}:\d{2}', row[1].strip()):
                from_t = row[1].strip()
                to_t = row[2].strip() if row[2] else ""
                nums = " ".join(str(c) for c in row[3:] if c and str(c).strip())
                timings.append({
                    "from": from_t,
                    "to": to_t,
                    "nums": nums
                })
        out_data.append({"approaches": approaches, "timings": timings})

with open('out_test.json', 'w') as f:
    json.dump(out_data, f, indent=2)
