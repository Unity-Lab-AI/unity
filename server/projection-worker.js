/**
 * projection-worker.js — Inter-cluster projection on its own core
 *
 * Computes I_target = Σ W_ij × spike_j for one projection.
 * Main thread sends source spikes + weights, worker returns target currents.
 */

const { parentPort, workerData } = require('worker_threads');

const { sourceSize, targetSize, density, strength } = workerData;

// Sparse random weights (CSR-like but simple for server)
const weights = new Float64Array(targetSize * sourceSize);
for (let i = 0; i < targetSize; i++) {
  for (let j = 0; j < sourceSize; j++) {
    if (Math.random() < density) {
      weights[i * sourceSize + j] = (Math.random() - 0.3) * strength;
    }
  }
}

parentPort.on('message', (msg) => {
  if (msg.type === 'propagate') {
    const sourceSpikes = msg.spikes;
    const currents = new Float64Array(targetSize);

    for (let i = 0; i < targetSize; i++) {
      let sum = 0;
      const row = i * sourceSize;
      for (let j = 0; j < sourceSize; j++) {
        if (sourceSpikes[j]) sum += weights[row + j];
      }
      currents[i] = sum;
    }

    parentPort.postMessage({
      type: 'currents',
      targetCurrents: Array.from(currents),
    });
  }

  if (msg.type === 'learn') {
    const { sourceSpikes, targetSpikes, reward, lr } = msg;
    if (Math.abs(reward) < 0.01) return;
    for (let i = 0; i < targetSize; i++) {
      if (!targetSpikes[i]) continue;
      const row = i * sourceSize;
      for (let j = 0; j < sourceSize; j++) {
        if (!sourceSpikes[j]) continue;
        weights[row + j] += lr * reward;
        if (weights[row + j] > 1) weights[row + j] = 1;
        if (weights[row + j] < -0.5) weights[row + j] = -0.5;
      }
    }
  }
});

parentPort.postMessage({ type: 'ready' });
