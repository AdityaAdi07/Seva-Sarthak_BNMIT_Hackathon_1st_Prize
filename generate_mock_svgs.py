import os
import json
import glob
import random
import re

base_dir = r"c:\Users\sushm\OneDrive\Desktop\llm_engineering-main\Bnmit"
svg_dir = os.path.join(base_dir, "SVG renderer")

# Use a base SVG and JSON to duplicate
base_json_candidates = glob.glob(os.path.join(svg_dir, "*_junctions.json"))

new_junction_names = [
    "HSR Layout Sector 1", "Marathahalli Bridge", "Mekhri Circle", "Trinity Circle", "Silk Board",
    "Domlur Layout", "Hebbal Flyover", "Yelahanka New Town", "Jayanagar 4th Block", "Tin Factory",
    "K R Puram Station", "BTM Tank", "Banashankari Temple", "JP Nagar 1", "Mysore Road",
    "Nayandahalli", "Gorguntepalya", "Yeshwanthpur TTMC", "Peenya Dasarahalli", "Bellandur Gate",
    "Kalyan Nagar", "CV Raman Nagar", "KR Market West", "Majestic Bus"
]

def create_mock():
    count = 0
    for name in new_junction_names[:20]:
        # Pick a random base JSON
        base_json = random.choice(base_json_candidates)
        with open(base_json, "r") as f:
            j_data = json.load(f)
            
        base_stem = os.path.basename(base_json).replace("_junctions.json", "")
        # Find related SVGs
        related_svgs = glob.glob(os.path.join(svg_dir, f"{base_stem}_*.svg"))
        if not related_svgs:
            continue
            
        base_svg = related_svgs[0]
        with open(base_svg, "r", encoding="utf-8") as f:
            svg_content = f.read()
            
        # Modify JSON
        j_data["junctions"][0]["name"] = f"{name} Junction"
        new_json_path = os.path.join(svg_dir, f"Mock_{name}_junctions.json")
        with open(new_json_path, "w", encoding="utf-8") as f:
            json.dump(j_data, f, indent=2)
            
        # Modify SVG
        # Look for the center label: <text x="..." y="..." text-anchor="middle" fill="#263238" font-size="11" font-weight="700">OLD NAME</text>
        # And <text x="450" y="24" text-anchor="middle" fill="#263238" font-size="15" font-weight="800">OLD NAME JUNCTION</text>
        # We can just use a simple regex replacing any >TEXT< with >new text< where text looks like center title
        short_name = name.split()[0].upper()
        
        # We'll just replace the most prominent titles:
        # 1. >OLD_NAME JUNCTION</text>
        svg_content = re.sub(r'>[^>]+ JUNCTION</text>', f'>{name.upper()} JUNCTION</text>', svg_content)
        # 2. Centre short name which is usually bold font-size="11"
        svg_content = re.sub(r'font-size="11" font-weight="700">[^<]+</text>', f'font-size="11" font-weight="700">{name}</text>', svg_content)

        new_svg_path = os.path.join(svg_dir, f"Mock_{name}_Junction_1.svg")
        with open(new_svg_path, "w", encoding="utf-8") as f:
            f.write(svg_content)
            
        print(f"Created mock for {name}")
        count += 1
        
        if count >= 20:
            break

if __name__ == "__main__":
    create_mock()
