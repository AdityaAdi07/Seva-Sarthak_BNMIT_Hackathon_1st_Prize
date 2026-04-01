import os
import glob
import re

svg_dir = r"c:\Users\sushm\OneDrive\Desktop\llm_engineering-main\Bnmit\sim\public\SVG renderer"

mock_files = glob.glob(os.path.join(svg_dir, "Mock_*.svg"))

roads = ["Main Road", "Ring Road", "Cross Road", "Service Road"]

for fpath in mock_files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Fix center rect sizing
    # Find the title name
    match = re.search(r'<text x="450" y="276" text-anchor="middle"[^>]*>([^<]+)</text>', content)
    if match:
        name = match.group(1)
        # approx 7px per char + 20 padding
        w = int(len(name) * 7.5 + 20)
        # make it at least 112
        w = max(112, w)
        px = 450 - (w // 2)
        
        # Replace the rect
        def rect_repl(m):
            return f'<rect x="{px}" y="256" width="{w}" height="48"' + m.group(1)
            
        content = re.sub(r'<rect x="\d+" y="256" width="\d+" height="48"( rx="8"[^>]+)/>', rect_repl, content)
        
    # 2. Extract and replace road names
    # Find all "From [Name]"
    from_matches = re.finditer(r'(?:↓|→|↑|←) From ([^<]+)</text>', content)
    old_roads = []
    for m in from_matches:
        old_roads.append(m.group(1))
        
    old_roads = list(set(old_roads))
    
    for i, old_r in enumerate(old_roads):
        new_r = roads[i % len(roads)]
        # Replace "From X"
        content = content.replace(f"From {old_r}", f"From {new_r}")
        # Replace parenthetical in phase summary: "(X):"
        # Since it might be truncated in the summary (e.g. Marapa Garde instead of Gardens)
        trunc_old = old_r[:12]
        content = content.replace(f"({old_r}):", f"({new_r[:12]}):")
        content = content.replace(f"({trunc_old}):", f"({new_r[:12]}):")
        
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Fixed {len(mock_files)} Mock SVGs.")
