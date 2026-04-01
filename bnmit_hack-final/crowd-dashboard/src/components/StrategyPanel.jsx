import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const hospitalIcon = new L.divIcon({
  html: '<div style="font-size: 24px; text-shadow: 0 0 10px rgba(0,0,0,0.8);">🏥</div>',
  className: 'custom-div-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const HOSPITALS = [
  { id: 'H1', name: 'Bowring and Lady Curzon Hospital', lat: 12.9818, lng: 77.6015 },
  { id: 'H2', name: 'Fortis Hospital (Cunningham Rd)', lat: 12.9862, lng: 77.5959 },
  { id: 'H3', name: 'Victoria Hospital', lat: 12.9580, lng: 77.5710 },
  { id: 'H4', name: 'St John Medical College', lat: 12.9304, lng: 77.6189 },
  { id: 'H5', name: 'Chinmaya Mission Hospital', lat: 12.9782, lng: 77.6385 },
  { id: 'H6', name: 'Manipal Hospital (HAL)', lat: 12.9591, lng: 77.6407 },
  { id: 'H7', name: 'Apollo Cradle (Koramangala)', lat: 12.9351, lng: 77.6245 },
  { id: 'H8', name: 'NIMHANS', lat: 12.9377, lng: 77.5947 },
];

const HOTSPOTS = [
  "Commercial Street", "MG Road", "Brigade Road", "Indiranagar", 
  "Koramangala", "UB City", "VV Puram Food Street", "Lalbagh Botanical Garden", 
  "Cubbon Park", "ISKCON", "Bull Temple", "Ranga Shankara", "Fun World"
];

const EVENTS = [
  "None", "Standard Weekend", "Karaga Festival", "Ugadi", "Mysuru Dasara", 
  "Deepavali", "Kadalekai Parishe", "Bengaluru Habba", "Christmas & New Year"
];

export default function StrategyPanel() {
  const [personnel, setPersonnel] = useState(100);
  const [location, setLocation] = useState("Commercial Street");
  const [event, setEvent] = useState("None");
  const [hour, setHour] = useState(18); 
  const [dayOfWeek, setDayOfWeek] = useState(5); 
  
  const [strategy, setStrategy] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateStrategy = async () => {
    setLoading(true);
    setPrediction(null);
    setStrategy(null);
    try {
      let estimatedTraffic = 2000;
      if (parseInt(dayOfWeek) >= 5) estimatedTraffic += 1000;
      if (parseInt(hour) >= 17 && parseInt(hour) <= 21) estimatedTraffic += 3000;
      if (event !== "None") estimatedTraffic += 8000;

      const predRes = await fetch('http://localhost:8000/predict-crowd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hour: parseInt(hour),
          day_of_week: parseInt(dayOfWeek),
          is_weekend: parseInt(dayOfWeek) >= 5 ? 1 : 0,
          location: location,
          event: event,
          traffic_volume: estimatedTraffic
        })
      });
      const predData = await predRes.json();
      
      if (predData.error) throw new Error(predData.error);
      setPrediction(predData);

      const allocRes = await fetch('http://localhost:8000/allocate-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_personnel: parseInt(personnel),
          crowd_density: predData.predicted_crowd_density,
          severity: predData.severity,
          location: location
        })
      });
      const allocData = await allocRes.json();
      setStrategy(allocData.strategy);
      
    } catch (e) {
      console.error(e);
      alert("Error generating strategy. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Settings Input Grid */}
      <div style={{ display: 'flex', gap: '1.5rem', width: '100%' }}>
        <div className="glass-card" style={{ flex: 1, padding: '1.5rem' }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: '1rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1.5rem' }}>Tactical Parameters</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Location</label>
              <select value={location} onChange={e => setLocation(e.target.value)} style={inputStyle}>
                {HOTSPOTS.map(h => <option key={h} value={h} style={{ color: '#000' }}>{h}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Event</label>
              <select value={event} onChange={e => setEvent(e.target.value)} style={inputStyle}>
                {EVENTS.map(e => <option key={e} value={e} style={{ color: '#000' }}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Time</label>
              <select value={hour} onChange={e => setHour(e.target.value)} style={inputStyle}>
                {[...Array(24).keys()].map(h => (
                  <option key={h} value={h} style={{ color: '#000' }}>
                    {h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Personnel</label>
              <input type="number" value={personnel} onChange={e => setPersonnel(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <button onClick={generateStrategy} disabled={loading} style={{ marginTop: '1.5rem', width: '100%', padding: '1rem', background: 'var(--primary)', color: '#001f24', border: 'none', borderRadius: '8px', fontFamily: 'Space Grotesk', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Consulting Neural Network...' : 'Execute Deployment Protocol'}
          </button>
        </div>
      </div>

      {/* Main Results Layout */}
      {strategy ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 8fr) minmax(0, 4fr)', gap: '1.5rem' }}>
          
          {/* Left Panel: Map & Roster */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Explainable AI Prediction Card */}
            {prediction && (
              <div className="glass-card" style={{ padding: '1.5rem', background: 'linear-gradient(145deg, rgba(0,218,243,0.05) 0%, rgba(0,0,0,0.5) 100%)', border: '1px solid var(--primary)' }}>
                <h4 style={{ margin: '0 0 1.5rem 0', fontFamily: 'Space Grotesk', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Neural Network Prediction</h4>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Est. Global Density:</span><br/>
                    <strong style={{ fontSize: '2.5rem', fontFamily: 'Space Grotesk', color: prediction.severity === 'critical' ? '#ff562c' : prediction.severity === 'high' ? '#fabd00' : '#00daf3' }}>
                      {prediction.predicted_crowd_density.toLocaleString()}
                    </strong>
                  </div>
                  <div style={{ background: prediction.severity === 'critical' ? 'rgba(255,86,44,0.2)' : 'rgba(250,189,0,0.2)', color: prediction.severity === 'critical' ? '#ff562c' : '#fabd00', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                     THREAT: {prediction.severity}
                  </div>
                </div>

                {/* XAI SHAP LAYER */}
                {prediction.shap_explainability && prediction.shap_explainability.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                    <h5 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--primary)' }}>⊚</span> XAI Feature Impact (SHAP)
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                      {prediction.shap_explainability.map((sh, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>{sh.feature}</span>
                          <span style={{ fontFamily: 'Space Grotesk', fontSize: '0.875rem', color: sh.impact > 0 ? '#ff562c' : '#10b981', fontWeight: 'bold' }}>
                            {sh.impact > 0 ? `+${Math.round(sh.impact).toLocaleString()}` : Math.round(sh.impact).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontFamily: 'Space Grotesk', fontSize: '1rem' }}>Map Deployment Visualization</h3>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary)' }}>COORDS: {strategy.deployments[0].lat}° N, {strategy.deployments[0].lng}° E</div>
              </div>
              <div style={{ height: '400px', width: '100%' }}>
                <MapContainer center={[strategy.deployments[0].lat, strategy.deployments[0].lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer 
                    attribution='&copy; <a href="https://www.esri.com/">Esri</a>' 
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
                  />
                  
                  {strategy.deployments.map((unit) => (
                    <Circle 
                      key={unit.id}
                      center={[unit.lat, unit.lng]} 
                      pathOptions={{ color: unit.role === 'Traffic Police' ? '#00daf3' : unit.role === 'Riot Control' ? '#ff562c' : '#10b981', fillOpacity: 1 }} 
                      radius={15} 
                    >
                      <Popup>{unit.id} - {unit.role}</Popup>
                    </Circle>
                  ))}
                  {strategy.ambulances && strategy.ambulances.map((amb) => (
                    <Marker key={amb.id} position={[amb.lat, amb.lng]}>
                      <Popup><strong>{amb.role}</strong><br/>{amb.id}</Popup>
                    </Marker>
                  ))}
                  {HOSPITALS.map((hosp) => (
                    <Marker key={hosp.id} position={[hosp.lat, hosp.lng]} icon={hospitalIcon}>
                      <Popup><strong>{hosp.name}</strong><br/><span style={{ fontSize: '0.75rem', color: 'gray' }}>Regional Medical Center</span></Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontFamily: 'Space Grotesk', fontSize: '1rem' }}>Deployment Roster</h3>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', color: 'gray', fontWeight: 'normal' }}>Unit ID</th>
                      <th style={{ padding: '0.75rem', color: 'gray', fontWeight: 'normal' }}>Role</th>
                      <th style={{ padding: '0.75rem', color: 'gray', fontWeight: 'normal' }}>Coordinates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...strategy.deployments, ...(strategy.ambulances || [])].map(unit => (
                      <tr key={unit.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{unit.id}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ color: unit.role === 'Traffic Police' ? '#00daf3' : unit.role === 'Riot Control' ? '#ff562c' : unit.role === 'Ambulance Station' ? '#fabd00' : '#10b981', marginRight: '8px' }}>●</span>
                          {unit.role}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{unit.lat}, {unit.lng}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel: Rapid Support & Units */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Split Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '0.5rem' }}>
              <div style={{ background: 'rgba(0, 218, 243, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--primary)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'Space Grotesk' }}>{strategy.traffic_police_count}</div>
                <div style={{ fontSize: '0.625rem', color: 'var(--primary)', textTransform: 'uppercase' }}>Traffic Police</div>
              </div>
              <div style={{ background: 'rgba(255, 86, 44, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--danger)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'Space Grotesk' }}>{strategy.riot_control_count}</div>
                <div style={{ fontSize: '0.625rem', color: 'var(--danger)', textTransform: 'uppercase' }}>Riot Control</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--success)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'Space Grotesk' }}>{strategy.medical_response_count}</div>
                <div style={{ fontSize: '0.625rem', color: 'var(--success)', textTransform: 'uppercase' }}>Medical Array</div>
              </div>
            </div>

            {/* Nearest Rapid Support Panel */}
            <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)', background: 'var(--surface-highest)' }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Space Grotesk', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--danger)' }}>+</span> Nearest Rapid Support
                </h3>
                <p style={{ margin: 0, fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Emergency Medical & Tactical Backup</p>
              </div>
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                {strategy.nearest_hospitals && strategy.nearest_hospitals.map((hosp, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{hosp.name}</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.625rem', color: 'var(--text-muted)' }}>Dist: {hosp.distance} km • <span style={{color: 'var(--primary)'}}>✆ {hosp.contact}</span></p>
                      </div>
                      <div style={{ background: 'rgba(255, 86, 44, 0.1)', color: 'var(--danger)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.625rem', fontWeight: 'bold' }}>
                        {hosp.eta} MIN ETA
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', background: 'var(--surface-highest)', padding: '2px 8px', borderRadius: '99px', border: '1px solid var(--glass-border)' }}>
                        🚑 +{hosp.active_units} Ambulances Ready
                      </span>
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Cap: {hosp.capacity}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
           <p className="text-muted" style={{ fontFamily: 'Space Grotesk', fontSize: '1.25rem' }}>Execute protocol to view tactical strategy.</p>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', 
  padding: '0.75rem', 
  borderRadius: '8px', 
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', 
  color: 'white',
  outline: 'none'
};
