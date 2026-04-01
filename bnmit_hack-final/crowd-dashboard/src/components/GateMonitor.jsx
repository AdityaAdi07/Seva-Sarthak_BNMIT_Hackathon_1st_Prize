import React, { useState, useEffect, useRef } from 'react';

export default function GateMonitor() {
  const [lineY, setLineY] = useState(300);
  const [gateRunning, setGateRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [counts, setCounts] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedPath, setUploadedPath] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadedFile(file.name);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('http://localhost:8000/gate/upload-video', {
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

  const handleStart = async () => {
    if (!uploadedPath) {
      alert("Please upload a video file first!");
      return;
    }
    setIsStarting(true);
    try {
      const res = await fetch(`http://localhost:8000/gate/start?source=${encodeURIComponent(uploadedPath)}&line_y=${lineY}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'started' || data.status === 'already_running') {
        setGateRunning(true);
      }
    } catch (e) { console.error(e); }
    setIsStarting(false);
  };

  const handleStop = async () => {
    try {
      await fetch('http://localhost:8000/gate/stop', { method: 'POST' });
      setGateRunning(false);
      setCounts({});
    } catch (e) { console.error(e); }
  };

  // Poll gate status every 2 seconds
  useEffect(() => {
    if (gateRunning) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8000/gate/status');
          const data = await res.json();
          if (data.counts) setCounts(data.counts);
          if (data.status === 'not_running') setGateRunning(false);
        } catch (e) {}
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [gateRunning]);

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const categoryColors = {
    person: '#00daf3',
    car: '#facc15',
    motorcycle: '#f97316',
    bus: '#a78bfa',
    truck: '#ef4444',
    bicycle: '#4ade80'
  };

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>
          Gate Monitor
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
          Track & count objects crossing a virtual gate line — ideal for venue entry/exit footfall analysis
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Left: Controls + Video Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Controls Card */}
          <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(0,218,243,0.3)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: '1rem' }}>
              🚪 Gate Tracking Controls
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* File Upload Area */}
              <input 
                type="file" 
                ref={fileInputRef}
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              
              <div>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Video Source</label>
                <div 
                  onClick={() => !gateRunning && fileInputRef.current?.click()}
                  style={{
                    padding: '0.75rem',
                    background: uploadedFile ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.3)',
                    border: `2px dashed ${uploadedFile ? 'var(--success)' : 'var(--outline-variant)'}`,
                    borderRadius: '8px',
                    cursor: gateRunning ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    opacity: gateRunning ? 0.5 : 1
                  }}
                >
                  {isUploading ? (
                    <div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--primary)', margin: 0, fontWeight: 'bold' }}>⏳ Uploading video...</p>
                    </div>
                  ) : uploadedFile ? (
                    <div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--success)', margin: 0, fontWeight: 'bold' }}>✅ {uploadedFile}</p>
                      <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>Click to change video</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, fontWeight: 'bold' }}>📁 Click to upload video file</p>
                      <p style={{ fontSize: '0.6rem', color: 'var(--outline-variant)', margin: '0.25rem 0 0 0' }}>MP4, AVI, MKV supported</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Gate Line Position (Y pixel): <strong style={{ color: 'var(--primary)' }}>{lineY}</strong>
                </label>
                <input
                  type="range"
                  min={50}
                  max={600}
                  value={lineY}
                  onChange={(e) => setLineY(Number(e.target.value))}
                  disabled={gateRunning}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              {!gateRunning ? (
                <button
                  onClick={handleStart}
                  disabled={isStarting || !uploadedPath}
                  style={{
                    padding: '0.6rem', background: uploadedPath ? 'var(--success)' : 'rgba(255,255,255,0.1)', color: 'white',
                    border: 'none', fontFamily: 'Space Grotesk', fontWeight: 'bold',
                    fontSize: '0.7rem', textTransform: 'uppercase', cursor: uploadedPath ? 'pointer' : 'not-allowed',
                    opacity: (isStarting || !uploadedPath) ? 0.5 : 1, borderRadius: '4px'
                  }}
                >
                  {isStarting ? '⏳ Initializing...' : '▶ Start Gate Tracking'}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  style={{
                    padding: '0.6rem', background: 'var(--danger)', color: 'white',
                    border: 'none', fontFamily: 'Space Grotesk', fontWeight: 'bold',
                    fontSize: '0.7rem', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '4px'
                  }}
                >
                  ⏹ Stop Tracking
                </button>
              )}

              <div style={{ fontSize: '0.625rem', color: gateRunning ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: gateRunning ? 'var(--success)' : 'var(--outline-variant)', display: 'inline-block' }}></span>
                {gateRunning ? 'TRACKING ACTIVE — COUNTING CROSSINGS' : 'Standby — upload video and start'}
              </div>
            </div>
          </div>

          {/* Video Feed */}
          <div className="glass-card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-main)', margin: 0 }}>
                📹 Gate Feed
              </h3>
              {gateRunning && (
                <span style={{ fontSize: '0.5rem', padding: '2px 8px', background: 'rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '99px', fontWeight: 'bold' }}>● REC</span>
              )}
            </div>
            <div style={{ aspectRatio: '16/9', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', overflow: 'hidden' }}>
              {gateRunning ? (
                <img
                  src="http://localhost:8000/gate/video-feed"
                  alt="Gate Tracking Feed"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚪</p>
                  <p style={{ fontSize: '0.75rem' }}>Start tracking to view gate feed</p>
                  <p style={{ fontSize: '0.625rem', color: 'var(--outline-variant)', marginTop: '0.25rem' }}>
                    The red line marks the crossing boundary
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Stats & Counters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Total Footfall Counter */}
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,218,243,0.08), rgba(139,92,246,0.08))' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Total Crossings
            </div>
            <div style={{ fontSize: '4rem', fontFamily: 'Space Grotesk', fontWeight: 'bold', color: 'var(--primary)', lineHeight: 1 }}>
              {totalCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Objects crossed the gate line
            </div>
          </div>

          {/* Per-Category Breakdown */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-main)', marginBottom: '1rem' }}>
              📊 Category Breakdown
            </h3>

            {Object.keys(counts).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([category, count]) => {
                  const maxVal = Math.max(...Object.values(counts), 1);
                  const pct = (count / maxVal) * 100;
                  const color = categoryColors[category] || '#888';

                  return (
                    <div key={category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: color, textTransform: 'capitalize' }}>
                          {category}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'Space Grotesk', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          {count}
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}88)`,
                          borderRadius: '3px',
                          transition: 'width 0.5s ease'
                        }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.75rem' }}>No crossings detected yet</p>
                <p style={{ fontSize: '0.625rem', color: 'var(--outline-variant)' }}>Start tracking to see category counts</p>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(0,218,243,0.15)' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: '0.75rem' }}>
              ℹ️ How Gate Tracking Works
            </h3>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Red Line</span> = Virtual gate boundary
              </p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <span style={{ color: '#4ade80', fontWeight: 'bold' }}>Green Boxes</span> = Tracked objects with unique IDs
              </p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <span style={{ color: '#facc15', fontWeight: 'bold' }}>Yellow Counters</span> = Running totals per category
              </p>
              <p style={{ margin: 0 }}>
                When any tracked object crosses the red line from <strong>top → bottom</strong>, its category counter increments by 1. Each object is only counted once.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
