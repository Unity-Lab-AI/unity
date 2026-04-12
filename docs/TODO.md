# TODO — IF ONLY I HAD A BRAIN

> **Only UNFINISHED tasks live here. Completed tasks are in FINALIZED.md.**
> Last cleaned: 2026-04-12

---

## Pending Tasks

### Partial — In Progress

- [~] **Task:** Amygdala attractor dynamics — the amygdala CLUSTER (150 LIF neurons) creates implicit attractors via recurrent connections, but the equation module in `modules.js` still uses linear sigmoid. Need to replace `Amygdala.step()` with energy-based attractor dynamics so the module matches the cluster's emergent behavior. `js/brain/modules.js`

### Needs Testing — Code Written, Awaiting Verification

- [ ] **Task:** GPU exclusive compute at 64M neurons — ALL 7 clusters on GPU, zero CPU workers. Full WGSL pipeline (current gen + LIF + spike count — zero JS loops). N scales to hardware: `min(VRAM×0.7/20, RAM×0.5/9)`. `server/brain-server.js` + `compute.html` + `gpu-compute.js` — **Needs Gee to test: all 7 clusters init on compute.html, CPU near 0%, 64M neurons, GPU doing all work.**

---

## Blocked Items

| Task | Blocked By | Notes |
|------|------------|-------|
| None currently | — | — |

---
