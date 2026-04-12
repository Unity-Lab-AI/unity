/**
 * benchmark.js — Dense vs Sparse Performance & Memory Comparison
 *
 * Runnable in browser console or as ES module.
 * Tests neuron propagation, plasticity, and memory usage at
 * various scales to find the crossover point.
 *
 * Usage:
 *   import { runBenchmark } from './js/brain/benchmark.js';
 *   runBenchmark();
 *
 * Or from console:
 *   import('./js/brain/benchmark.js').then(m => m.runBenchmark());
 */

import { SparseMatrix } from './sparse-matrix.js';

// ── Dense Matrix (reference implementation) ───────────────────

class DenseMatrix {
  constructor(n) {
    this.n = n;
    this.W = new Float64Array(n * n);
  }

  initRandom(density, excitatoryRatio = 0.8) {
    const { n, W } = this;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (Math.random() < density) {
          const sign = Math.random() < excitatoryRatio ? 1 : -1;
          W[i * n + j] = sign * (0.1 + Math.random() * 0.4);
        }
      }
    }
  }

  propagate(spikes) {
    const { n, W } = this;
    const I = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      const row = i * n;
      for (let j = 0; j < n; j++) {
        sum += W[row + j] * spikes[j];
      }
      I[i] = sum;
    }
    return I;
  }

  rewardModulatedUpdate(pre, post, reward, lr) {
    const { n, W } = this;
    const factor = lr * reward;
    for (let i = 0; i < n; i++) {
      if (!post[i]) continue;
      const row = i * n;
      const scaled = factor * post[i];
      for (let j = 0; j < n; j++) {
        W[row + j] += scaled * pre[j];
      }
    }
  }

  get memoryBytes() {
    return this.W.byteLength;
  }
}

// ── Benchmark Runner ──────────────────────────────────────────

function generateSpikes(n, rate = 0.1) {
  const spikes = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (Math.random() < rate) spikes[i] = 1;
  }
  return spikes;
}

function timeMs(fn, iterations = 10) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return (performance.now() - start) / iterations;
}

function benchmarkAt(n, density = 0.12) {
  console.log(`\n  N=${n.toLocaleString()}, density=${(density*100).toFixed(1)}%`);
  console.log('  ' + '─'.repeat(60));

  // Dense
  const dense = new DenseMatrix(n);
  dense.initRandom(density);
  const denseMemMB = (dense.memoryBytes / 1048576).toFixed(2);

  // Sparse
  const sparse = new SparseMatrix(n, n, { wMin: -2, wMax: 2 });
  sparse.initRandom(density);
  const sparseMemMB = (sparse.memoryBytes / 1048576).toFixed(2);
  const ratio = (dense.memoryBytes / sparse.memoryBytes).toFixed(1);

  console.log(`  Memory: Dense=${denseMemMB}MB | Sparse=${sparseMemMB}MB | ${ratio}× reduction`);
  console.log(`  Connections: ${sparse.nnz.toLocaleString()} / ${(n*n).toLocaleString()} (${(sparse.density*100).toFixed(1)}%)`);

  // Generate test spikes
  const spikes = generateSpikes(n, 0.1);
  const pre = new Float64Array(spikes);
  const post = new Float64Array(generateSpikes(n, 0.1));

  // Propagation benchmark
  const iterations = n <= 1000 ? 100 : n <= 5000 ? 20 : 5;

  const densePropTime = timeMs(() => dense.propagate(spikes), iterations);
  const sparsePropTime = timeMs(() => sparse.propagate(spikes), iterations);
  const propSpeedup = (densePropTime / sparsePropTime).toFixed(1);

  console.log(`  Propagate: Dense=${densePropTime.toFixed(3)}ms | Sparse=${sparsePropTime.toFixed(3)}ms | ${propSpeedup}× speedup`);

  // Plasticity benchmark
  const densePlastTime = timeMs(() => dense.rewardModulatedUpdate(pre, post, 0.1, 0.001), iterations);
  const sparsePlastTime = timeMs(() => sparse.rewardModulatedUpdate(pre, post, 0.1, 0.001), iterations);
  const plastSpeedup = (densePlastTime / sparsePlastTime).toFixed(1);

  console.log(`  Plasticity: Dense=${densePlastTime.toFixed(3)}ms | Sparse=${sparsePlastTime.toFixed(3)}ms | ${plastSpeedup}× speedup`);

  // Pruning benchmark (sparse only)
  const pruneTime = timeMs(() => {
    const copy = SparseMatrix.fromDense(sparse.toDense(), n, n, 0.001);
    copy.prune(0.05);
  }, Math.min(iterations, 5));
  console.log(`  Prune: ${pruneTime.toFixed(3)}ms`);

  return {
    n, density,
    denseMemMB: parseFloat(denseMemMB),
    sparseMemMB: parseFloat(sparseMemMB),
    memoryRatio: parseFloat(ratio),
    densePropMs: densePropTime,
    sparsePropMs: sparsePropTime,
    propSpeedup: parseFloat(propSpeedup),
    densePlastMs: densePlastTime,
    sparsePlastMs: sparsePlastTime,
    plastSpeedup: parseFloat(plastSpeedup),
  };
}

/**
 * Run the full benchmark suite.
 * @param {number[]} sizes — neuron counts to test
 * @returns {Array} — benchmark results
 */
export function runBenchmark(sizes = [100, 500, 1000, 2000, 5000]) {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Dense vs Sparse Matrix Benchmark                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results = [];

  for (const n of sizes) {
    try {
      // Skip very large dense matrices that would blow memory
      if (n > 10000) {
        console.log(`\n  N=${n.toLocaleString()} — skipping dense (would need ${(n*n*8/1048576).toFixed(0)}MB)`);
        console.log('  Sparse only:');
        const sparse = new SparseMatrix(n, n, { wMin: -2, wMax: 2 });
        sparse.initRandom(0.05); // lower density for large N
        console.log(`  Memory: ${(sparse.memoryBytes/1048576).toFixed(2)}MB`);
        console.log(`  Connections: ${sparse.nnz.toLocaleString()}`);

        const spikes = generateSpikes(n, 0.1);
        const propTime = timeMs(() => sparse.propagate(spikes), 3);
        console.log(`  Propagate: ${propTime.toFixed(3)}ms`);

        results.push({ n, sparseOnly: true, sparseMemMB: sparse.memoryBytes/1048576, sparsePropMs: propTime });
        continue;
      }

      const density = n <= 1000 ? 0.12 : n <= 5000 ? 0.05 : 0.02;
      results.push(benchmarkAt(n, density));
    } catch (err) {
      console.warn(`  N=${n} failed: ${err.message}`);
    }
  }

  // Summary
  console.log('\n  ══ Summary ══');
  console.log('  N        | Dense MB | Sparse MB | Ratio | Prop Speedup');
  console.log('  ' + '─'.repeat(60));
  for (const r of results) {
    if (r.sparseOnly) {
      console.log(`  ${r.n.toString().padStart(7)} |   N/A    | ${r.sparseMemMB.toFixed(2).padStart(8)} |  N/A  | sparse only`);
    } else {
      console.log(`  ${r.n.toString().padStart(7)} | ${r.denseMemMB.toFixed(2).padStart(8)} | ${r.sparseMemMB.toFixed(2).padStart(8)} | ${r.memoryRatio.toFixed(1).padStart(5)}× | ${r.propSpeedup.toFixed(1).padStart(5)}×`);
    }
  }

  return results;
}

/**
 * GPU scale test — benchmark LIF step times at various neuron counts.
 * Tests CPU path since WebGPU requires browser context.
 *
 * @param {number[]} sizes — neuron counts to test
 */
export function runScaleTest(sizes = [1000, 2000, 5000, 10000, 25000, 50000]) {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Neuron Scale Test (CPU LIF Step)                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results = [];

  for (const n of sizes) {
    console.log(`\n  N=${n.toLocaleString()} neurons`);
    console.log('  ' + '─'.repeat(40));

    // Allocate neuron state
    const voltages = new Float64Array(n).fill(-65);
    const spikes = new Uint8Array(n);
    const currents = new Float64Array(n);

    // LIF parameters
    const tau = 20, vRest = -65, vThresh = -50, vReset = -70, dt = 1;

    // Tonic drive + noise
    for (let i = 0; i < n; i++) {
      currents[i] = 17 + (Math.random() - 0.5) * 8;
    }

    // LIF step function
    function lifStep() {
      let spikeCount = 0;
      for (let i = 0; i < n; i++) {
        const dV = (-(voltages[i] - vRest) + currents[i]) / tau;
        voltages[i] += dt * dV;
        spikes[i] = 0;
        if (voltages[i] >= vThresh) {
          spikes[i] = 1;
          voltages[i] = vReset;
          spikeCount++;
        }
        // Regenerate noise
        currents[i] = 17 + (Math.random() - 0.5) * 8;
      }
      return spikeCount;
    }

    // Warm up
    for (let i = 0; i < 10; i++) lifStep();

    // Benchmark
    const iterations = n <= 5000 ? 100 : n <= 25000 ? 20 : 5;
    const stepTime = timeMs(lifStep, iterations);
    const stepsPerSec = 1000 / stepTime;
    const fps60 = stepTime < 16.67 ? 'YES' : 'NO';

    // With 10 substeps per frame (like the server)
    const frameTime = stepTime * 10;
    const fps60x10 = frameTime < 16.67 ? 'YES' : 'NO';

    console.log(`  Step time: ${stepTime.toFixed(3)}ms (${stepsPerSec.toFixed(0)} steps/sec)`);
    console.log(`  60fps single step: ${fps60}`);
    console.log(`  60fps × 10 substeps: ${fps60x10} (${frameTime.toFixed(3)}ms/frame)`);
    console.log(`  Memory: ${(n * 8 * 3 / 1048576).toFixed(2)}MB (voltages + spikes + currents)`);

    results.push({
      n, stepMs: stepTime, stepsPerSec,
      can60fps: stepTime < 16.67,
      can60fpsX10: frameTime < 16.67,
      memMB: n * 8 * 3 / 1048576,
    });
  }

  // Summary
  console.log('\n  ══ Scale Summary ══');
  console.log('  Neurons   | Step ms  | Steps/s  | 60fps  | 60fps×10');
  console.log('  ' + '─'.repeat(55));
  for (const r of results) {
    console.log(`  ${r.n.toString().padStart(8)} | ${r.stepMs.toFixed(3).padStart(8)} | ${r.stepsPerSec.toFixed(0).padStart(8)} | ${(r.can60fps ? 'YES' : 'NO').padStart(6)} | ${(r.can60fpsX10 ? 'YES' : 'NO').padStart(6)}`);
  }

  // Find sweet spot
  const sweetSpot = results.filter(r => r.can60fpsX10);
  if (sweetSpot.length > 0) {
    const best = sweetSpot[sweetSpot.length - 1];
    console.log(`\n  Sweet spot: ${best.n.toLocaleString()} neurons @ 60fps×10 substeps`);
  }

  return results;
}
