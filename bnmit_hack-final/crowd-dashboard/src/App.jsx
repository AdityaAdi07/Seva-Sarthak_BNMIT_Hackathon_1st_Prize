import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, Map as MapIcon, Calendar, Activity, Bell, Sun, Moon } from 'lucide-react';
import './index.css';

import DashboardGrid from './components/DashboardGrid';
import HotspotMap from './components/HotspotMap';
import StrategyPanel from './components/StrategyPanel';
import GateMonitor from './components/GateMonitor';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [liveDetection, setLiveDetection] = useState(null);
  const [latestBroadcast, setLatestBroadcast] = useState(null);
  const [theme, setTheme] = useState('light');

  // Theme effect hook
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // WebSocket connection string
  useEffect(() => {
    let ws;
    let reconnectTimer;

    const connect = () => {
      ws = new WebSocket('ws://localhost:8000/ws/live-updates');
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'live_detection') {
          // Real YOLO data — update live detection state
          setLiveDetection(data);
        }
        
        if (data.type === 'surge_alert') {
          setActiveAlerts(prev => {
            const newAlerts = [data, ...prev].slice(0, 5);
            return newAlerts;
          });
          
          // Auto-remove alert after 10 seconds
          setTimeout(() => {
             setActiveAlerts(prev => prev.filter(a => a !== data));
          }, 10000);
        }

        if (data.type === 'broadcast_alert') {
          setLatestBroadcast(data);
          // Keep broadcast visible for 15 seconds
          setTimeout(() => setLatestBroadcast(null), 15000);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket closed, reconnecting in 3s...');
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return (
    <div className="app-container glass-panel">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand" style={{ padding: '0 1rem' }}>
          <h2 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Space Grotesk', fontSize: '1.25rem' }}>
            Namma Sentinel
          </h2>
          <p className="text-muted" style={{ fontSize: '0.625rem', marginTop: '0.25rem', textTransform: 'uppercase', fontFamily: 'Space Grotesk', letterSpacing: '0.1em' }}>Bengaluru Command</p>
        </div>

        <nav className="sidebar-nav">
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Activity size={20} />
            <span>Live Dashboard</span>
          </div>
          <div className={`nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
            <MapIcon size={20} />
            <span>Hotspot Map</span>
          </div>
          <div className={`nav-item ${activeTab === 'strategy' ? 'active' : ''}`} onClick={() => setActiveTab('strategy')}>
            <Users size={20} />
            <span>Resource Strategy</span>
          </div>
          <div className={`nav-item ${activeTab === 'gate' ? 'active' : ''}`} onClick={() => setActiveTab('gate')}>
            <ShieldAlert size={20} />
            <span>Gate Monitor</span>
          </div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '0 1rem' }}>
          <button style={{ 
            width: '100%', padding: '0.75rem', 
            background: 'rgba(0, 218, 243, 0.1)', border: '1px solid rgba(0, 218, 243, 0.2)', 
            color: 'var(--primary)', fontFamily: 'Space Grotesk', fontSize: '0.75rem', 
            textTransform: 'uppercase', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1.5rem' 
          }}>
            Emergency Response
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUsP8CsbjlLXgzCXl1SWg9ensBtsRT2OQ3lg5m2c2ylf3efjb5AFhvobf6Qy1DhU1hzrqnpz9_ocD-NHzfhWUxf8-XcoiiuCKF81Nh_LSAUE7vn1WbgWs-5PcYpu0ylyJp45afOAmbZ_6AwvzXqAIp8TlUhd1eykUUZW7mxA9W8xoYcC0-iDELLvLO2soAgC7ZsiUpNI2B6xnAL3toHQSQNhIhvbe6koJ1xlzfLxe5wgXNPCyuK-w7gKCtVVIkYouy50xb6oiUteeS" 
              alt="Avatar" 
              style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(0, 218, 243, 0.3)', objectFit: 'cover'}} 
            />
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 'bold', margin: 0 }}>Chief R. Kumar</p>
              <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Operations Head</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={activeTab === 'map' ? { padding: 0 } : {}}>
        <header className="header" style={activeTab === 'map' ? { padding: '2rem 2rem 1rem 2rem' } : {}}>
          <div>
            <h1>Overview</h1>
            <p className="text-muted">Real-time Bengaluru crowd monitoring and analysis</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* YOLO Status Badge */}
            {liveDetection && (
              <div className="badge badge-success" style={{ gap: '6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }}></span>
                YOLO ACTIVE — {liveDetection.person_count} persons
              </div>
            )}
            <div className={`badge ${activeAlerts.length > 0 ? 'badge-danger' : 'badge-success'}`}>
              <span 
                style={{ width: 8, height: 8, borderRadius: '50%', background: activeAlerts.length > 0 ? '#ef4444' : '#10b981' }} 
                className={activeAlerts.length > 0 ? "animate-pulse" : ""}
              ></span>
              {activeAlerts.length > 0 ? 'SURGE DETECTED' : 'System Nominal'}
            </div>
            <button 
              className="glass-card" 
              style={{ padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button className="glass-card" style={{ padding: '0.5rem', position: 'relative' }}>
              <Bell size={20} />
              {activeAlerts.length > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5, background: 'red', 
                  color: 'white', fontSize: '10px', borderRadius: '50%', 
                  padding: '2px 5px', fontWeight: 'bold'
                }}>
                  {activeAlerts.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && <DashboardGrid activeAlerts={activeAlerts} liveDetection={liveDetection} latestBroadcast={latestBroadcast} />}
        {activeTab === 'map' && <HotspotMap activeAlerts={activeAlerts} />}
        {activeTab === 'strategy' && <StrategyPanel />}
        {activeTab === 'gate' && <GateMonitor />}
        
      </main>
    </div>
  );
}

export default App;
