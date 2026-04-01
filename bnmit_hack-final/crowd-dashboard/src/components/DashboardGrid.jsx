import React, { useState, useEffect, useRef } from 'react';

const FESTIVALS = [
  { name: 'Karaga Festival', month: 2 },
  { name: 'Ugadi', month: 3 },
  { name: 'Mysuru Dasara', month: 8 },
  { name: 'Deepavali', month: 9 },
  { name: 'Kadalekai Parishe', month: 10 },
  { name: 'Bengaluru Habba', month: 11 },
  { name: 'Christmas & New Year', month: 11 }
];

export default function DashboardGrid({ activeAlerts, liveDetection, latestBroadcast }) {
  const [nextEvent, setNextEvent] = useState({ name: 'Loading...', timeText: '' });
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [detectionRunning, setDetectionRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedPath, setUploadedPath] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadedFile(file.name);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('http://localhost:8000/detection/upload-video', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'uploaded') {
        setUploadedPath(data.path);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to upload video file");
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartDetection = async () => {
    if (!uploadedPath) {
      alert("Please upload a video file first!");
      return;
    }
    setIsStarting(true);
    try {
      const res = await fetch(`http://localhost:8000/detection/start?source=${encodeURIComponent(uploadedPath)}&confidence=0.35`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'started' || data.status === 'already_running') {
        setDetectionRunning(true);
      }
    } catch(e) {
      console.error(e);
      alert("Failed to start detection");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopDetection = async () => {
    try {
      await fetch('http://localhost:8000/detection/stop', { method: 'POST' });
      setDetectionRunning(false);
    } catch(e) {
      console.error(e);
    }
  };

  // Check if detection is already running on mount
  useEffect(() => {
    fetch('http://localhost:8000/detection/status')
      .then(r => r.json())
      .then(data => {
        if (data.status === 'running') setDetectionRunning(true);
      })
      .catch(() => {});
  }, []);

  const handleDispatch = async () => {
    if (activeAlerts.length === 0) {
      alert("No active surges right now! All sectors clear.");
      return;
    }
    const targetLoc = activeAlerts[0].location;
    setIsDispatching(true);
    
    try {
      const res = await fetch('http://localhost:8000/dispatch-qrt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: targetLoc })
      });
      const data = await res.json();
      setDispatchStatus(data);
      
      setTimeout(() => {
        setDispatchStatus(null);
      }, 15000);
    } catch(e) {
      console.error(e);
      alert("Error dispatching");
    } finally {
      setIsDispatching(false);
    }
  };

  useEffect(() => {
    const currentMonth = new Date().getMonth();
    let upcoming = FESTIVALS.find(f => f.month >= currentMonth);
    if (!upcoming) upcoming = FESTIVALS[0]; 
    
    const monthsAway = upcoming.month - currentMonth;
    let timeText = "";
    
    if (monthsAway === 0) {
      timeText = "Later this month";
    } else if (monthsAway < 0) {
      timeText = `In ${12 + monthsAway} months`;
    } else {
      timeText = `In ${monthsAway} month${monthsAway > 1 ? 's' : ''}`;
    }
    
    setNextEvent({ name: upcoming.name, timeText });
  }, []);

  const densityColor = {
    'LOW': 'var(--success)',
    'MEDIUM': 'var(--warning)',
    'HIGH': '#ff8c00',
    'CRITICAL': 'var(--danger)',
    'N/A': 'var(--text-muted)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      
      {/* 4-KPI Horizon Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--glass-border)', border: '1px solid var(--glass-border)' }}>
        <div style={{ padding: '1.5rem', background: 'var(--bg-gradient)' }}>
          <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
            YOLO Person Count
          </label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.875rem', fontFamily: 'Space Grotesk', fontWeight: 'bold', color: 'var(--primary)' }}>
              {liveDetection ? liveDetection.person_count : '--'}
            </span>
            {liveDetection && (
              <span style={{ fontSize: '0.625rem', color: densityColor[liveDetection.density_level] || 'var(--text-muted)', fontWeight: 'bold' }}>
                {liveDetection.density_level}
              </span>
            )}
          </div>
        </div>
        <div style={{ padding: '1.5rem', background: 'var(--bg-gradient)' }}>
          <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
            Active Alerts
          </label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.875rem', fontFamily: 'Space Grotesk', fontWeight: 'bold', color: activeAlerts.length > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
              {activeAlerts.length < 10 ? `0${activeAlerts.length}` : activeAlerts.length}
            </span>
            {activeAlerts.length > 0 && (
              <span style={{ fontSize: '0.625rem', background: 'var(--danger-glass)', padding: '2px 8px', color: 'var(--danger)', borderRadius: '99px' }}>
                High Risk
              </span>
            )}
          </div>
        </div>
        <div style={{ padding: '1.5rem', background: 'var(--bg-gradient)' }}>
          <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
            Detection FPS
          </label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.875rem', fontFamily: 'Space Grotesk', fontWeight: 'bold', color: 'var(--warning)' }}>
              {liveDetection ? liveDetection.fps : '--'}
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>FPS</span>
          </div>
        </div>
        <div style={{ padding: '1.5rem', background: 'var(--bg-gradient)' }}>
          <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
            Upcoming Event
          </label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', fontFamily: 'Space Grotesk', fontWeight: 'bold', color: 'var(--text-main)' }}>{nextEvent.name}</span>
            <span style={{ fontSize: '0.625rem', color: 'var(--primary)' }}>{nextEvent.timeText}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
        
        {/* Left Col: YOLO Detection Control + Live Feed */}
        <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Detection Controls */}
          <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(0,218,243,0.3)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: '1rem' }}>
              🎯 YOLO Crowd Detection
            </h3>

            {/* File Upload Area */}
            <input 
              type="file" 
              ref={fileInputRef}
              accept="video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            <div 
              onClick={() => !detectionRunning && fileInputRef.current?.click()}
              style={{
                padding: '1rem',
                marginBottom: '1rem',
                background: uploadedFile ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.3)',
                border: `2px dashed ${uploadedFile ? 'var(--success)' : 'var(--outline-variant)'}`,
                borderRadius: '8px',
                cursor: detectionRunning ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                opacity: detectionRunning ? 0.5 : 1
              }}
            >
              {isUploading ? (
                <div>
                  <p style={{ fontSize: '1.5rem', margin: '0 0 0.25rem 0' }}>⏳</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--primary)', margin: 0, fontWeight: 'bold' }}>Uploading video...</p>
                </div>
              ) : uploadedFile ? (
                <div>
                  <p style={{ fontSize: '1.5rem', margin: '0 0 0.25rem 0' }}>✅</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--success)', margin: 0, fontWeight: 'bold' }}>{uploadedFile}</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>Click to change video</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '1.5rem', margin: '0 0 0.25rem 0' }}>📁</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, fontWeight: 'bold' }}>Click to upload video file</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--outline-variant)', margin: '0.25rem 0 0 0' }}>MP4, AVI, MKV supported</p>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!detectionRunning ? (
                <button 
                  onClick={handleStartDetection}
                  disabled={isStarting || !uploadedPath}
                  style={{
                    flex: 1, padding: '0.6rem', background: uploadedPath ? 'var(--success)' : 'rgba(255,255,255,0.1)', color: 'white',
                    border: 'none', fontFamily: 'Space Grotesk', fontWeight: 'bold',
                    fontSize: '0.7rem', textTransform: 'uppercase', cursor: uploadedPath ? 'pointer' : 'not-allowed',
                    opacity: (isStarting || !uploadedPath) ? 0.5 : 1, borderRadius: '4px'
                  }}
                >
                  {isStarting ? '⏳ Initializing YOLO...' : '▶ Start Detection'}
                </button>
              ) : (
                <button 
                  onClick={handleStopDetection}
                  style={{
                    flex: 1, padding: '0.6rem', background: 'var(--danger)', color: 'white',
                    border: 'none', fontFamily: 'Space Grotesk', fontWeight: 'bold',
                    fontSize: '0.7rem', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '4px'
                  }}
                >
                  ⏹ Stop Detection
                </button>
              )}
            </div>

            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: detectionRunning ? 'var(--success)' : 'var(--text-muted)',
                display: 'inline-block',
                animation: detectionRunning ? 'pulse 1.5s infinite' : 'none'
              }}></span>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {detectionRunning ? 'YOLO Active — Processing Frames' : 'Detection Offline'}
              </span>
            </div>
          </div>
          
          {/* Live YOLO Video Feed */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-main)', margin: 0 }}>
                📹 Live YOLO Feed
              </h3>
              {detectionRunning && (
                <span style={{ fontSize: '0.5rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '2px 6px', borderRadius: '99px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
                  ● REC
                </span>
              )}
            </div>
            <div style={{ 
              aspectRatio: '16/9', background: '#000', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative'
            }}>
              {detectionRunning ? (
                <img 
                  src="http://localhost:8000/detection/video-feed"
                  alt="YOLO Live Feed"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</p>
                  <p style={{ fontSize: '0.75rem' }}>Upload a video and start detection to view live feed</p>
                  <p style={{ fontSize: '0.625rem', color: 'var(--outline-variant)', marginTop: '0.25rem' }}>
                    Supports MP4, AVI, MKV video files
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Col: Density-Based Alert Feed */}
        <div style={{ gridColumn: 'span 3' }}>
          <div className="glass-card" style={{ height: '100%', overflow: 'auto', maxHeight: '500px', background: activeAlerts.length > 0 ? 'var(--danger-glass)' : 'var(--glass-bg)', borderColor: activeAlerts.length > 0 ? 'var(--danger)' : 'var(--glass-border)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: activeAlerts.length > 0 ? '#ffb4ab' : 'var(--text-main)', position: 'sticky', top: 0, background: 'inherit', paddingBottom: '0.5rem', zIndex: 1 }}>
               ⚡ Density-Based Alerts
            </h3>
            
            {/* Current status bar */}
            {liveDetection && (
              <div style={{
                padding: '0.5rem 0.75rem',
                marginBottom: '0.75rem',
                background: `${densityColor[liveDetection.density_level]}15`,
                border: `1px solid ${densityColor[liveDetection.density_level]}40`,
                borderRadius: '4px',
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: densityColor[liveDetection.density_level],
                  display: 'inline-block',
                  animation: liveDetection.density_level !== 'LOW' ? 'pulse 1.5s infinite' : 'none'
                }}></span>
                <span style={{ fontSize: '0.625rem', fontWeight: 'bold', color: densityColor[liveDetection.density_level], textTransform: 'uppercase' }}>
                  {liveDetection.status_message || liveDetection.density_level}
                </span>
              </div>
            )}
            
            {activeAlerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {activeAlerts.map((alert, idx) => {
                  const severityColors = {
                    'critical': { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#fca5a5', badge: '#ef4444' },
                    'high': { bg: 'rgba(255,140,0,0.15)', border: '#ff8c00', text: '#ffd699', badge: '#ff8c00' },
                    'moderate': { bg: 'rgba(234,179,8,0.15)', border: '#eab308', text: '#fde68a', badge: '#eab308' },
                    'normal': { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#6ee7b7', badge: '#10b981' },
                    'resolved': { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#6ee7b7', badge: '#10b981' }
                  };
                  const colors = severityColors[alert.severity] || severityColors['normal'];
                  
                  return (
                    <div key={idx} style={{
                      padding: '0.75rem',
                      background: colors.bg,
                      borderLeft: `3px solid ${colors.border}`,
                      borderRadius: '0 4px 4px 0',
                    }}>
                      {/* Header: Location + Severity Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <strong style={{ fontFamily: 'Space Grotesk', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                          {alert.location}
                        </strong>
                        <span style={{
                          fontSize: '0.5rem', fontWeight: 'bold', textTransform: 'uppercase',
                          padding: '2px 6px', borderRadius: '99px',
                          background: `${colors.badge}25`, color: colors.badge,
                          letterSpacing: '0.05em'
                        }}>
                          {alert.severity === 'resolved' ? '✅ RESOLVED' : 
                           alert.density_level || alert.severity?.toUpperCase()}
                        </span>
                      </div>
                      
                      {/* Message */}
                      <p style={{ fontSize: '0.7rem', color: colors.text, margin: '0 0 0.35rem 0', lineHeight: 1.4 }}>
                        {alert.message}
                      </p>
                      
                      {/* Transition badge */}
                      {alert.transition && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Density: <span style={{ color: colors.badge, fontWeight: 'bold' }}>{alert.transition}</span>
                        </div>
                      )}
                      
                      {/* Person count */}
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        👥 {alert.real_count || alert.crowd_density} persons detected
                      </div>
                      
                      {/* Recommended Actions */}
                      {alert.recommended_actions && alert.recommended_actions.length > 0 && (
                        <div style={{ marginTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.35rem' }}>
                          <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                            Recommended Actions:
                          </span>
                          {alert.recommended_actions.slice(0, 3).map((action, i) => (
                            <div key={i} style={{ fontSize: '0.6rem', color: colors.text, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: colors.badge }}>▸</span> {action}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="text-muted">No anomalous surges. All sectors clear.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Rapid Response + Density Meter */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Live Density Gauge */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-main)', marginBottom: '1rem' }}>
              Crowd Density Gauge
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Density bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>LOW</span>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>CRITICAL</span>
                </div>
                <div style={{ width: '100%', background: 'rgba(0,0,0,0.3)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: '6px',
                    transition: 'width 0.5s ease, background 0.5s ease',
                    width: liveDetection ? 
                      (liveDetection.density_level === 'CRITICAL' ? '100%' :
                       liveDetection.density_level === 'HIGH' ? '75%' :
                       liveDetection.density_level === 'MEDIUM' ? '50%' : '20%') : '0%',
                    background: liveDetection ? 
                      (densityColor[liveDetection.density_level] || 'var(--text-muted)') : 'transparent'
                  }}></div>
                </div>
              </div>
              
              {/* Person count big display */}
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', fontFamily: 'Space Grotesk', fontWeight: 'bold', color: liveDetection ? densityColor[liveDetection.density_level] : 'var(--text-muted)' }}>
                  {liveDetection ? liveDetection.person_count : '0'}
                </div>
                <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
                  Persons Detected
                </div>
              </div>
            </div>
          </div>

          {/* Live Station Dispatch Network / Simulation */}
          <div className="glass-card" style={{ padding: '1.5rem', border: latestBroadcast ? '1px solid var(--danger)' : '1px solid rgba(0,218,243,0.3)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '2rem', height: '2px', background: latestBroadcast ? 'var(--danger)' : 'var(--primary)', transition: 'all 0.3s' }}></div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: latestBroadcast ? '#fca5a5' : 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📡 Station Broadcast Net</span>
              {latestBroadcast && <span style={{ fontSize:'0.5rem', padding:'2px 6px', background:'red', color:'white', borderRadius:'4px', animation:'pulse 1s infinite' }}>LIVE TRANSMISSION</span>}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {latestBroadcast ? (
                 <div style={{ background: '#0a0a0a', padding: '1rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                   <div style={{ color: '#ff4444', marginBottom: '8px', fontWeight: 'bold' }}>
                     [SYSTEM] Initiating emergency broadcast protocol...
                   </div>
                   
                   {latestBroadcast.log.map((line, idx) => {
                     // Parse color based on content
                     let color = '#a3a3a3'; // default gray
                     if (line.includes('AUTO-BROADCAST:')) color = '#facc15'; // yellow
                     else if (line.includes('CRITICAL')) color = '#ef4444'; // red
                     else if (line.includes('ACKNOWLEDGED')) color = '#4ade80'; // green
                     
                     return (
                       <div key={idx} style={{ 
                         color: color, 
                         margin: '4px 0', 
                         animation: `fadeIn 0.3s ease-in-out ${idx * 0.4}s both` 
                       }}>
                         {line}
                       </div>
                     );
                   })}
                 </div>
              ) : (
                 <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                   <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Network standby.</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>Waiting for high-density trigger to engage automated dispatch protocol.</p>
                 </div>
              )}
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}
