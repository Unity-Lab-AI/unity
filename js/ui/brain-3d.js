/**
 * brain-3d.js — WebGL 3D brain visualizer
 *
 * 1000 neurons rendered as points in 3D brain-shaped clusters.
 * Mouse drag to rotate, scroll to zoom. Neurons flash on spike.
 * No dependencies — raw WebGL with inline shaders.
 */

const VERT_SHADER = `
  attribute vec3 aPos;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aGlow;
  uniform mat4 uMVP;
  uniform float uScale;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    gl_Position = uMVP * vec4(aPos, 1.0);
    gl_PointSize = (aSize + aGlow * 6.0) * uScale / gl_Position.w;
    vColor = aColor;
    vGlow = aGlow;
  }
`;

const FRAG_SHADER = `
  precision mediump float;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float alpha = (1.0 - d * d) * (0.3 + vGlow * 0.7);
    vec3 col = vColor * (0.4 + vGlow * 0.6);
    // Glow bloom
    if (vGlow > 0.3) {
      col += vColor * vGlow * 0.5 * (1.0 - d);
    }
    gl_FragColor = vec4(col, alpha);
  }
`;

// Cluster definitions with 3D brain positions
const CLUSTERS_3D = [
  { name: 'cortex',       size: 300, color: [1.0, 0.3, 0.6],  center: [0, 0.6, 0],    spread: [1.8, 0.5, 1.4], label: 'CORTEX' },
  { name: 'hippocampus',  size: 200, color: [0.66, 0.33, 0.97], center: [-0.4, 0, 0.2], spread: [0.6, 0.3, 0.8], label: 'HIPPOCAMPUS' },
  { name: 'amygdala',     size: 150, color: [0.94, 0.27, 0.27], center: [0.5, -0.1, 0.6], spread: [0.4, 0.3, 0.3], label: 'AMYGDALA' },
  { name: 'basalGanglia', size: 150, color: [0.13, 0.77, 0.37], center: [0, 0.1, 0],    spread: [0.5, 0.4, 0.5], label: 'BASAL GANGLIA' },
  { name: 'cerebellum',   size: 100, color: [0, 0.9, 1.0],      center: [0, -0.5, -0.8], spread: [0.8, 0.3, 0.4], label: 'CEREBELLUM' },
  { name: 'hypothalamus', size: 50,  color: [0.96, 0.62, 0.04], center: [0, -0.3, 0.3], spread: [0.25, 0.2, 0.25], label: 'HYPOTHALAMUS' },
  { name: 'mystery',      size: 50,  color: [0.75, 0.52, 0.99], center: [0, 0.9, 0],    spread: [0.3, 0.3, 0.3], label: 'MYSTERY Ψ' },
];

export class Brain3D {
  constructor(containerId) {
    this._open = false;
    this._container = null;
    this._canvas = null;
    this._gl = null;
    this._program = null;
    this._animId = null;
    this._rotX = -0.3;
    this._rotY = 0;
    this._zoom = 3.5;
    this._dragging = false;
    this._lastMouse = [0, 0];
    this._neurons = [];
    this._glowData = new Float32Array(1000);
    this._clusterVisible = {};
    this._lastState = null;

    this._buildDOM(containerId);
    this._initNeuronPositions();
  }

  _buildDOM(containerId) {
    // Overlay container
    this._container = document.createElement('div');
    this._container.id = 'brain-3d-overlay';
    this._container.className = 'brain-3d hidden';
    this._container.innerHTML = `
      <div class="b3d-header">
        <span class="b3d-title">3D BRAIN — 1000 neurons</span>
        <span class="b3d-stats" id="b3d-stats"></span>
        <button class="b3d-close">&times;</button>
      </div>
      <div class="b3d-toggles" id="b3d-toggles"></div>
      <canvas id="b3d-canvas"></canvas>
      <div class="b3d-hint">Drag to rotate · Scroll to zoom</div>
    `;
    document.body.appendChild(this._container);

    this._canvas = this._container.querySelector('#b3d-canvas');
    this._container.querySelector('.b3d-close').addEventListener('click', () => this.close());

    // Cluster toggles
    const toggles = this._container.querySelector('#b3d-toggles');
    for (const c of CLUSTERS_3D) {
      this._clusterVisible[c.name] = true;
      const btn = document.createElement('button');
      btn.className = 'b3d-toggle active';
      btn.style.borderColor = `rgb(${c.color.map(v => Math.floor(v * 255)).join(',')})`;
      btn.textContent = c.label;
      btn.dataset.cluster = c.name;
      btn.addEventListener('click', () => {
        this._clusterVisible[c.name] = !this._clusterVisible[c.name];
        btn.classList.toggle('active', this._clusterVisible[c.name]);
      });
      toggles.appendChild(btn);
    }

    // Mouse controls
    this._canvas.addEventListener('mousedown', (e) => { this._dragging = true; this._lastMouse = [e.clientX, e.clientY]; });
    window.addEventListener('mouseup', () => { this._dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastMouse[0];
      const dy = e.clientY - this._lastMouse[1];
      this._rotY += dx * 0.005;
      this._rotX += dy * 0.005;
      this._rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this._rotX));
      this._lastMouse = [e.clientX, e.clientY];
    });
    this._canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._zoom *= e.deltaY > 0 ? 1.1 : 0.9;
      this._zoom = Math.max(1.5, Math.min(10, this._zoom));
    }, { passive: false });

    // Touch controls
    this._canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) { this._dragging = true; this._lastMouse = [e.touches[0].clientX, e.touches[0].clientY]; }
    });
    this._canvas.addEventListener('touchend', () => { this._dragging = false; });
    this._canvas.addEventListener('touchmove', (e) => {
      if (!this._dragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this._lastMouse[0];
      const dy = e.touches[0].clientY - this._lastMouse[1];
      this._rotY += dx * 0.005;
      this._rotX += dy * 0.005;
      this._lastMouse = [e.touches[0].clientX, e.touches[0].clientY];
    });
  }

  _initNeuronPositions() {
    this._neurons = [];
    let idx = 0;
    for (const c of CLUSTERS_3D) {
      for (let n = 0; n < c.size; n++) {
        // Scatter neurons in a gaussian cloud around cluster center
        const x = c.center[0] + (Math.random() - 0.5) * 2 * c.spread[0] * this._gaussRand();
        const y = c.center[1] + (Math.random() - 0.5) * 2 * c.spread[1] * this._gaussRand();
        const z = c.center[2] + (Math.random() - 0.5) * 2 * c.spread[2] * this._gaussRand();
        this._neurons.push({
          pos: [x, y, z],
          color: c.color,
          cluster: c.name,
          idx: idx++,
        });
      }
    }
  }

  _gaussRand() {
    // Box-Muller for gaussian distribution (clustered, not uniform)
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * 0.35;
  }

  _initGL() {
    const canvas = this._canvas;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) { console.error('[Brain3D] WebGL not available'); return false; }
    this._gl = gl;

    // Compile shaders
    const vs = this._compileShader(gl, gl.VERTEX_SHADER, VERT_SHADER);
    const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER);
    if (!vs || !fs) return false;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[Brain3D] Program link failed:', gl.getProgramInfoLog(prog));
      return false;
    }
    this._program = prog;

    // Locations
    this._loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      aSize: gl.getAttribLocation(prog, 'aSize'),
      aColor: gl.getAttribLocation(prog, 'aColor'),
      aGlow: gl.getAttribLocation(prog, 'aGlow'),
      uMVP: gl.getUniformLocation(prog, 'uMVP'),
      uScale: gl.getUniformLocation(prog, 'uScale'),
    };

    // Buffers
    this._posBuf = gl.createBuffer();
    this._sizeBuf = gl.createBuffer();
    this._colorBuf = gl.createBuffer();
    this._glowBuf = gl.createBuffer();

    // Static position data
    const posData = new Float32Array(this._neurons.length * 3);
    const colorData = new Float32Array(this._neurons.length * 3);
    const sizeData = new Float32Array(this._neurons.length);
    for (let i = 0; i < this._neurons.length; i++) {
      posData[i * 3] = this._neurons[i].pos[0];
      posData[i * 3 + 1] = this._neurons[i].pos[1];
      posData[i * 3 + 2] = this._neurons[i].pos[2];
      colorData[i * 3] = this._neurons[i].color[0];
      colorData[i * 3 + 1] = this._neurons[i].color[1];
      colorData[i * 3 + 2] = this._neurons[i].color[2];
      sizeData[i] = 3.0;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, posData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, colorData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._sizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sizeData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._glowBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this._glowData, gl.DYNAMIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    return true;
  }

  _compileShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[Brain3D] Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  updateState(state) {
    this._lastState = state;
    if (!state.spikes) return;
    const len = Math.min(state.spikes.length, this._glowData.length);
    for (let i = 0; i < len; i++) {
      if (state.spikes[i]) this._glowData[i] = 1.0;
      else this._glowData[i] *= 0.9;
    }
  }

  _render() {
    if (!this._open || !this._gl) return;
    const gl = this._gl;
    const canvas = this._canvas;

    // Resize if needed
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth * dpr;
    const ch = canvas.clientHeight * dpr;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0.02, 0.02, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this._program);

    // Build MVP matrix (perspective + rotation)
    const aspect = canvas.width / canvas.height;
    const mvp = this._buildMVP(aspect);
    gl.uniformMatrix4fv(this._loc.uMVP, false, mvp);
    gl.uniform1f(this._loc.uScale, Math.min(canvas.width, canvas.height) * 0.15);

    // Update glow buffer (dynamic)
    // Zero out hidden clusters
    const glowFiltered = new Float32Array(this._glowData);
    let offset = 0;
    for (const c of CLUSTERS_3D) {
      if (!this._clusterVisible[c.name]) {
        for (let i = 0; i < c.size; i++) glowFiltered[offset + i] = -1; // hide
      }
      offset += c.size;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._glowBuf);
    gl.bufferData(gl.ARRAY_BUFFER, glowFiltered, gl.DYNAMIC_DRAW);

    // Bind attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
    gl.enableVertexAttribArray(this._loc.aPos);
    gl.vertexAttribPointer(this._loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._sizeBuf);
    gl.enableVertexAttribArray(this._loc.aSize);
    gl.vertexAttribPointer(this._loc.aSize, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuf);
    gl.enableVertexAttribArray(this._loc.aColor);
    gl.vertexAttribPointer(this._loc.aColor, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._glowBuf);
    gl.enableVertexAttribArray(this._loc.aGlow);
    gl.vertexAttribPointer(this._loc.aGlow, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, this._neurons.length);

    // Update stats
    if (this._lastState) {
      const statsEl = this._container.querySelector('#b3d-stats');
      if (statsEl) {
        const sc = this._lastState.spikeCount ?? 0;
        const psi = this._lastState.psi ?? 0;
        statsEl.textContent = `${sc}/1000 firing | Ψ=${psi.toFixed(3)} | t=${(this._lastState.time ?? 0).toFixed(1)}s`;
      }
    }

    this._animId = requestAnimationFrame(() => this._render());
  }

  _buildMVP(aspect) {
    // Simple perspective projection + rotation
    const fov = 0.8;
    const near = 0.1, far = 50;
    const f = 1 / Math.tan(fov / 2);

    // Projection
    const proj = new Float32Array(16);
    proj[0] = f / aspect; proj[5] = f;
    proj[10] = (far + near) / (near - far); proj[11] = -1;
    proj[14] = (2 * far * near) / (near - far);

    // View (translate back by zoom, then rotate)
    const cx = Math.cos(this._rotX), sx = Math.sin(this._rotX);
    const cy = Math.cos(this._rotY), sy = Math.sin(this._rotY);

    const view = new Float32Array(16);
    view[0] = cy;  view[1] = sx*sy; view[2] = -cx*sy;
    view[4] = 0;   view[5] = cx;    view[6] = sx;
    view[8] = sy;  view[9] = -sx*cy; view[10] = cx*cy;
    view[14] = -this._zoom;
    view[15] = 1;

    // Multiply proj * view
    const mvp = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += proj[i + k * 4] * view[k + j * 4];
        mvp[i + j * 4] = sum;
      }
    }
    return mvp;
  }

  toggle() { if (this._open) this.close(); else this.open(); }

  open() {
    this._open = true;
    this._container.classList.remove('hidden');
    if (!this._gl) {
      if (!this._initGL()) return;
    }
    // Slow auto-rotate
    this._autoRotate = true;
    this._render();
  }

  close() {
    this._open = false;
    this._container.classList.add('hidden');
    this._autoRotate = false;
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
  }

  isOpen() { return this._open; }

  destroy() {
    this.close();
    if (this._gl) {
      this._gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this._container?.remove();
  }
}
