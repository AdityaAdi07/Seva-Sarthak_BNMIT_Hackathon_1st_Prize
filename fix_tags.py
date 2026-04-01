import os
import glob
import re

svg_dir = r"c:\Users\sushm\OneDrive\Desktop\llm_engineering-main\Bnmit\sim\public\SVG renderer"
files = glob.glob(os.path.join(svg_dir, "Mock_*.svg"))

for fpath in files:
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace the missing '/>\n<text'
    # Currently looks like:
    # filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.06))"
    # <text x="...
    
    content = content.replace('filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.06))"\n<text',
                              'filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.06))"/>\n<text')
                              
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Tags closed successfully.")
