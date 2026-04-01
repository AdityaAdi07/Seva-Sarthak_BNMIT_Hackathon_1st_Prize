# Seva Sarthak: Unified Traffic & Crowd Management Dashboard

**Winner of the BNMIT Hackathon (First Prize)**

Seva Sarthak is a high-fidelity, interactive digital twin platform designed to optimize urban mobility and public safety. By integrating real-time traffic simulation with crowd management analytics, the platform empowers city administrators to make data-driven decisions.

## 🚀 Features

- **Digital Twin Traffic Simulation**: A physics-based micro-simulation engine that models vehicle behavior, priority yielding (e.g., for emergency vehicles), and traffic signal synchronization.
- **Interactive Signal Control**: Manually toggle signal phases or allow the integrated Gemini AI to suggest optimal timings based on congestion levels.
- **Crowd Management Dashboard**: Real-time visualization of pedestrian density and hotspot analytics.
- **Dynamic Design System**: Premium, dark-mode-first aesthetic with a global theme toggle and glassmorphism-inspired UI components.
- **Data-Driven Insights**: Powered by historical Bengaluru traffic datasets and real-time processing scripts.

## Gallery
<img width="1919" height="963" alt="Screenshot 2026-03-27 133617" src="https://github.com/user-attachments/assets/4cd329bb-118a-474c-a9fb-5d2efe767e2a" />
<img width="1908" height="943" alt="Screenshot 2026-03-27 133535" src="https://github.com/user-attachments/assets/2b8c40fd-9699-44c2-b651-b90d4604469d" />
<img width="1778" height="884" alt="Screenshot 2026-03-27 133729" src="https://github.com/user-attachments/assets/9bcafe57-647e-4833-9977-000728a4c509" />
<img width="709" height="888" alt="Screenshot 2026-03-25 114502" src="https://github.com/user-attachments/assets/94c9c154-36d1-4ca7-be63-b19d62806996" />
<img width="1898" height="961" alt="Screenshot 2026-03-27 123931" src="https://github.com/user-attachments/assets/3c91539a-b4ff-4da5-96b0-f5534f08cb11" />
<img width="1866" height="970" alt="Screenshot 2026-03-27 124052" src="https://github.com/user-attachments/assets/5469060f-9b85-4126-bfc2-597162993f4a" />


## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Leaflet, React-Leaflet, Lucide-React
- **Styling**: Vanilla CSS (Custom Design System with Light/Dark Mode)
- **Physics Engine**: Physics-based Micro-Simulation Engine (Custom)
- **AI Integration**: Google Gemini API for optimized traffic analysis
- **Data Analytics**: Python, Historical Bengaluru Traffic Dataset
- **Database**: MongoDB Atlas

## 📂 Project Structure

- `sim/`: React application containing the dashboard and micro-simulation engine.
- `data/`: Processed datasets and configuration for Bengaluru's traffic junctions.
- `Scripts/`:
    - `generate_map.py`: Logic for SVG map generation from spatial data.
    - `junction_signal_renderer.py`: Handles signal phase rendering logic.
    - `build_react_data.py`: Pre-processes raw traffic data for frontend consumption.

## ⚙️ Setup and Installation

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### Frontend Setup
```bash
cd sim
npm install
npm run dev
```

### Data Processing
```bash
pip install -r requirements.txt # Coming soon
python build_react_data.py
```

## 📈 Impact
Designed as a scalable solution for Bengaluru's traffic challenges, Seva Sarthak provides a unified interface for emergency vehicle preemption and congestion mitigation, significantly reducing emergency response times and improving commuter flow.

---
*Developed for the BNMIT Hackathon.*
