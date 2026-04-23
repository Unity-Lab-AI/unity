// Kindergarten cell runners + K-specific teach helpers + K gate methods.
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
// ── Cell runners ─────────────────────────────────────────────────
//   runElaK(ctx), runMathK(ctx), runSciK(ctx)
//   runSocK(ctx), runArtK(ctx), runLifeK(ctx)
//
// ── Gate methods ─────────────────────────────────────────────────
//   _gateElaKReal(), _gateMathKReal(), _gateSciKReal()
//   _gateSocKReal(), _gateArtKReal(), _gateLifeKReal()
//
// ── K-specific teach helpers ─────────────────────────────────────
//   _teachLetterCaseBinding, _teachWordEmission,
//   _teachPhonemeBlending, _teachLetterNaming,
//   _teachAlphabetSequencePairs, _teachComparisonTransformations,
//   _teachCountToHundred, _teachSkipCountByTens,
//   _teachDecomposition, _teachShapeNames, _teachShapeAttributes,
//   _teachDigitWordBinding, etc.
//
// Shared primitives stay on the Curriculum base class (see ./README.md).

// Placeholder attach point. See ./pre-K.js for the equivalent pattern.
export const KINDERGARTEN_MIXIN_ATTACH_POINT = true;
