# Seva Sarthak: Unified Traffic & Crowd Management Dashboard

**Winner of the BNMIT Hackathon (First Prize)**

Seva Sarthak is a high-fidelity, interactive digital twin platform designed to optimize urban mobility and public safety. By integrating real-time traffic simulation with crowd management analytics, the platform empowers city administrators to make data-driven decisions.

## 🚀 Features

- **Digital Twin Traffic Simulation**: A physics-based micro-simulation engine that models vehicle behavior, priority yielding (e.g., for emergency vehicles), and traffic signal synchronization.
- **Interactive Signal Control**: Manually toggle signal phases or allow the integrated Gemini AI to suggest optimal timings based on congestion levels.
- **Crowd Management Dashboard**: Real-time visualization of pedestrian density and hotspot analytics.
- **Dynamic Design System**: Premium, dark-mode-first aesthetic with a global theme toggle and glassmorphism-inspired UI components.
- **Data-Driven Insights**: Powered by historical Bengaluru traffic datasets and real-time processing scripts.

## 🛠️ Technology Stack

- **Frontend**: React.js, Vanilla CSS (Design System), SVG (High-Performance Rendering)
- **Backend/Sim**: Python (Data Processing, Physics Modeling)
- **APIs**: Google Gemini (AI Context Analysis)
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
