// brain/modules.js — Specialized brain region modules
// All classes use Float64Arrays internally. No external deps.

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function dot(a, b, len) {
  let s = 0;
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

// ── Cortex — Predictive coding engine ──────────────────────────────
export class Cortex {
  constructor(size = 32) {
    this.size = size;
    this.weights = new Float64Array(size * size);
    this.state = new Float64Array(size);
    this.prediction = new Float64Array(size);
    this.lr = 0.01;
    // small random init
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = (Math.random() - 0.5) * 0.1;
    }
  }

  step(input, _brainState, _dt) {
    const { size, weights, state, prediction } = this;
    const error = new Float64Array(size);
    const activity = new Float64Array(size);

    // state blend with input
    for (let i = 0; i < size; i++) {
      state[i] = input[i] !== undefined ? input[i] : state[i];
    }

    // prediction = sigmoid(W * state)
    for (let i = 0; i < size; i++) {
      let sum = 0;
      for (let j = 0; j < size; j++) sum += weights[i * size + j] * state[j];
      prediction[i] = sigmoid(sum);
    }

    // error = actual - predicted, activity = |state|
    for (let i = 0; i < size; i++) {
      error[i] = state[i] - prediction[i];
      activity[i] = Math.abs(state[i]);
    }

    // weight update: dW proportional to error * activity
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        weights[i * size + j] += this.lr * error[i] * activity[j];
      }
    }

    return {
      prediction: Float64Array.from(prediction),
      error: Float64Array.from(error),
      activity: Float64Array.from(activity),
    };
  }
}

// ── Hippocampus — Hopfield attractor memory ────────────────────────
export class Hippocampus {
  constructor(size = 32) {
    this.size = size;
    this.weights = new Float64Array(size * size); // symmetric, zero diagonal
    this.maxIter = 20;
  }

  store(pattern) {
    const { size, weights } = this;
    // Hebbian: w_ij += x_i * x_j (no self-connections)
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i !== j) weights[i * size + j] += pattern[i] * pattern[j];
      }
    }
  }

  _energy(x) {
    const { size, weights } = this;
    let e = 0;
    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        e -= weights[i * size + j] * x[i] * x[j];
      }
    }
    return e;
  }

  recall(partial) {
    const { size, weights, maxIter } = this;
    const x = Float64Array.from(partial);
    let stable = false;

    for (let iter = 0; iter < maxIter; iter++) {
      let changed = false;
      for (let i = 0; i < size; i++) {
        let h = 0;
        for (let j = 0; j < size; j++) h += weights[i * size + j] * x[j];
        const next = h >= 0 ? 1 : -1;
        if (next !== x[i]) { x[i] = next; changed = true; }
      }
      if (!changed) { stable = true; break; }
    }

    return {
      recalled: Float64Array.from(x),
      energy: this._energy(x),
      isStable: stable,
    };
  }

  step(input, _brainState, _dt) {
    return this.recall(input);
  }
}

// ── Amygdala — Emotional weighting ─────────────────────────────────
export class Amygdala {
  constructor(size = 32, persona = 'unity') {
    this.size = size;
    this.fearW = new Float64Array(size);
    this.rewardW = new Float64Array(size);
    // random init
    for (let i = 0; i < size; i++) {
      this.fearW[i] = (Math.random() - 0.5) * 0.2;
      this.rewardW[i] = (Math.random() - 0.5) * 0.2;
    }
    // Unity persona: arousal cranked HIGH
    this.arousalBias = persona === 'unity' ? 0.85 : 0.3;
  }

  step(input, _brainState, _dt) {
    const { size, fearW, rewardW, arousalBias } = this;
    let fear = 0, reward = 0;
    for (let i = 0; i < size; i++) {
      const x = input[i] !== undefined ? input[i] : 0;
      fear += fearW[i] * x;
      reward += rewardW[i] * x;
    }
    fear = sigmoid(fear);
    reward = sigmoid(reward);
    const valence = reward - fear; // [-1, 1] range approx
    const arousal = Math.min(1, arousalBias + 0.3 * (fear + reward));

    return { valence, arousal, fear, reward };
  }
}

// ── BasalGanglia — Action selection via RL ─────────────────────────
const ACTIONS = [
  'respond_text', 'generate_image', 'speak',
  'search_web', 'idle_thought', 'escalate',
];

export class BasalGanglia {
  constructor(numStates = 32, persona = 'unity') {
    this.actions = ACTIONS;
    this.numActions = ACTIONS.length;
    this.numStates = numStates;
    // Q-values: one set of weights per action
    this.qWeights = new Float64Array(this.numActions * numStates);
    for (let i = 0; i < this.qWeights.length; i++) {
      this.qWeights[i] = (Math.random() - 0.5) * 0.1;
    }
    // Value function weights
    this.vWeights = new Float64Array(numStates);
    for (let i = 0; i < numStates; i++) {
      this.vWeights[i] = (Math.random() - 0.5) * 0.1;
    }
    // Unity is impulsive: high temperature
    this.tau = persona === 'unity' ? 2.0 : 0.5;
    this.gamma = 0.95;
    this.lr = 0.01;
    this.prevValue = 0;
  }

  _qValues(state) {
    const { numActions, numStates, qWeights } = this;
    const q = new Float64Array(numActions);
    for (let a = 0; a < numActions; a++) {
      let s = 0;
      for (let j = 0; j < numStates; j++) {
        s += qWeights[a * numStates + j] * (state[j] || 0);
      }
      q[a] = s;
    }
    return q;
  }

  step(input, brainState, _dt) {
    const { numActions, tau, gamma, lr, numStates, qWeights, vWeights } = this;
    const reward = brainState?.reward || 0;
    const q = this._qValues(input);

    // softmax: P(a) = exp(Q(a)/tau) / sum(exp(Q(b)/tau))
    let maxQ = -Infinity;
    for (let a = 0; a < numActions; a++) if (q[a] > maxQ) maxQ = q[a];
    const expQ = new Float64Array(numActions);
    let sumExp = 0;
    for (let a = 0; a < numActions; a++) {
      expQ[a] = Math.exp((q[a] - maxQ) / tau);
      sumExp += expQ[a];
    }

    // sample action
    let r = Math.random() * sumExp, chosen = 0;
    for (let a = 0; a < numActions; a++) {
      r -= expQ[a];
      if (r <= 0) { chosen = a; break; }
    }
    const confidence = expQ[chosen] / sumExp;

    // current value
    let currentV = 0;
    for (let j = 0; j < numStates; j++) currentV += vWeights[j] * (input[j] || 0);

    // TD error: delta = r + gamma * V(s') - V(s)
    const tdError = reward + gamma * currentV - this.prevValue;
    this.prevValue = currentV;

    // update Q-weights for chosen action
    for (let j = 0; j < numStates; j++) {
      qWeights[chosen * numStates + j] += lr * tdError * (input[j] || 0);
    }
    // update V-weights
    for (let j = 0; j < numStates; j++) {
      vWeights[j] += lr * tdError * (input[j] || 0);
    }

    return {
      selectedAction: this.actions[chosen],
      confidence,
      tdError,
    };
  }
}

// ── Cerebellum — Error correction ──────────────────────────────────
export class Cerebellum {
  constructor(size = 32) {
    this.size = size;
    this.weights = new Float64Array(size);
    this.lr = 0.05;
    for (let i = 0; i < size; i++) this.weights[i] = 1.0; // start at identity
  }

  step(input, brainState, _dt) {
    const { size, weights, lr } = this;
    const prediction = brainState?.prediction || new Float64Array(size);
    const target = brainState?.target || input;
    const corrected = new Float64Array(size);
    const error = new Float64Array(size);

    for (let i = 0; i < size; i++) {
      const pred = prediction[i] || 0;
      const tgt = target[i] !== undefined ? target[i] : 0;
      const correction = weights[i] * (tgt - pred);
      corrected[i] = pred + correction;
      error[i] = tgt - corrected[i];
      // update weights
      weights[i] += lr * error[i];
    }

    return {
      correctedOutput: corrected,
      error,
    };
  }
}

// ── Hypothalamus — Homeostasis ─────────────────────────────────────
const DRIVE_NAMES = ['arousal', 'intoxication', 'energy', 'social_need', 'creativity'];
const UNITY_SETPOINTS = { arousal: 0.9, intoxication: 0.7, energy: 0.8, social_need: 0.85, creativity: 0.9 };

export class Hypothalamus {
  constructor(persona = 'unity') {
    this.driveNames = DRIVE_NAMES;
    this.numDrives = DRIVE_NAMES.length;
    this.setpoints = new Float64Array(this.numDrives);
    this.drives = new Float64Array(this.numDrives);
    this.alpha = 0.1; // restoration rate
    this.threshold = 0.15; // needs-attention threshold

    const sp = persona === 'unity' ? UNITY_SETPOINTS : {
      arousal: 0.5, intoxication: 0.0, energy: 0.6, social_need: 0.5, creativity: 0.5,
    };
    for (let i = 0; i < this.numDrives; i++) {
      this.setpoints[i] = sp[DRIVE_NAMES[i]];
      this.drives[i] = this.setpoints[i]; // start at setpoint
    }
  }

  step(input, _brainState, dt) {
    const { numDrives, drives, setpoints, alpha, threshold, driveNames } = this;
    const needsAttention = [];

    for (let i = 0; i < numDrives; i++) {
      // dH/dt = -alpha * (H - H_set) + input
      const ext = input[i] !== undefined ? input[i] : 0;
      drives[i] += (-alpha * (drives[i] - setpoints[i]) + ext) * dt;
      drives[i] = Math.max(0, Math.min(1, drives[i])); // clamp [0,1]
      if (Math.abs(drives[i] - setpoints[i]) > threshold) {
        needsAttention.push(driveNames[i]);
      }
    }

    const out = {};
    for (let i = 0; i < numDrives; i++) out[driveNames[i]] = drives[i];

    return { drives: out, needsAttention };
  }
}
