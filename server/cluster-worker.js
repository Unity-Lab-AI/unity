/**
 * cluster-worker.js — One neural cluster running on its own CPU core
 *
 * Each worker thread runs one cluster's LIF population independently.
 * Main thread sends currents, worker computes spikes, sends back.
 * Uses SharedArrayBuffer for zero-copy voltage/spike transfer.
 *
 * Built-in Node.js worker_threads — zero third-party packages.
 */

const { parentPort, workerData } = require('worker_threads');

const { name, size, tonicDrive, noiseAmplitude } = workerData;

// LIF parameters
const tau = 20, vRest = -65, vThresh = -50, vReset = -70, dt = 1;

// Neuron state — use SharedArrayBuffer if available for zero-copy
let voltages, spikes;
if (workerData.sharedVoltages) {
  voltages = new Float64Array(workerData.sharedVoltages);
  spikes = new Uint8Array(workerData.sharedSpikes);
} else {
  voltages = new Float64Array(size).fill(vRest);
  spikes = new Uint8Array(size);
}

// Receive step command from main thread
parentPort.on('message', (msg) => {
  if (msg.type === 'step') {
    const externalCurrents = msg.currents; // Float64Array from main thread
    let spikeCount = 0;

    for (let i = 0; i < size; i++) {
      // LIF: τ·dV/dt = -(V - Vrest) + R·I
      const I = tonicDrive + (externalCurrents ? (externalCurrents[i] || 0) : 0)
              + (Math.random() - 0.5) * noiseAmplitude;
      const dV = (-(voltages[i] - vRest) + I) / tau;
      voltages[i] += dt * dV;

      spikes[i] = 0;
      if (voltages[i] >= vThresh) {
        spikes[i] = 1;
        voltages[i] = vReset;
        spikeCount++;
      }
    }

    // Send results back to main thread
    parentPort.postMessage({
      type: 'result',
      name,
      spikeCount,
      spikes: Array.from(spikes), // copy for transfer
      firingRate: spikeCount / size,
    });
  }
});

parentPort.postMessage({ type: 'ready', name, size });
