import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icons issue in react
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const HOTSPOTS_DATA = [
  { name: "Commercial Street", coords: [12.9822, 77.6083] },
  { name: "MG Road", coords: [12.9716, 77.5946] },
  { name: "Brigade Road", coords: [12.9738, 77.6075] },
  { name: "Indiranagar", coords: [12.9784, 77.6408] },
  { name: "Koramangala", coords: [12.9279, 77.6271] },
  { name: "UB City", coords: [12.9719, 77.5960] },
  { name: "VV Puram Food Street", coords: [12.9482, 77.5756] },
  { name: "Lalbagh Botanical Garden", coords: [12.9507, 77.5848] },
  { name: "Cubbon Park", coords: [12.9779, 77.5952] },
  { name: "ISKCON", coords: [13.0098, 77.5511] },
  { name: "Bull Temple", coords: [12.9366, 77.5683] },
  { name: "Ranga Shankara", coords: [12.9238, 77.5855] },
  { name: "Fun World", coords: [13.0076, 77.5902] }
];

export default function HotspotMap({ activeAlerts }) {
  const center = [12.9716, 77.5946];
  const [trafficData, setTrafficData] = useState({});

  const isSurging = (name) => {
    return activeAlerts.some(alert => alert.location === name);
  };

  const checkTraffic = async (location) => {
    setTrafficData(prev => ({ ...prev, [location]: { loading: true } }));
    try {
      const res = await fetch(`http://localhost:8000/api/live-traffic/${encodeURIComponent(location)}`);
      const data = await res.json();
      setTrafficData(prev => ({ ...prev, [location]: { loading: false, ...data } }));
    } catch (e) {
      setTrafficData(prev => ({ ...prev, [location]: { loading: false, error: true } }));
    }
  };

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontFamily: 'Space Grotesk', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Interactive Command Map
        </h3>
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '4px 12px', border: '1px solid var(--primary)', color: 'var(--primary)', fontSize: '0.75rem', borderRadius: '4px' }}>
          LIVE GOOGLE MAPS ENABLED
        </div>
      </div>
      
      {/* This flex container forces Leaflet to expand seamlessly */}
      <div style={{ flexGrow: 1, width: '100%', position: 'relative' }}>
        <MapContainer center={center} zoom={12} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          />
          
          {HOTSPOTS_DATA.map((spot, idx) => {
            const surge = isSurging(spot.name);
            const tData = trafficData[spot.name];
            
            return (
              <React.Fragment key={idx}>
                <Marker 
                  position={spot.coords}
                  eventHandlers={{ click: () => checkTraffic(spot.name) }}
                >
                  <Popup className="custom-popup">
                    <strong style={{ fontFamily: 'Space Grotesk', fontSize: '1.1rem' }}>{spot.name}</strong> <br />
                    <span style={{ color: surge ? 'red' : '#10b981', fontWeight: 'bold' }}>
                      Status: {surge ? 'CRITICAL SURGE' : 'Normal'}
                    </span>
                    <hr style={{ margin: '8px 0', borderColor: 'rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Google Maps Traffic Ping:</span>
                    <br/>
                    
                    {tData?.loading ? (
                       <span style={{ color: '#00daf3', fontSize: '0.85rem' }}>📡 Scanning Live Traffic...</span>
                    ) : tData?.status ? (
                       <span style={{ color: tData.multiplier > 1.2 ? '#ef4444' : tData.multiplier > 1.05 ? '#f59e0b' : '#10b981', fontWeight: 'bold', fontSize: '0.85rem' }}>
                         {tData.status} ({tData.multiplier}x Delay)
                       </span>
                    ) : (
                       <button onClick={() => checkTraffic(spot.name)} style={{ background: '#00daf3', color: '#001f24', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '4px' }}>
                         Scan Live Congestion
                       </button>
                    )}
                  </Popup>
                </Marker>
                <Circle 
                  center={spot.coords} 
                  pathOptions={{ color: surge ? 'red' : '#00daf3', fillColor: surge ? 'red' : '#00daf3', fillOpacity: surge ? 0.6 : 0.2 }} 
                  radius={surge ? 800 : 300} 
                />
              </React.Fragment>
            )
          })}
        </MapContainer>
      </div>
    </div>
  );
}
