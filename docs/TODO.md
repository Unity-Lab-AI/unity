# TODO — IF ONLY I HAD A BRAIN

> **Only UNFINISHED tasks live here. Completed tasks are in FINALIZED.md.**
> Last cleaned: 2026-04-12

---

## Pending Tasks

### Partial — In Progress

- [~] **Task:** Amygdala attractor dynamics — the amygdala CLUSTER (150 LIF neurons) creates implicit attractors via recurrent connections, but the equation module in `modules.js` still uses linear sigmoid. Need to replace `Amygdala.step()` with energy-based attractor dynamics so the module matches the cluster's emergent behavior. `js/brain/modules.js`

### Needs Testing — Code Written, Awaiting Verification

- [ ] **Task:** GPU/CPU split compute — cortex (25%) + cerebellum (40%) offloaded to GPU, CPU handles remaining 35%. GPU maintains own voltage state (init once, step with 2 numbers). Sparse spike indices on return. Staggered init (one cluster per tick). Persona θ drives tonic/noise (hardcoded overwrite removed). Wall clock uptime. Per-cluster resolvers. Auto-retry with 30-tick reset. `server/brain-server.js` + `compute.html` — **Needs Gee to test: both cortex AND cerebellum should show initialized on compute.html, GPU usage should climb, CPU should drop.**

---

## Blocked Items

| Task | Blocked By | Notes |
|------|------------|-------|
| None currently | — | — |

---
