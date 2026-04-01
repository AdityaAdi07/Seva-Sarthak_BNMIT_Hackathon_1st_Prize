import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import joblib
import os
import re

print("Parsing bengaluru_festivals_traffic.csv...")
# Load the CSV
events_df = pd.read_csv("../bengaluru_festivals_traffic.csv")

HOTSPOTS = [
    "Commercial Street", "MG Road", "Brigade Road", "Indiranagar", 
    "Koramangala", "UB City", "VV Puram Food Street", "Lalbagh Botanical Garden", 
    "Cubbon Park", "ISKCON", "Bull Temple", "Ranga Shankara", "Fun World"
]

# Quick helper to map CSV months to integer months
def parse_months(when_str):
    month_map = {
        'jan': 1, 'feb': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
        'july': 7, 'aug': 8, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    months = []
    when_str = str(when_str).lower()
    for m_name, m_num in month_map.items():
        if m_name in when_str:
            months.append(m_num)
    if not months and 'lunar' in when_str:
        months = [3, 4] # Approx fallback for Eid if we are doing static generic years
    return months

def parse_peak_hours(hours_str):
    try:
        # e.g., "10 PM ; 3 AM" -> [22, 23, 0, 1, 2, 3]
        parts = str(hours_str).split(';')
        if len(parts) != 2: return list(range(17, 22)) # default evening
        
        def to_24h(t_str):
            t_str = t_str.strip().upper()
            hour = int(re.findall(r'\d+', t_str)[0])
            if 'PM' in t_str and hour != 12: hour += 12
            if 'AM' in t_str and hour == 12: hour = 0
            return hour
            
        start_h = to_24h(parts[0])
        end_h = to_24h(parts[1])
        
        if end_h < start_h: # goes past midnight
            return list(range(start_h, 24)) + list(range(0, end_h + 1))
        return list(range(start_h, end_h + 1))
    except:
        return list(range(17, 22))

# Extract parsed rules for each event
event_rules = []
for idx, row in events_df.iterrows():
    months = parse_months(row['when'])
    peak_hours = parse_peak_hours(row['peak_hours_of_day'])
    
    # Map to our exact 13 HOTSPOTS, if missing, default to some related
    loc_str = str(row['locations']).lower()
    affected_hotspots = []
    if "commercial street" in loc_str: affected_hotspots.append("Commercial Street")
    if "brigade road" in loc_str: affected_hotspots.append("Brigade Road")
    if "cubbon park" in loc_str: affected_hotspots.append("Cubbon Park")
    if "bull temple" in loc_str or "basavanagudi" in loc_str: affected_hotspots.append("Bull Temple")
    if "mg road" in loc_str: affected_hotspots.append("MG Road")
    
    # If no exact match to our 13 hotspots, just pick central ones
    if not affected_hotspots:
        affected_hotspots = ["MG Road", "Brigade Road", "Commercial Street"]
        
    event_rules.append({
        "name": row['name'],
        "months": months,
        "peak_hours": peak_hours,
        "hotspots": affected_hotspots
    })

print("Generating Dynamic Mock Dataset...")
start_date = datetime(2024, 1, 1)
end_date = datetime(2025, 12, 31)

data = []

current_date = start_date
while current_date <= end_date:
    day_of_week = current_date.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    cur_month = current_date.month
    
    # Figure out the event of the day
    daily_event = "None"
    active_rule = None
    for rule in event_rules:
        # If it happens in this month, give it a 25% chance of being active
        if cur_month in rule["months"] and random.random() < 0.25:
            daily_event = rule['name']
            active_rule = rule
            break
            
    if daily_event == "None" and is_weekend and random.random() < 0.3:
        daily_event = "Standard Weekend"

    for location in HOTSPOTS:
        for hour in range(8, 24):
            base_traffic = random.randint(1000, 5000)
            traffic_volume = base_traffic + (1000 if is_weekend else 0)
            
            # Base Crowd logic
            base_crowd = random.randint(5000, 15000)
            
            if location in ["Commercial Street", "MG Road", "Brigade Road"]:
                base_crowd = int(base_crowd * 1.5)
            
            # Apply generic evening spike if no specific active rule applies here
            if 17 <= hour <= 21:
                base_crowd = int(base_crowd * 1.4)
                
            # Now apply real logic from the CSV
            event_for_row_logic = "None"
            if daily_event == "Standard Weekend":
                event_for_row_logic = "Standard Weekend"
                base_crowd = int(base_crowd * 1.5)
            elif active_rule and location in active_rule['hotspots']:
                event_for_row_logic = active_rule['name']
                # Determine Event Tier
                e_name = active_rule['name'].lower()
                tier = 3
                if "karaga" in e_name or "dasara" in e_name or "new year" in e_name:
                    tier = 1
                elif "deepavali" in e_name or "eid" in e_name:
                    tier = 2
                
                # If this location is hosting the event and we are in its peak hours!
                if hour in active_rule['peak_hours']:
                    if tier == 1:
                        base_crowd = int(base_crowd * 15.0) # 150k - 200k+
                        traffic_volume += random.randint(10000, 20000)
                    elif tier == 2:
                        base_crowd = int(base_crowd * 8.0) # 40k - 100k
                        traffic_volume += random.randint(5000, 10000)
                    else:
                        base_crowd = int(base_crowd * 4.0) # 20k - 60k
                        traffic_volume += random.randint(2000, 5000)
                else:
                    base_crowd = int(base_crowd * (3.8 if tier == 1 else 2.5 if tier == 2 else 1.8))
            
            crowd_density = base_crowd + int(traffic_volume * 0.4) + random.randint(-50, 50)
            
            data.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "hour": hour,
                "day_of_week": day_of_week,
                "is_weekend": is_weekend,
                "location": location,
                "event": event_for_row_logic,
                "traffic_volume": traffic_volume,
                "crowd_density": max(0, crowd_density)
            })
            
    current_date += timedelta(days=1)

df = pd.DataFrame(data)
df.to_csv("bengaluru_simulated_crowd_data.csv", index=False)
print(f"Generated {len(df)} records. Saved dynamically to bengaluru_simulated_crowd_data.csv")

print("Training Random Forest Regressor on highly accurate event metadata...")
le_loc = LabelEncoder()
le_event = LabelEncoder()

df['location_encoded'] = le_loc.fit_transform(df['location'])

all_possible_events = ["None", "Standard Weekend"] + events_df['name'].tolist()
le_event.fit(all_possible_events)
df['event_encoded'] = le_event.transform(df['event'])

X = df[['hour', 'day_of_week', 'is_weekend', 'location_encoded', 'event_encoded', 'traffic_volume']]
y = df['crowd_density']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42)
model.fit(X_train, y_train)

score = model.score(X_test, y_test)
print(f"Algorithm trained with Real CSV Metadata! R^2 Score on Test Set: {score:.4f}")

os.makedirs("models", exist_ok=True)
joblib.dump(model, "models/rf_crowd_model.pkl")
joblib.dump(le_loc, "models/le_loc.pkl")
joblib.dump(le_event, "models/le_event.pkl")
print("Models overwritten successfully. FastAPI will detect this upon next restart/live prediction!")
