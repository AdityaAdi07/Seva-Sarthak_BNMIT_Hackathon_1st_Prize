export class MicroSimEngine {
  constructor(svgDoc, state) {
    this.svgDoc = svgDoc;
    
    // Find intersection center dynamically based on SVG viewBox or defaults
    let vb = svgDoc.documentElement.getAttribute('viewBox');
    this.CX = 450; this.CY = 300;
    if (vb) {
        let parts = vb.split(' ');
        if(parts.length === 4) {
            this.CX = parseFloat(parts[2]) / 2;
            this.CY = parseFloat(parts[3]) / 2;
        }
    }
    
    this.layer = svgDoc.getElementById('micro-sim-layer');
    if (this.layer) this.layer.remove();
    
    const style = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.innerHTML = `
      .route-path {
         stroke-dasharray: 6,6; animation: dashAnim 1s linear infinite; opacity: 0.15;
      }
      @keyframes dashAnim { to { stroke-dashoffset: -12; } }
      .av-vehicle { transition: transform 0.05s linear; cursor: pointer; }
      .traffic-light { cursor: pointer; transition: all 0.2s; }
      .traffic-light:hover { stroke-width: 4 !important; opacity: 0.8;}
    `;
    svgDoc.documentElement.appendChild(style);

    this.layer = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.layer.id = 'micro-sim-layer';
    this.svgDoc.documentElement.appendChild(this.layer);

    const defs = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <g id="carIcon">
        <rect x="-10" y="-15" width="20" height="30" rx="4" fill="currentColor" stroke="white" stroke-width="2"/>
        <rect x="-8" y="-12" width="16" height="10" rx="2" fill="rgba(255,255,255,0.3)"/>
        <circle cx="-7" cy="10" r="3" fill="#222"/>
        <circle cx="7" cy="10" r="3" fill="#222"/>
        <circle cx="-7" cy="-10" r="3" fill="#222"/>
        <circle cx="7" cy="-10" r="3" fill="#222"/>
      </g>
    `;
    this.layer.appendChild(defs);
    
    this.isRunning = true;
    this.state = state; 
    this.vehicles = [];
    this.lightPhase = 'NS_Green'; 
    this.lastPhaseChange = Date.now();
    this.trafficLightNodes = null;
    
    this.initPaths();
    this.initEntities();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  
  updateState(state) {
     this.state = state;
  }
  
  stop() {
     this.isRunning = false;
     if (this.layer) this.layer.remove();
  }

  initPaths() {
     const CX = this.CX; const CY = this.CY; 
     const EXT = 700; // Farther spawn distance
     
     // Widened lane offsets to align better with massive roads (22px instead of 16px)
     const o = 22;
     const N_in = {x: CX - o, y: CY - EXT}; const N_mid = {x: CX - o, y: CY - 60}; const N_out = {x: CX + o, y: CY - EXT};
     const S_in = {x: CX + o, y: CY + EXT}; const S_mid = {x: CX + o, y: CY + 60}; const S_out = {x: CX - o, y: CY + EXT};
     const E_in = {x: CX + EXT, y: CY - o}; const E_mid = {x: CX + 60, y: CY - o}; const E_out = {x: CX + EXT, y: CY + o};
     const W_in = {x: CX - EXT, y: CY + o}; const W_mid = {x: CX - 60, y: CY + o}; const W_out = {x: CX - EXT, y: CY - o};

     this.paths = [];
     
     const straight = (p0, p1) => (p) => {
         const dx = p1.x - p0.x; const dy = p1.y - p0.y;
         return { x: p0.x + dx*p, y: p0.y + dy*p, dx, dy, ang: Math.atan2(dy, dx) * 180/Math.PI };
     };
     const curve = (p0, pc, p1) => (p) => {
         const nx = (1-p)**2 * p0.x + 2*(1-p)*p * pc.x + p**2 * p1.x;
         const ny = (1-p)**2 * p0.y + 2*(1-p)*p * pc.y + p**2 * p1.y;
         const dx = 2*(1-p)*(pc.x - p0.x) + 2*p*(p1.x - pc.x);
         const dy = 2*(1-p)*(pc.y - p0.y) + 2*p*(p1.y - pc.y);
         const ang = Math.atan2(dy, dx) * 180/Math.PI;
         return { x: nx, y: ny, dx, dy, ang };
     };
     
     const createRoute = (start, midIn, ctrl, midOut, end, type) => {
         return (p) => {
             // Progress map: 0->0.45 approach, 0.45->0.55 intersection, 0.55->1 leave
             if (p <= 0.45) return straight(start, midIn)(p / 0.45);
             if (p > 0.45 && p <= 0.55) {
                 if (type==='straight') return straight(midIn, midOut)((p-0.45)/0.1);
                 return curve(midIn, ctrl, midOut)((p-0.45)/0.1);
             }
             return straight(midOut, end)((p-0.55)/0.45);
         };
     };

     this.paths.push({ id:'N-S', dir: 'NS', getPos: createRoute(N_in, N_mid, null, {x:CX-o, y:CY+60}, S_out, 'straight') });
     this.paths.push({ id:'N-E', dir: 'NS', getPos: createRoute(N_in, N_mid, {x:CX-o, y:CY-o}, {x:CX+60, y:CY-o}, E_out, 'curve') });
     this.paths.push({ id:'S-N', dir: 'NS', getPos: createRoute(S_in, S_mid, null, {x:CX+o, y:CY-60}, N_out, 'straight') });
     this.paths.push({ id:'S-W', dir: 'NS', getPos: createRoute(S_in, S_mid, {x:CX+o, y:CY+o}, {x:CX-60, y:CY+o}, W_out, 'curve') });

     this.paths.push({ id:'E-W', dir: 'EW', getPos: createRoute(E_in, E_mid, null, {x:CX-60, y:CY-o}, W_out, 'straight') });
     this.paths.push({ id:'E-S', dir: 'EW', getPos: createRoute(E_in, E_mid, {x:CX+60, y:CY-o}, {x:CX-o, y:CY+60}, S_out, 'curve') });
     this.paths.push({ id:'W-E', dir: 'EW', getPos: createRoute(W_in, W_mid, null, {x:CX+60, y:CY+o}, E_out, 'straight') });
     this.paths.push({ id:'W-N', dir: 'EW', getPos: createRoute(W_in, W_mid, {x:CX-60, y:CY+o}, {x:CX+o, y:CY-60}, N_out, 'curve') });
  }

  initEntities() {
     for (let i=0; i<30; i++) {
         let route = this.paths[Math.floor(Math.random()*this.paths.length)];
         let isPriority = (i === 0) || (i === 15); 
         let type = isPriority ? 'emergency' : (Math.random() > 0.8 ? 'truck' : 'car');
         let color = isPriority ? '#DC2626' : (Math.random() > 0.5 ? '#1E3A8A' : '#374151'); 
         
         let g = this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
         g.setAttribute('class', 'av-vehicle');
         
         let line = this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'polyline');
         line.setAttribute('fill', 'none');
         line.setAttribute('stroke', '#3B82F6');
         line.setAttribute('stroke-width', '2');
         line.setAttribute('class', 'route-path');
         
         let car = this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'use');
         car.setAttribute('href', '#carIcon');
         car.setAttribute('color', color);
         if(type === 'truck') car.setAttribute('transform', 'scale(1.2)');
         
         let badge = this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
         if(isPriority) {
             badge.setAttribute('width', 16); badge.setAttribute('height', 16); badge.setAttribute('rx', 8);
             badge.setAttribute('fill', '#EF4444');
             badge.setAttribute('y', -30); badge.setAttribute('x', -8);
             g.appendChild(badge);
         }

         let label = this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
         label.textContent = isPriority ? 'E' : `AV-${String(i+1).padStart(2, '0')}`;
         label.setAttribute('font-size', isPriority ? '11' : '8');
         label.setAttribute('fill', isPriority ? 'white' : '#1F2937');
         label.setAttribute('font-weight', 'bold');
         label.setAttribute('text-anchor', 'middle');

         g.appendChild(line);
         g.appendChild(car);
         g.appendChild(label);
         this.layer.appendChild(g);
         
         this.vehicles.push({
             id: i, route, isPriority, type, g, line, car, label, color,
             p: Math.random() * 0.35, // DO NOT SPAWN PAST STOP LINES (0.43). All spawn safely distant.
             speed: (0.0004 + Math.random()*0.0002) * (isPriority ? 1.5 : 1) 
         });
     }
  }
  
  loop() {
    if(!this.isRunning || !this.svgDoc.getElementById('micro-sim-layer')) return;
    
    let now = Date.now();
    const CX = this.CX; const CY = this.CY;

    if (now - this.lastPhaseChange > 10000) {
        this.lightPhase = this.lightPhase === 'NS_Green' ? 'EW_Green' : 'NS_Green';
        this.lastPhaseChange = now;
    }

    if (!this.trafficLightNodes) {
        this.trafficLightNodes = {
            N: this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'circle'),
            S: this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'circle'),
            E: this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'circle'),
            W: this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'circle')
        };
        const r = 14;
        const offset = 85; // aligned to wider intersection profile
        this.trafficLightNodes.N.setAttribute('cx', CX - 35); this.trafficLightNodes.N.setAttribute('cy', CY - offset);
        this.trafficLightNodes.S.setAttribute('cx', CX + 35); this.trafficLightNodes.S.setAttribute('cy', CY + offset);
        this.trafficLightNodes.E.setAttribute('cx', CX + offset); this.trafficLightNodes.E.setAttribute('cy', CY - 35);
        this.trafficLightNodes.W.setAttribute('cx', CX - offset); this.trafficLightNodes.W.setAttribute('cy', CY + 35);
        
        let toggle = () => {
            this.lightPhase = this.lightPhase === 'NS_Green' ? 'EW_Green' : 'NS_Green';
            this.lastPhaseChange = Date.now();
        };

        for (let dir in this.trafficLightNodes) {
             let node = this.trafficLightNodes[dir];
             node.setAttribute('r', r);
             node.setAttribute('stroke', 'white');
             node.setAttribute('stroke-width', '4');
             node.setAttribute('class', 'traffic-light');
             node.addEventListener('click', toggle);
             
             let bg = this.svgDoc.createElementNS('http://www.w3.org/2000/svg', 'circle');
             bg.setAttribute('cx', node.getAttribute('cx')); bg.setAttribute('cy', node.getAttribute('cy'));
             bg.setAttribute('r', r + 6); bg.setAttribute('fill', 'rgba(0,0,0,0.1)');
             
             this.layer.appendChild(bg);
             this.layer.appendChild(node);
        }
    }
    
    let nsColor = this.state.trafficMode === 'All Red' ? '#EF4444' : (this.lightPhase === 'NS_Green' ? '#10B981' : '#EF4444');
    let ewColor = this.state.trafficMode === 'All Red' ? '#EF4444' : (this.lightPhase === 'EW_Green' ? '#10B981' : '#EF4444');
    
    this.trafficLightNodes.N.setAttribute('fill', nsColor); this.trafficLightNodes.S.setAttribute('fill', nsColor);
    this.trafficLightNodes.E.setAttribute('fill', ewColor); this.trafficLightNodes.W.setAttribute('fill', ewColor);

    // Preemption Check
    for (let v of this.vehicles) {
        v.pos = v.route.getPos(v.p);
        if (v.isPriority) {
            v.car.setAttribute('color', Date.now()%200 > 100 ? '#3B82F6' : '#DC2626');
            let d2C = Math.sqrt(Math.pow(v.pos.x - CX, 2) + Math.pow(v.pos.y - CY, 2));
            if (v.p < 0.44 && d2C < 180) { 
                 if (v.route.dir === 'NS') { this.lightPhase = 'NS_Green'; this.lastPhaseChange = now; }
                 if (v.route.dir === 'EW') { this.lightPhase = 'EW_Green'; this.lastPhaseChange = now; }
            }
        }
    }

    for (let i=0; i<this.vehicles.length; i++) {
        let v = this.vehicles[i];
        let stop = false;
        let nextP = v.p + v.speed;
        let nextPos = v.route.getPos(nextP);
        
        let d2C = Math.sqrt(Math.pow(nextPos.x - CX, 2) + Math.pow(nextPos.y - CY, 2));
        
        // Strict Stop line defined at explicitly P = 0.44 just before intersection
        if (v.p < 0.44 && nextP >= 0.44) { 
            if (this.state.isClosed || this.state.trafficMode === 'All Red') {
                stop = true;
            } else {
                let hasGreen = (this.lightPhase === 'NS_Green' && v.route.dir === 'NS') || 
                               (this.lightPhase === 'EW_Green' && v.route.dir === 'EW');
                if (!hasGreen) stop = true;
            }
        }

        if (!stop) {
            for (let j=0; j<this.vehicles.length; j++) {
                if(i===j) continue;
                let v2 = this.vehicles[j];
                
                let dist = Math.sqrt(Math.pow(nextPos.x - v2.pos.x, 2) + Math.pow(nextPos.y - v2.pos.y, 2));
                
                // Increase bounding box collision threshold
                if (dist < (v.type === 'truck' ? 40 : 32)) {
                    let len = Math.sqrt(v.pos.dx*v.pos.dx + v.pos.dy*v.pos.dy);
                    let vx = v.pos.dx / len; let vy = v.pos.dy / len;
                    let toV2_x = v2.pos.x - v.pos.x;
                    let toV2_y = v2.pos.y - v.pos.y;
                    
                    let dot = (vx * toV2_x) + (vy * toV2_y);
                    
                    if (dot > 0) { // Target is strictly in front of us
                        if (v.isPriority && !v2.isPriority && dist < 25) {
                            v2.speed = 0.001; 
                        } else {
                            stop = true; break;
                        }
                    }
                }
            }
        }

        if (this.state.trafficMode === 'Ambulance Phase' && v.isPriority) stop = false;
        
        if (!stop) v.p += v.speed;
        if (v.p >= 1) v.p = 0; 
        
        let finalPos = v.route.getPos(v.p);
        let scale = v.type === 'truck' ? 'scale(1.2)' : 'scale(1)';
        v.car.setAttribute('transform', `translate(${finalPos.x}, ${finalPos.y}) rotate(${finalPos.ang + 90}) translate(${-finalPos.x}, ${-finalPos.y}) ${scale}`); 
        
        v.label.setAttribute('x', finalPos.x);
        v.label.setAttribute('y', finalPos.y - (v.isPriority ? 22 : 20));
        
        if(stop) {
            v.line.setAttribute('points', '');
        } else {
            let pts = "";
            for (let j = 0; j < 6; j++) {
                let offsetP = v.p + (j * 0.04);
                if (offsetP <= 1.0) {
                   let proj = v.route.getPos(offsetP);
                   pts += `${proj.x},${proj.y} `;
                }
            }
            v.line.setAttribute('points', pts.trim());
        }
    }
    
    requestAnimationFrame(this.loop);
  }
}
