import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { junctions, mapCenter } from './data';
import 'leaflet/dist/leaflet.css';
import { X, Search, Activity, AlertTriangle, Clock, Cloud, Info, Zap, Shield, Siren, SlidersHorizontal, TrendingUp, Radio, Construction, Target } from 'lucide-react';
import './App.css';
import { MicroSimEngine } from './MicroSim';

const getDistance = (lat1, lon1, lat2, lon2) => {
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
};

const SCENARIOS = [
  { id: 'chinnaswamy', name: 'Cricket Match Surge (Stadium)', type: 'spike', points: [{ lat: 12.9788, lon: 77.5996, radius: 0.05, severity: 5000 }], desc: 'M. Chinnaswamy Stadium overloaded. 5km radius heavily choked.' },
  { id: 'diwali', name: 'Deepavali Festival (City-Wide)', type: 'global_spike', severity: 2500, peakStart: 18, peakEnd: 22, desc: 'City-wide shopping & travel surge. Extra traffic applies dynamically between 6PM and 10PM.' },
  { id: 'ny_parade', name: 'New Year Parade (MG Road Blockade)', type: 'roadblocks', blocks: [{ lat: 12.9760, lon: 77.6010 }], radius: 0.02, desc: 'MG Road entirely closed for marching. Massive spillover to nearby roads.' },
  { id: 'metro_construction', name: 'Metro Construction Collapse', type: 'roadblocks', blocks: [{ lat: 12.9304, lon: 77.5835 }, { lat: 12.9165, lon: 77.5950 }, {lat: 12.9250, lon: 77.6250}], radius: 0.02, desc: 'Silk Board, Jayanagar, and Koramangala active crane sites causing localized blockades.'},
  { id: 'flooding', name: 'Monsoon Flash Floods', type: 'weather', severity: 3500, radius: 0.08, points: [{lat: 12.9250, lon: 77.6250}, {lat: 13.0068, lon: 77.5813}], desc: 'Koramangala and Malleshwaram drain overflow. Rapid capacity dropout.' }
];

// Fix leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const normalIcon = L.divIcon({
  className: 'custom-marker-wrapper',
  html: '<div class="custom-marker"></div>',
  iconSize: [24, 24], iconAnchor: [12, 12]
});

const chokedIcon = L.divIcon({
  className: 'custom-marker-wrapper',
  html: '<div class="custom-marker choked"></div>',
  iconSize: [24, 24], iconAnchor: [12, 12]
});

const greenWaveIcon = L.divIcon({
  className: 'custom-marker-wrapper',
  html: '<div class="custom-marker wave"></div>',
  iconSize: [24, 24], iconAnchor: [12, 12]
});

const predictIcon = L.divIcon({
  className: 'custom-marker-wrapper',
  html: '<div class="custom-marker predict"></div>',
  iconSize: [24, 24], iconAnchor: [12, 12]
});

const closedIcon = L.divIcon({
  className: 'custom-marker-wrapper',
  html: '<div class="custom-marker closed"><div style="font-size: 10px; color: white;">🚧</div></div>',
  iconSize: [24, 24], iconAnchor: [12, 12]
});

const transitIcon = L.divIcon({
  className: 'custom-marker-wrapper',
  html: '<div class="custom-marker transit"><div style="font-size: 10px; color: white;">🚶</div></div>',
  iconSize: [24, 24], iconAnchor: [12, 12]
});

function MapController({ selectedJunction }) {
  const map = useMap();

  useEffect(() => {
    // Force Leaflet to recalculate container bounds on load
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (selectedJunction) {
      map.flyTo([selectedJunction.lat, selectedJunction.lon], 15, { duration: 1.5 });
    }
  }, [selectedJunction, map]);

  return null;
}

export default function App() {
  const [filterChoked, setFilterChoked] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedJunction, setSelectedJunction] = useState(null);
  const [simulationOpen, setSimulationOpen] = useState(false);

  // New State for Timeline Simulation
  const [currentHour, setCurrentHour] = useState(12); // Default noon
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Control Panel States
  const [trafficMode, setTrafficMode] = useState('Normal');
  const [policeStatus, setPoliceStatus] = useState('');
  const [ambulanceLane, setAmbulanceLane] = useState('Lane 1');
  const [ambulanceStatus, setAmbulanceStatus] = useState('');
  
  // Advanced Simulation States
  const [predictiveMode, setPredictiveMode] = useState(false);
  const [greenWaveRoute, setGreenWaveRoute] = useState(null);

  // Sandbox Digital Twin States
  const [closedJunctions, setClosedJunctions] = useState(new Set());
  const [activeScenarioId, setActiveScenarioId] = useState('');

  const [liveTransit, setLiveTransit] = useState(false);
  const [transitNodes, setTransitNodes] = useState([]);

  // AV Simulation Mode
  const [microSimActive, setMicroSimActive] = useState(false);
  const microSimRef = useRef(null);

  // Global Policies
  const [lezActive, setLezActive] = useState(false);
  const [tollActive, setTollActive] = useState(false);

  useEffect(() => {
    let interval;
    if (liveTransit && junctions.length > 0) {
      setTransitNodes([...junctions].sort(() => 0.5 - Math.random()).slice(0, 3).map(j => j.id));
      interval = setInterval(() => {
        setTransitNodes([...junctions].sort(() => 0.5 - Math.random()).slice(0, 3).map(j => j.id));
      }, 7000);
    } else {
      setTransitNodes([]);
    }
    return () => clearInterval(interval);
  }, [liveTransit]);

  const activeScenario = SCENARIOS.find(s => s.id === activeScenarioId);

  // Map junctions to attach hour status
  let currentJunctions = junctions.map(jn => {
    const currentData = jn.hourly.find(h => h.hour === currentHour);

    // Check next 2 hours
    let peakSoon = false;
    for (let i = 1; i <= 2; i++) {
      let checkHour = (currentHour + i) % 24;
      if (jn.hourly.find(h => h.hour === checkHour)?.choked) {
        peakSoon = true;
      }
    }

    return {
      ...jn,
      isChokedNow: currentData?.choked || false,
      peakSoon: peakSoon,
      currentVolume: currentData?.volume || 0,
      isClosed: false
    }
  });

  // Sandbox: Event Scenarios
  if (activeScenario) {
     currentJunctions = currentJunctions.map(jn => {
        let addedVolume = 0;

        if (activeScenario.type === 'spike' || activeScenario.type === 'weather') {
           activeScenario.points.forEach(p => {
              if (getDistance(jn.lat, jn.lon, p.lat, p.lon) < p.radius) {
                 addedVolume += p.severity;
              }
           });
        }
        else if (activeScenario.type === 'global_spike') {
           if (currentHour >= activeScenario.peakStart && currentHour <= activeScenario.peakEnd) {
               addedVolume += activeScenario.severity;
           }
        }
        else if (activeScenario.type === 'roadblocks') {
           let blocked = false;
           activeScenario.blocks.forEach(b => {
              if (getDistance(jn.lat, jn.lon, b.lat, b.lon) < activeScenario.radius) {
                 blocked = true;
              }
           });
           if (blocked) return { ...jn, currentVolume: 0, isChokedNow: true, isClosed: true };
        }

        const newVol = jn.currentVolume + addedVolume;
        return { 
           ...jn, 
           currentVolume: newVol, 
           isChokedNow: jn.isClosed ? true : (addedVolume > 0 || newVol > 4500 ? true : jn.isChokedNow) 
        };
     });
  }

  // Sandbox: Roadblock Rerouting (Manual + Scenario mapped)
  const allClosed = currentJunctions.filter(j => j.isClosed || closedJunctions.has(j.id)).map(j => j.id);

  if (allClosed.length > 0) {
      const volumeToDistribute = new Map();
      allClosed.forEach(closedId => {
          const closedNode = currentJunctions.find(j => j.id === closedId);
          if(closedNode) {
              const others = currentJunctions.filter(j => j.id !== closedId && !allClosed.includes(j.id));
              others.sort((a,b) => getDistance(closedNode.lat, closedNode.lon, a.lat, a.lon) - getDistance(closedNode.lat, closedNode.lon, b.lat, b.lon));
              const nearest3 = others.slice(0, 3);
              const spill = Math.floor(closedNode.currentVolume / 3);
              nearest3.forEach(n => volumeToDistribute.set(n.id, (volumeToDistribute.get(n.id) || 0) + spill));
          }
      });
      currentJunctions = currentJunctions.map(jn => {
          if (allClosed.includes(jn.id)) {
              return { ...jn, currentVolume: 0, isChokedNow: true, isClosed: true };
          }
          if (volumeToDistribute.has(jn.id)) {
              const addedVolume = volumeToDistribute.get(jn.id);
              const newVol = jn.currentVolume + addedVolume;
              return { ...jn, currentVolume: newVol, isChokedNow: newVol > 5500 }; 
          }
           return jn;
      });
  }

  // Global Policy Overrides: LEZ & Tolling
  if (lezActive || tollActive) {
      currentJunctions = currentJunctions.map(jn => {
          if (jn.isClosed) return jn;
          let vol = jn.currentVolume;
          if (lezActive) vol = Math.floor(vol * 0.80);
          if (tollActive) vol = Math.floor(vol * 0.85);
          
          let choked = (vol > 4500 || (jn.isChokedNow && vol > 3500));
          return { ...jn, currentVolume: vol, isChokedNow: choked };
      });
  }

  const filteredJunctions = currentJunctions.filter(jn => {
    if (filterChoked && !jn.isChokedNow) return false;
    if (search && !jn.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalNodes = currentJunctions.length;
  const chokedNodes = currentJunctions.filter(j => j.isChokedNow).length;
  const aqiStat = 45 + (chokedNodes * 12);

  const handleSelect = (jn) => {
    setSelectedJunction(jn);
    setSimulationOpen(true);
    setAiSummary(null);
    setTrafficMode('Normal');
    setPoliceStatus('');
    setAmbulanceStatus('');
    setPredictiveMode(false);
    setGreenWaveRoute(null);
    
    if(microSimRef.current) { microSimRef.current.stop(); microSimRef.current = null; }
    setMicroSimActive(false);
  };

  const getGeminiSummary = async (junction) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
      setAiSummary("Please configure VITE_GEMINI_API_KEY in the .env file to enable AI.");
      return;
    }

    setLoadingAi(true);
    try {
      const prompt = `Act as an expert traffic analyst. Analyze junction: ${junction.name} at Hour: ${currentHour}:00. Current volume is ${junction.currentVolume}. Weather is ${junction.weather}. Provide your analysis STRICTLY in the following format with exactly 5 keys. KEEP EACH VALUE EXTREMELY CRISP AND POINTWISE (MAX 10 WORDS per value):
REASON: <short exact cause>
CLEARANCE: <exact time estimate>
WEATHER: <short impact>
PREVIOUS DAY RESULT: <status of traffic from yesterday>
GOVT BUSES: <estimated number passing per hour>`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.message || "Unknown API Error");
      }
      // Parse the returned Key-Value pairs
      const rawText = data.candidates[0].content.parts[0].text.trim();
      const pairs = rawText.split('\n').filter(line => line.includes(':')).map(line => {
        const [key, ...rest] = line.split(':');
        return { key: key.trim().replace(/\*/g, ''), value: rest.join(':').trim().replace(/\*/g, '') };
      });
      setAiSummary(pairs.length > 0 ? pairs : [{ key: "ERROR", value: "Failed to parse API output format" }]);
    } catch (err) {
      console.error(err);
      setAiSummary([{ key: "ERROR", value: `Failed to generate summary: ${err.message}` }]);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    if(!simulationOpen || !selectedJunction) return;
    const obj = document.getElementById('live-svg-object');
    if(!obj) return;
    
    const updateSVG = () => {
      try {
        const svgDoc = obj.contentDocument;
        if(!svgDoc) return;

        // Clean up from previous states if turning them off
        const prevBgRect = svgDoc.querySelector('rect[fill="#020617"]');
        if(prevBgRect && !predictiveMode) prevBgRect.setAttribute('fill', '#f4f7f6');
        const prevGridPath = svgDoc.querySelector('path[stroke="#334155"]');
        if(prevGridPath && !predictiveMode) prevGridPath.setAttribute('stroke', '#eceff1');
        const oldRadar = svgDoc.getElementById('radar-scan');
        if(oldRadar && !predictiveMode) oldRadar.remove();
        
        const isClosed = closedJunctions.has(selectedJunction.id);
        const isTransitDrop = transitNodes.includes(selectedJunction.id);
        const isChoked = selectedJunction.isChokedNow || isClosed;
        let basePulse = isChoked ? 'chokePulse' : 'safePulse';
        let mainFill = isChoked ? '#ef4444' : '#10b981';

        if (trafficMode === 'All Red' || isTransitDrop) { // Pedestrian scramble forces red
          mainFill = '#ef4444';
          basePulse = 'chokePulse';
        } else if (trafficMode === 'All Green' || greenWaveRoute) {
          mainFill = '#10b981';
          basePulse = 'safePulse';
        }

        // Visualize Pedestrian Swarm
        let pSwarm = svgDoc.getElementById('pedestrian-swarm');
        if (isTransitDrop && !isClosed) {
            if (!pSwarm) {
                pSwarm = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
                pSwarm.id = 'pedestrian-swarm';
                for(let i=0; i<70; i++){
                    let dot = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    let cx = 330 + Math.random()*240;
                    let cy = 180 + Math.random()*200;
                    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('r', '4');
                    dot.setAttribute('fill', '#f59e0b');
                    dot.setAttribute('class', 'pedestrian-dot');
                    dot.style.animationDelay = `-${Math.random()*5}s`;
                    pSwarm.appendChild(dot);
                }
                svgDoc.documentElement.appendChild(pSwarm);
            }
        } else {
            if (pSwarm) pSwarm.remove();
        }

        // Apply Micro-Simulation Physics Layer
        if (microSimActive && !isClosed) {
            if (!microSimRef.current) {
                microSimRef.current = new MicroSimEngine(svgDoc, { trafficMode, isClosed, ambulanceStatus, greenWaveRoute });
            } else {
                microSimRef.current.updateState({ trafficMode, isClosed, ambulanceStatus, greenWaveRoute });
            }
        } else {
            if (microSimRef.current) {
                microSimRef.current.stop();
                microSimRef.current = null;
            }
        }

        if (isClosed) {
           mainFill = '#0f172a'; // dark construction grey
           basePulse = '';
           const bgRect = svgDoc.querySelector('rect[fill="#f4f7f6"]') || svgDoc.querySelector('rect[fill="#020617"]');
           if(bgRect) bgRect.setAttribute('fill', '#fef2f2'); // warning red background tint
        }

        if (predictiveMode && !isClosed) {
          mainFill = '#a855f7'; // forecasting purple
          basePulse = 'predictPulse';
          
          let radar = svgDoc.getElementById('radar-scan');
          if(!radar) {
              radar = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'circle');
              radar.id = 'radar-scan';
              radar.setAttribute('r', '150');
              radar.setAttribute('cx', '450');
              radar.setAttribute('cy', '280');
              radar.setAttribute('fill', 'none');
              radar.setAttribute('stroke', '#a855f7');
              radar.setAttribute('stroke-width', '4');
              radar.style.transformOrigin = '450px 280px';
              // Prepend so it sits behind circles
              svgDoc.documentElement.insertBefore(radar, svgDoc.documentElement.childNodes[5]);
          }
          radar.style.animation = 'radarExpand 2.5s infinite';
        }

        const circles = svgDoc.querySelectorAll('circle[r="32"], circle[r="30"]');
        circles.forEach(c => {
           let finalFill = mainFill;
           let finalPulse = basePulse;
           
           if (ambulanceStatus) {
               const cx = parseFloat(c.getAttribute('cx') || 0);
               const cy = parseFloat(c.getAttribute('cy') || 0);
               let isMyLane = false;
               if (ambulanceLane.includes('North') && cy < 250) isMyLane = true;
               if (ambulanceLane.includes('South') && cy > 350) isMyLane = true;
               if (ambulanceLane.includes('East') && cx > 550) isMyLane = true;
               if (ambulanceLane.includes('West') && cx < 350) isMyLane = true;

               if (isMyLane) {
                   finalFill = '#3b82f6';
                   finalPulse = 'emergencyPulse';
               } else {
                   finalFill = '#ef4444';
                   finalPulse = 'chokePulse';
               }
           }
           
           c.setAttribute('fill', finalFill);
           c.style.animation = `${finalPulse} 1s infinite`; 
        });
        
        const texts = svgDoc.querySelectorAll('text');
        texts.forEach(t => {
           const txt = t.textContent;
           if(txt.includes('Optimal Traffic') || txt.includes('Critical Traffic') || txt.includes('Traffic \u2713') || txt.includes('Heavy Traffic') || txt.includes('System Override') || txt.includes('GREEN WAVE') || txt.includes('PREDICTED FLOW') || txt.includes('JUNCTION CLOSED') || txt.includes('PEDESTRIAN SCRAMBLE')) {
              if (isClosed) {
                  t.textContent = 'JUNCTION CLOSED \uD83D\uDEA7';
                  t.setAttribute('fill', '#ef4444');
              } else if (predictiveMode) {
                  t.textContent = 'GNN T+1H PREDICTED FLOW \u2728';
                  t.setAttribute('fill', '#a855f7');
              } else if (isTransitDrop) {
                  t.textContent = 'MASS TRANSIT PEDESTRIAN SCRAMBLE \uD83D\uDEB6';
                  t.setAttribute('fill', '#f59e0b');
              } else if (trafficMode === 'All Red') {
                  t.textContent = 'System Override: ALL RED \u26D4';
                  t.setAttribute('fill', '#ef4444');
              } else if (trafficMode === 'All Green' || greenWaveRoute) {
                  t.textContent = greenWaveRoute ? 'GREEN WAVE ACTIVE \u26A1' : 'System Override: ALL GREEN \ud83d\udfe2';
                  t.setAttribute('fill', '#10b981');
              } else {
                  t.textContent = isChoked ? 'Critical Traffic \u26A0\uFE0F' : 'Optimal Traffic \u2713';
                  t.setAttribute('fill', isChoked ? '#ef4444' : '#2e7d32');
              }
           }

           if (txt.includes('Junction •') || txt.includes('POLICE RESPONDING')) {
               if (policeStatus) {
                   t.textContent = 'POLICE RESPONDING \ud83d\ude93';
                   t.setAttribute('fill', '#2563eb');
                   t.setAttribute('font-weight', '800');
               } else {
                   t.textContent = 'Junction \u2022 ' + (selectedJunction.control || 'FIXED');
                   t.setAttribute('fill', '#78909c');
                   t.setAttribute('font-weight', 'normal');
               }
           }
           
           if(txt.includes('v/c:') || txt.includes('Forecast v/c:')) {
              if (predictiveMode) {
                  t.textContent = `Forecast v/c: ${(isChoked ? 1.05 + Math.random()*0.3 : 0.6 + Math.random()*0.4).toFixed(2)}`;
                  t.setAttribute('fill', '#d946ef');
              } else {
                  t.textContent = `v/c: ${(isChoked ? 0.9 + Math.random()*0.3 : 0.3 + Math.random()*0.4).toFixed(2)}`;
                  t.setAttribute('fill', isChoked ? '#ef4444' : '#2e7d32');
              }
           }
           
           if (txt.includes('Time Slot:') || txt.includes('GNN FORECAST MAP')) {
               if (predictiveMode) {
                   t.textContent = 'GNN FORECAST MAP | T+60m Offset Simulation | Matrix Analysis';
                   t.setAttribute('fill', '#8b5cf6');
               } else {
                   const slot = selectedJunction.timings && selectedJunction.timings[0] ? `${selectedJunction.timings[0].from_time} - ${selectedJunction.timings[0].to_time}` : '08:00 - 11:00';
                   t.textContent = `Time Slot: ${slot} |  Control: ${selectedJunction.control || 'FIXED'} Signal`;
                   t.setAttribute('fill', '#78909c');
               }
           }
        });

        let style = svgDoc.getElementById('live-sim-style');
        if(!style) {
           style = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
           style.id = 'live-sim-style';
           svgDoc.documentElement.insertBefore(style, svgDoc.documentElement.firstChild);
        }
        style.textContent = `
          circle[r="32"], circle[r="30"] { 
             transition: fill 0.4s ease; 
          }
          @keyframes chokePulse { 
             0% { stroke: rgba(239, 68, 68, 0.4); stroke-width: 0; } 
             50% { stroke: rgba(239, 68, 68, 0.4); stroke-width: 25px; } 
             100% { stroke: rgba(239, 68, 68, 0); stroke-width: 0; } 
          }
          @keyframes safePulse { 
             0% { stroke: rgba(16, 185, 129, 0.2); stroke-width: 0; } 
             50% { stroke: rgba(16, 185, 129, 0.2); stroke-width: 15px; } 
             100% { stroke: rgba(16, 185, 129, 0); stroke-width: 0; } 
          }
          @keyframes emergencyPulse { 
             0% { stroke: rgba(59, 130, 246, 0.5); stroke-width: 0; } 
             50% { stroke: rgba(59, 130, 246, 0.5); stroke-width: 35px; } 
             100% { stroke: rgba(59, 130, 246, 0); stroke-width: 0; } 
          }
          @keyframes predictPulse { 
             0% { stroke: rgba(168, 85, 247, 0.4); stroke-width: 0; } 
             50% { stroke: rgba(168, 85, 247, 0.4); stroke-width: 20px; } 
             100% { stroke: rgba(168, 85, 247, 0); stroke-width: 0; } 
          }
          @keyframes radarExpand {
             0% { transform: scale(0.3); opacity: 1; stroke-width: 15px; }
             100% { transform: scale(3.0); opacity: 0; stroke-width: 1px; }
          }
          .pedestrian-dot {
             animation: walkDot 3s ease-in-out infinite alternate;
             transform-origin: center;
          }
          @keyframes walkDot {
             0% { transform: translate(0, 0); opacity: 1; }
             100% { transform: translate(15px, -15px); opacity: 0.4; }
          }
        `;
      } catch(e) { }
    };

    // Run immediately if loaded, and also attach to load in case it hasn't loaded yet
    updateSVG();
    obj.addEventListener('load', updateSVG);
    return () => obj.removeEventListener('load', updateSVG);
  }, [selectedJunction, currentHour, simulationOpen, trafficMode, ambulanceStatus, ambulanceLane, policeStatus, greenWaveRoute, predictiveMode, closedJunctions, transitNodes, microSimActive]);

  return (
    <div className="layout">
      {/* Sidebar UI */}
      <div className="sidebar">
        <div className="sidebar-header" style={{ flex: 1, overflowY: 'auto', borderBottom: 'none' }}>
          <div className="logo-area">
            <Activity className="text-primary" size={24} />
            <h2>Smart Traffic UI</h2>
          </div>
          <p className="subtitle">Bengaluru Control Dashboard</p>

          <div className="time-slider-container">
            <div className="time-slider-header">
              <Clock size={16} />
              <span>Simulation Time: <b>{currentHour.toString().padStart(2, '0')}:00</b></span>
            </div>
            <input
              type="range" min="0" max="23"
              value={currentHour}
              onChange={(e) => setCurrentHour(parseInt(e.target.value))}
              className="time-slider"
            />
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-val">{totalNodes}</span>
              <span className="stat-lbl">Active Nodes</span>
            </div>
            <div className="stat-box">
              <span className="stat-val choked">{chokedNodes}</span>
              <span className="stat-lbl">Choked Now</span>
            </div>
          </div>

          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search junctions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-row">
            <button
              className={`btn-filter ${filterChoked ? 'active' : ''}`}
              onClick={() => setFilterChoked(!filterChoked)}
            >
              <AlertTriangle size={14} />
              {filterChoked ? 'Show All' : 'Critical Only'}
            </button>
          </div>
          
          <div className="sandbox-panel" style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
             <h3 style={{ fontSize: '13px', margin: '0 0 12px 0', display: 'flex', alignItems:'center', gap: '6px' }}><Target size={14} /> City-Wide Master Events</h3>
             
             <select 
               className="ctrl-select" 
               style={{ width: '100%', marginBottom: '8px' }} 
               value={activeScenarioId} 
               onChange={(e) => setActiveScenarioId(e.target.value)}
             >
                <option value="">No Active Scenario (Normal)</option>
                {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             
             {activeScenario && <p style={{fontSize: '11px', color: '#dc2626', marginTop: '6px', lineHeight: '1.4'}}><strong>System Active: </strong> {activeScenario.desc}</p>}
          </div>

          <div className="sandbox-panel" style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
             <h3 style={{ fontSize: '13px', margin: '0 0 12px 0', display: 'flex', alignItems:'center', gap: '6px' }}><Activity size={14} /> Mass Transit API</h3>
             <button className={`ctrl-btn ${liveTransit ? 'warning' : ''}`} style={{ width: '100%', padding: '8px', fontSize: '12px', background: liveTransit ? '#fffbeb' : '#fff', border: '1px solid ' + (liveTransit ? '#f59e0b' : '#e2e8f0'), color: liveTransit ? '#b45309' : '#334155', borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }} onClick={() => setLiveTransit(!liveTransit)}>
                {liveTransit ? 'Disable Transit Drop Simulator' : 'Simulate Metro/Bus Arrivals'}
             </button>
             {liveTransit && <p style={{fontSize: '11px', color: '#b45309', marginTop: '6px', lineHeight: '1.4'}}>Simulating mass transit drops. Approaching metros and buses will auto-trigger pedestrian safety scrambles.</p>}
          </div>

          <div className="sandbox-panel" style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
             <h3 style={{ fontSize: '13px', margin: '0 0 12px 0', display: 'flex', alignItems:'center', gap: '6px' }}><Cloud size={14} /> Environmental Control (AQI)</h3>
             
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
               <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Network AQI:</span>
               <span style={{ fontSize: '18px', fontWeight: 'bold', color: aqiStat > 150 ? '#ef4444' : (aqiStat > 100 ? '#f59e0b' : '#10b981') }}>{aqiStat}</span>
             </div>

             <button className={`ctrl-btn ${lezActive ? 'success' : ''}`} style={{ width: '100%', padding: '8px', fontSize: '12px', background: lezActive ? '#ecfdf5' : '#fff', border: '1px solid ' + (lezActive ? '#10b981' : '#e2e8f0'), color: lezActive ? '#059669' : '#334155', borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }} onClick={() => setLezActive(!lezActive)}>
                {lezActive ? 'Disable LEZ Restrictions' : 'Enforce Low Emission Zone'}
             </button>
             {lezActive && <p style={{fontSize: '11px', color: '#059669', marginTop: '6px', lineHeight: '1.4'}}>Heavy polluting vehicles inherently diverted. Overall junction capacity load reduced by exactly 20%.</p>}
          </div>

          <div className="sandbox-panel" style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '40px' }}>
             <h3 style={{ fontSize: '13px', margin: '0 0 12px 0', display: 'flex', alignItems:'center', gap: '6px' }}><TrendingUp size={14} /> Dynamic Congestion Pricing</h3>
             <button className={`ctrl-btn ${tollActive ? 'primary' : ''}`} style={{ width: '100%', padding: '8px', fontSize: '12px', background: tollActive ? '#eff6ff' : '#fff', border: '1px solid ' + (tollActive ? '#3b82f6' : '#e2e8f0'), color: tollActive ? '#2563eb' : '#334155', borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }} onClick={() => setTollActive(!tollActive)}>
                {tollActive ? 'Deactivate Smart Tolling' : 'Activate Peak-Hour Tolling'}
             </button>
             {tollActive && <p style={{fontSize: '11px', color: '#2563eb', marginTop: '6px', lineHeight: '1.4'}}>Surge-pricing applied automatically at heavily choked boundary tolls. Outer network volume drops 15%.</p>}
          </div>
        </div>
      </div>

      {/* Map UI */}
      <div className="map-container-wrapper">
        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <MapController selectedJunction={selectedJunction} />

          {activeScenario && activeScenario.points && activeScenario.points.map((p, idx) => (
             <Circle key={`point-${idx}`} center={[p.lat, p.lon]} pathOptions={{ fillColor: '#ef4444', color: '#ef4444' }} radius={(p.radius || activeScenario.radius) * 100000} stroke={false} fillOpacity={0.15} />
          ))}

          {activeScenario && activeScenario.blocks && activeScenario.blocks.map((b, idx) => (
             <Circle key={`blk-${idx}`} center={[b.lat, b.lon]} pathOptions={{ fillColor: '#ef4444', color: '#ef4444' }} radius={activeScenario.radius * 100000} stroke={false} fillOpacity={0.3} />
          ))}

          {greenWaveRoute && (
            <Polyline positions={greenWaveRoute.map(j => [j.lat, j.lon])} color="#10b981" weight={8} opacity={0.6} dashArray="12, 12" />
          )}

          {filteredJunctions.map((jn) => {
            const isWave = greenWaveRoute && greenWaveRoute.find(g => g.id === jn.id);
            const isTransit = transitNodes.includes(jn.id);
            let activeIcon = normalIcon;
            if (jn.isClosed) activeIcon = closedIcon;
            else if (isTransit) activeIcon = transitIcon;
            else if (isWave) activeIcon = greenWaveIcon;
            else if (predictiveMode && jn.peakSoon) activeIcon = predictIcon;
            else if (predictiveMode && !jn.peakSoon) activeIcon = predictIcon; // or another variation depending on peak
            else if (jn.isChokedNow) activeIcon = chokedIcon;
            
            // To make forecast distinct, apply predictIcon to all in predict mode
            if (predictiveMode && !jn.isClosed) {
               activeIcon = predictIcon;
            }

            return (
              <Marker
                key={jn.id}
                position={[jn.lat, jn.lon]}
                icon={activeIcon}
                eventHandlers={{ click: () => handleSelect(jn) }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Right Sidebar List */}
      <div className="sidebar" style={{ width: '260px', minWidth: '260px', borderRight: 'none', borderLeft: '1px solid var(--border)', boxShadow: '-2px 0 20px rgba(0,0,0,0.05)' }}>
        <div style={{padding: '24px', borderBottom: '1px solid var(--border)', background: '#fff', fontWeight: 600, fontFamily: 'Outfit, sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>Junction Directory</span>
          <span className="badge safe">{filteredJunctions.length} Active</span>
        </div>
        <div className="sidebar-list">
          {filteredJunctions.map((jn) => (
            <div
              key={jn.id}
              className={`list-item ${selectedJunction?.id === jn.id ? 'selected' : ''}`}
              onClick={() => handleSelect(jn)}
            >
              <div className="item-top">
                <span className="item-name">{jn.name}</span>
                {jn.isChokedNow ? (
                  <span className="badge danger">Choked</span>
                ) : (
                  <span className="badge safe">Optimal</span>
                )}
              </div>
              <div className="item-meta">
                <Cloud size={12} /> {jn.weather} &nbsp;|&nbsp;
                {jn.peakSoon && !jn.isChokedNow && <span className="warning-text"><AlertTriangle size={10} /> Peaking in 2h</span>}
              </div>
            </div>
          ))}
          {filteredJunctions.length === 0 && (
            <div className="empty-state" style={{padding: '24px', color: 'var(--text-muted)'}}>No junctions match filters</div>
          )}
        </div>
      </div>

      {/* Simulation Modal */}
      {simulationOpen && selectedJunction && (
        <div className="modal-backdrop" onClick={() => setSimulationOpen(false)}>
          <div className={`modal-content ${microSimActive ? 'fullscreen-sim' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Activity size={18} className="text-primary" />
                {selectedJunction.name} &nbsp; ({currentHour}:00)
              </div>
              <div className="modal-actions">
                <button className="gemini-btn" onClick={() => getGeminiSummary(selectedJunction)} disabled={loadingAi}>
                  <Zap size={16} /> {loadingAi ? "Analyzing..." : "Report"}
                </button>
                <button className="close-btn" onClick={() => setSimulationOpen(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modal-body-flex">
              {/* Left Control Panel */}
              <div className="control-panel">
                <div className="panel-title"><SlidersHorizontal size={16} /> Junction Controls</div>

                {/* 1. Time Control */}
                <div className="control-section">
                  <div className="section-label">Override Time (Peak)</div>
                  <div className="btn-group">
                    <button className="ctrl-btn" onClick={() => setCurrentHour(9)}>Morning Peak</button>
                    <button className="ctrl-btn" onClick={() => setCurrentHour(18)}>Evening Peak</button>
                  </div>
                </div>

                {/* 2. Traffic Light Control */}
                <div className="control-section">
                  <div className="section-label">Signal Override</div>
                  <select className="ctrl-select" value={trafficMode} onChange={(e) => setTrafficMode(e.target.value)}>
                    <option value="Normal">Automated (VAC)</option>
                    <option value="All Red">Force All Red</option>
                    <option value="All Green">Force All Green</option>
                  </select>
                </div>

                {/* 3. Assign Police */}
                <div className="control-section">
                  <div className="section-label">Law Enforcement</div>
                  <button className="ctrl-btn primary" onClick={() => {
                    setPoliceStatus(`Dispatched to ${selectedJunction.name} (${selectedJunction.lat.toFixed(4)}, ${selectedJunction.lon.toFixed(4)})`);
                    setTimeout(() => setPoliceStatus(''), 5000);
                  }}>
                    <Shield size={14} /> Dispatch Police
                  </button>
                  {policeStatus && <div className="status-msg success">{policeStatus}</div>}
                </div>

                {/* 4. Ambulance Priority */}
                <div className="control-section">
                  <div className="section-label">Emergency Corridor</div>
                  <div className="flex-row">
                    <select className="ctrl-select flex-1" value={ambulanceLane} onChange={(e) => setAmbulanceLane(e.target.value)}>
                      <option>Lane 1 (North)</option>
                      <option>Lane 2 (East)</option>
                      <option>Lane 3 (South)</option>
                      <option>Lane 4 (West)</option>
                    </select>
                    <button className="ctrl-btn danger" onClick={() => {
                      setAmbulanceStatus(`${ambulanceLane} cleared for high-priority vehicle.`);
                      setTimeout(() => setAmbulanceStatus(''), 5000);
                    }}>
                      <Siren size={14} /> Clear
                    </button>
                  </div>
                  {ambulanceStatus && <div className="status-msg warning">{ambulanceStatus}</div>}
                </div>

                {/* 5. Advanced Prediction */}
                <div className="control-section">
                  <div className="section-label">AI Forecasting (GNN)</div>
                  <button className={`ctrl-btn ${predictiveMode ? 'primary' : ''}`} onClick={() => setPredictiveMode(!predictiveMode)}>
                    <TrendingUp size={14} /> {predictiveMode ? 'Disable AI Forecast' : 'Enable Predictive Mode'}
                  </button>
                  {predictiveMode && (
                    <div className="status-msg" style={{background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155'}}>
                      <strong>t+1h Forecast:</strong> {Math.floor(selectedJunction.currentVolume * (selectedJunction.weather === 'Rain' ? 1.25 : 1.08))} vehicles.<br/>
                      <strong>GNN Impact:</strong> Local neighborhood congestion spilling over in 15 mins. Adjusting phase cycles.
                    </div>
                  )}
                </div>

                {/* 6. Green Wave */}
                <div className="control-section">
                  <div className="section-label">Network Sync (MARL)</div>
                  <button className={`ctrl-btn ${greenWaveRoute ? 'success' : ''}`} onClick={() => {
                     if (greenWaveRoute) {
                         setGreenWaveRoute(null);
                     } else {
                         const others = currentJunctions.filter(j => j.id !== selectedJunction.id);
                         others.sort((a,b) => getDistance(selectedJunction.lat, selectedJunction.lon, a.lat, a.lon) - getDistance(selectedJunction.lat, selectedJunction.lon, b.lat, b.lon));
                         const closest = others.slice(0, 3);
                         setGreenWaveRoute([selectedJunction, ...closest]);
                     }
                  }}>
                    <Radio size={14} /> {greenWaveRoute ? 'Cancel Green Wave' : 'Trigger Green Wave'}
                  </button>
                  {greenWaveRoute && <div className="status-msg success">Corridor synchronized for optimal platoon traversal.</div>}
                </div>

                {/* 7. Sandbox */}
                <div className="control-section">
                  <div className="section-label">Digital Twin: Roadblock</div>
                  <button className={`ctrl-btn ${closedJunctions.has(selectedJunction.id) ? 'danger' : ''}`} onClick={() => {
                     const next = new Set(closedJunctions);
                     if (next.has(selectedJunction.id)) {
                         next.delete(selectedJunction.id);
                     } else {
                         next.add(selectedJunction.id);
                     }
                     setClosedJunctions(next);
                  }}>
                    <Construction size={14} /> {closedJunctions.has(selectedJunction.id) ? 'Reopen Junction' : 'Close Junction (Roadblock)'}
                  </button>
                  {closedJunctions.has(selectedJunction.id) && <div className="status-msg danger" style={{background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'}}>Junction Closed. Displaced traffic rerouted to 3 nearest neighbors.</div>}
                </div>

                <div className="control-section" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px' }}>
                  <button className={`ctrl-btn ${microSimActive ? 'primary' : ''}`} style={{ background: microSimActive ? '#1e293b' : '#334155', color: '#fff', width: '100%', padding: '12px', fontSize: '13px', transition: '0.2s' }} onClick={() => setMicroSimActive(!microSimActive)}>
                    <Activity size={16} /> {microSimActive ? 'End Live Physics Mode' : 'Launch AV Micro-Simulation'}
                  </button>
                  <p style={{fontSize: '11px', color: '#64748b', marginTop: '8px', lineHeight: '1.4'}}>Injects real-time autonomous vehicle, pedestrian roaming, and collision avoidance physics directly mapped onto the active network junction intersection.</p>
                </div>
              </div>

              <div className="svg-container" style={{ position: 'relative' }}>
                <object
                  id="live-svg-object"
                  type="image/svg+xml"
                  data={selectedJunction.svg_file}
                >
                  SVG Not Loaded
                </object>

                {microSimActive && (
                  <div className="absolute top-4 right-4 bg-white/70 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs" style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '180px', fontFamily: 'Outfit, sans-serif' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#1f2937', fontWeight: 'bold' }}>Map Legend</h3>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '12px', height: '16px', background: '#1E3A8A', borderRadius: '3px' }}></div>
                      <span style={{ color: '#4b5563', fontSize: '12px' }}>Active Vehicle</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '12px', height: '16px', background: '#52525B', borderRadius: '3px' }}></div>
                      <span style={{ color: '#4b5563', fontSize: '12px' }}>Storage Units</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '12px', height: '12px', background: '#EF4444', borderRadius: '50%' }}></div>
                      <span style={{ color: '#4b5563', fontSize: '12px' }}>Pedestrian Crossing</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <AlertTriangle size={12} color="#F59E0B" />
                      <span style={{ color: '#4b5563', fontSize: '12px' }}>Traffic Condition</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '16px', height: '0px', borderTop: '2px dashed #3B82F6' }}></div>
                      <span style={{ color: '#4b5563', fontSize: '12px' }}>Predicted Trajectory</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '16px', height: '0px', borderTop: '2px dashed #EF4444' }}></div>
                      <span style={{ color: '#4b5563', fontSize: '12px' }}>Pedestrian Alert Path</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '10px' }}>E</div>
                      <span style={{ color: '#4b5563', fontSize: '12px' }}>Priority Target</span>
                    </div>
                  </div>
                )}
              </div>

              {aiSummary && Array.isArray(aiSummary) && (
                <div className="ai-sidebar-panel">
                  <div className="ai-summary-title"><Zap size={16} /> Live AI Report</div>
                  <div className="kv-list">
                    {aiSummary.map((item, i) => (
                      <div className="kv-item" key={i}>
                        <div className="kv-key">{item.key}</div>
                        <div className="kv-value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
