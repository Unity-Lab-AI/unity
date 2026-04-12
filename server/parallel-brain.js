/**
 * parallel-brain.js — Brain computation across all CPU cores
 *
 * Each of the 7 neural clusters runs on its own worker thread.
 * Main thread orchestrates: send currents → collect spikes → run projections → repeat.
 *
 * Built-in Node.js worker_threads — zero third-party packages.
 *
 * Usage:
 *   const { ParallelBrain } = require('./parallel-brain.js');
 *   const brain = new ParallelBrain(clusterSizes, tonicDrives, noiseAmps);
 *   await brain.init();
 *   const results = await brain.step(externalCurrents);
 */

const { Worker } = require('worker_threads');
const path = require('path');

class ParallelBrain {
  constructor(clusterSizes, tonicDrives, noiseAmplitudes) {
    this._clusterSizes = clusterSizes;
    this._tonicDrives = tonicDrives;
    this._noiseAmps = noiseAmplitudes;
    this._workers = {};
    this._ready = {};
    this._pendingResults = {};
    this._resolvers = {};
    this._initialized = false;
  }

  /**
   * Spawn a worker thread per cluster.
   */
  async init() {
    const workerPath = path.join(__dirname, 'cluster-worker.js');
    const names = Object.keys(this._clusterSizes);

    // Allocate SharedArrayBuffers for zero-copy transfer
    this._sharedBuffers = {};
    for (const name of names) {
      const size = this._clusterSizes[name];
      this._sharedBuffers[name] = {
        voltages: new SharedArrayBuffer(size * 8), // Float64
        spikes: new SharedArrayBuffer(size),       // Uint8
      };
    }

    const readyPromises = names.map(name => {
      return new Promise((resolve) => {
        const worker = new Worker(workerPath, {
          workerData: {
            name,
            size: this._clusterSizes[name],
            tonicDrive: this._tonicDrives[name] || 15,
            noiseAmplitude: this._noiseAmps[name] || 8,
            sharedVoltages: this._sharedBuffers[name].voltages,
            sharedSpikes: this._sharedBuffers[name].spikes,
          },
        });

        worker.on('message', (msg) => {
          if (msg.type === 'ready') {
            console.log(`[Parallel] Worker ${msg.name} ready (${msg.size} neurons)`);
            resolve();
          }
          if (msg.type === 'result') {
            this._pendingResults[msg.name] = msg;
            // Check if all results are in
            if (this._resolvers.step && Object.keys(this._pendingResults).length === names.length) {
              this._resolvers.step(this._pendingResults);
              this._resolvers.step = null;
              this._pendingResults = {};
            }
          }
        });

        worker.on('error', (err) => {
          console.error(`[Parallel] Worker ${name} error:`, err.message);
        });

        this._workers[name] = worker;
      });
    });

    await Promise.all(readyPromises);
    this._initialized = true;
    console.log(`[Parallel] All ${names.length} cluster workers ready on ${names.length} cores`);
  }

  /**
   * Run one brain step across all workers in parallel.
   * Sends currents to each worker, waits for all to return spikes.
   *
   * @param {object} externalCurrents — { cortex: Float64Array, hippocampus: Float64Array, ... }
   * @returns {Promise<object>} — { cortex: { spikeCount, spikes, firingRate }, ... }
   */
  async step(externalCurrents = {}) {
    if (!this._initialized) throw new Error('ParallelBrain not initialized');

    // Dispatch step to ALL workers simultaneously
    for (const [name, worker] of Object.entries(this._workers)) {
      worker.postMessage({
        type: 'step',
        currents: externalCurrents[name] || null,
      });
    }

    // Wait for ALL workers to respond
    return new Promise((resolve) => {
      this._resolvers.step = resolve;
    });
  }

  /**
   * Terminate all workers.
   */
  async destroy() {
    for (const worker of Object.values(this._workers)) {
      await worker.terminate();
    }
    this._workers = {};
    this._initialized = false;
  }

  get isReady() { return this._initialized; }
  get workerCount() { return Object.keys(this._workers).length; }
}

module.exports = { ParallelBrain };
