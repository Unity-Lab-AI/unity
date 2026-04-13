// neurons.js — biophysical neuron models for browser-based brain sim
// float64 everything. no dependencies. just math and voltage.

// ============================================================
// Hodgkin-Huxley — the real deal, 1952 squid axon style
// Cm * dV/dt = I - gNa*m³h*(V-ENa) - gK*n⁴*(V-EK) - gL*(V-EL)
//
// REFERENCE-ONLY IMPLEMENTATION. Not used by the live runtime —
// cluster.js imports LIFPopulation directly. HHNeuron exists to
// back the `brain-equations.html` teaching page (equations, gating
// kinetics, Nobel-prize history). We don't use it for simulation
// because HH is per-neuron OOP: at 3.2M neurons it's infeasible —
// 3.2M object instances, per-instance m/h/n state, no vectorization,
// cache-hostile. LIFPopulation uses a single SoA (Float64Array V,
// spikes, refracRemaining) in one tight loop — GPU-friendly and
// ~100× faster. If you ever need true biophysical fidelity for a
// small group (mystery cluster, research experiments), instantiate
// HHNeuron directly. Everything else uses LIF.
// ============================================================

const HH_DEFAULTS = {
  Cm: 1.0,       // membrane capacitance (µF/cm²)
  gNa: 120.0,    // max sodium conductance (mS/cm²)
  gK: 36.0,      // max potassium conductance (mS/cm²)
  gL: 0.3,       // leak conductance (mS/cm²)
  ENa: 50.0,     // sodium reversal potential (mV)
  EK: -77.0,     // potassium reversal potential (mV)
  EL: -54.387,   // leak reversal potential (mV)
  Vrest: -65.0,  // resting membrane potential (mV)
};

// alpha/beta rate functions — the gating kinetics that make it all work
function alphaN(V) {
  const dv = V + 55;
  if (Math.abs(dv) < 1e-7) return 0.1; // L'Hôpital at the singularity
  return 0.01 * dv / (1 - Math.exp(-0.1 * dv));
}

function betaN(V) {
  return 0.125 * Math.exp(-(V + 65) / 80);
}

function alphaM(V) {
  const dv = V + 40;
  if (Math.abs(dv) < 1e-7) return 1.0;
  return 0.1 * dv / (1 - Math.exp(-0.1 * dv));
}

function betaM(V) {
  return 4.0 * Math.exp(-(V + 65) / 18);
}

function alphaH(V) {
  return 0.07 * Math.exp(-(V + 65) / 20);
}

function betaH(V) {
  return 1.0 / (1 + Math.exp(-0.1 * (V + 35)));
}

// steady-state gating variable: alpha / (alpha + beta)
function ssGate(alpha, beta) {
  return alpha / (alpha + beta);
}

export class HHNeuron {
  constructor(params = {}) {
    const p = { ...HH_DEFAULTS, ...params };
    this.Cm = p.Cm;
    this.gNa = p.gNa;
    this.gK = p.gK;
    this.gL = p.gL;
    this.ENa = p.ENa;
    this.EK = p.EK;
    this.EL = p.EL;

    // init at resting potential with steady-state gating
    this.V = p.Vrest;
    const am = alphaM(this.V), bm = betaM(this.V);
    const ah = alphaH(this.V), bh = betaH(this.V);
    const an = alphaN(this.V), bn = betaN(this.V);
    this.m = ssGate(am, bm);
    this.h = ssGate(ah, bh);
    this.n = ssGate(an, bn);

    this.spiked = false;
    this._prevV = this.V;
  }

  // advance one timestep. I_ext in µA/cm². dt in ms.
  // returns true if spike detected (upward zero-crossing past 0mV)
  step(dt, I_ext = 0) {
    const V = this.V;
    let { m, h, n } = this;

    // ionic currents
    const INa = this.gNa * m * m * m * h * (V - this.ENa);
    const IK = this.gK * n * n * n * n * (V - this.EK);
    const IL = this.gL * (V - this.EL);

    // voltage derivative
    const dVdt = (I_ext - INa - IK - IL) / this.Cm;

    // gating variable derivatives (forward euler, good enough for small dt)
    const am = alphaM(V), bm = betaM(V);
    const ah = alphaH(V), bh = betaH(V);
    const an = alphaN(V), bn = betaN(V);

    const dmdt = am * (1 - m) - bm * m;
    const dhdt = ah * (1 - h) - bh * h;
    const dndt = an * (1 - n) - bn * n;

    this._prevV = this.V;
    this.V = V + dt * dVdt;
    this.m = m + dt * dmdt;
    this.h = h + dt * dhdt;
    this.n = n + dt * dndt;

    // spike detection: crossed 0mV going up
    this.spiked = (this._prevV < 0 && this.V >= 0);
    return this.spiked;
  }
}

// ============================================================
// Leaky Integrate-and-Fire — fast, clean, good for large populations
// τ * dV/dt = -(V - Vrest) + R * I
// spike at threshold, reset to Vreset, hold for refractory period
// ============================================================

const LIF_DEFAULTS = {
  tau: 20.0,          // membrane time constant (ms)
  Vrest: -65.0,       // resting potential (mV)
  Vreset: -70.0,      // post-spike reset (mV)
  Vthresh: -50.0,     // spike threshold (mV)
  R: 1.0,             // membrane resistance (MΩ)
  tRefrac: 2.0,       // refractory period (ms)
};

export class LIFPopulation {
  constructor(n, params = {}) {
    const p = { ...LIF_DEFAULTS, ...params };
    this.n = n;
    this.tau = p.tau;
    this.Vrest = p.Vrest;
    this.Vreset = p.Vreset;
    this.Vthresh = p.Vthresh;
    this.R = p.R;
    this.tRefrac = p.tRefrac;

    // state arrays — Float64 because we're not animals
    this.V = new Float64Array(n).fill(p.Vrest);
    this.spikes = new Uint8Array(n);           // binary spike flags
    this.refracRemaining = new Float64Array(n); // time left in refractory
  }

  // advance all neurons one timestep
  // currents: Float64Array of length n (external input current per neuron)
  // returns the spike array (Uint8Array, 1 = spiked this step)
  step(dt, currents) {
    const { V, spikes, refracRemaining, n, tau, Vrest, Vreset, Vthresh, R, tRefrac } = this;
    const invTau = 1.0 / tau;

    for (let i = 0; i < n; i++) {
      spikes[i] = 0;

      // still in refractory? count down and skip
      if (refracRemaining[i] > 0) {
        refracRemaining[i] -= dt;
        continue;
      }

      const I = currents ? currents[i] : 0;

      // forward euler integration
      const dV = (-(V[i] - Vrest) + R * I) * invTau;
      V[i] += dt * dV;

      // threshold crossing — spike
      if (V[i] >= Vthresh) {
        spikes[i] = 1;
        V[i] = Vreset;
        refracRemaining[i] = tRefrac;
      }
    }

    return this.spikes;
  }

  getVoltages() {
    return this.V;
  }

  getSpikes() {
    return this.spikes;
  }
}

// createPopulation factory was removed in U305 — it was never called.
// The runtime imports LIFPopulation directly from cluster.js, and HHNeuron
// is reference-only. If you need a population, `new LIFPopulation(n, params)`.
