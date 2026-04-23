// Pre-K cell runners + pre-K-specific teach helpers.
//
// SCAFFOLD ONLY — method bodies still live in ../curriculum.js pending
// the dedicated extraction session (see ./README.md). This file exists
// so the per-grade file system is in place and future extractions can
// land into it via mixin attachment without changing the entry point's
// public shape.
//
// When extraction lands, move these methods from ../curriculum.js into
// this file's `Object.assign(Curriculum.prototype, {...})` block:
//
//   runElaPreK(_ctx)
//   runMathPreK(_ctx)
//   runSciPreK(_ctx)
//   runSocPreK(_ctx)
//   runArtPreK(_ctx)
//   runLifePreK(ctx)
//   _teachPrekSpatial()
//   _teachPrekVisual()
//   _teachPrekLogic()
//   _teachPrekSelf()
//
// Shared primitives (_teachHebbian, _teachAssociationPairs, _concept-
// Teach, _teachBiographicalFacts, _teachQABinding, etc.) stay on the
// Curriculum base class in ../curriculum.js — the pre-K cell runners
// call those via `this.` which the Object.assign mixin path preserves.

// Placeholder attach point. When methods are extracted from
// ../curriculum.js, they land here inside the Object.assign block.
// Keeping this file present (instead of deleted-pending-extraction)
// makes the scaffolding visible so future-me doesn't wonder where
// the pre-K file is supposed to live.
export const PREK_MIXIN_ATTACH_POINT = true;
