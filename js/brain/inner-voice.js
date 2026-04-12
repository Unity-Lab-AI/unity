/**
 * inner-voice.js — Unity's Internal Monologue
 *
 * Pre-verbal thought system. The brain thinks continuously —
 * cortex prediction patterns + emotional state + memory recall
 * produce a stream of internal experience that doesn't need
 * language to exist. The inner voice converts these patterns
 * into expressible thought when the brain decides to communicate.
 *
 * Uses the Dictionary to form words from brain state.
 * Uses cortex sequential prediction (ŝ = W·x) for sentence flow.
 *
 * The AI model is NOT needed. The brain speaks from its own
 * learned vocabulary. The AI teaches new words when connected.
 */

import { Dictionary } from './dictionary.js';

// Thought-to-speech threshold equation:
// shouldSpeak = socialNeed × arousal × cortexCoherence > SPEECH_THRESHOLD
const SPEECH_THRESHOLD = 0.15;

// No minimum — the brain speaks from whatever it has, even from day one
const MIN_VOCAB_FOR_SPEECH = 0;

// How often to form a new thought (brain steps)
const THOUGHT_INTERVAL = 60; // ~1 second at 60fps

export class InnerVoice {
  constructor() {
    this.dictionary = new Dictionary();
    this._thoughtCounter = 0;

    // Current internal state — updated every thought cycle
    this.currentThought = {
      pattern: new Float64Array(32),  // cortex activation pattern
      arousal: 0,
      valence: 0,
      psi: 0,
      coherence: 0,
      predictionError: 0,
      mood: 'neutral',          // derived from equations
      words: [],                // candidate words for this state
      sentence: '',             // self-generated sentence (if any)
      shouldSpeak: false,       // whether the thought crosses speech threshold
    };

    // Thought history — last N thoughts for the brain to reflect on
    this._thoughtHistory = [];
    this._maxHistory = 50;
  }

  /**
   * Process one thought cycle. Called by the brain engine each frame.
   * Takes the full brain state, derives a thought, optionally forms words.
   *
   * @param {object} brainState — from engine.getState()
   * @returns {object} — the current thought
   */
  think(brainState) {
    this._thoughtCounter++;
    if (this._thoughtCounter % THOUGHT_INTERVAL !== 0) return this.currentThought;

    const amyg = brainState.amygdala || {};
    const arousal = amyg.arousal ?? 0.5;
    const valence = amyg.valence ?? 0;
    const psi = brainState.psi ?? 0;
    const coherence = brainState.oscillations?.coherence ?? 0.5;
    const cortex = brainState.cortex || {};
    const hypo = brainState.hypothalamus || {};
    const memory = brainState.memory || {};

    // Cortex prediction error — how surprised the brain is
    const error = cortex.error;
    const predictionError = error
      ? (error.length ? Math.abs(error[0]) : Math.abs(error))
      : 0;

    // Cortex output pattern — the brain's current "thought vector"
    const clusters = brainState.clusters || {};
    const cortexCluster = clusters.cortex;
    const pattern = cortexCluster?.voltages
      ? this._downsample(cortexCluster.voltages, 32)
      : new Float64Array(32);

    // Mood IS the equations — no string categories
    // intensity = arousal × (0.5 + psi × 0.3) — how STRONG the feeling
    // direction = valence — positive or negative
    // clarity = coherence — how focused the thought
    const moodIntensity = arousal * (0.5 + psi * 0.3);
    const moodDirection = valence;
    const moodClarity = coherence;
    // mood as equation signature, not a word
    const mood = `${moodIntensity.toFixed(2)}/${moodDirection.toFixed(2)}/${moodClarity.toFixed(2)}`;

    // Find matching words from dictionary — cortex pattern drives selection
    const words = this.dictionary.findByPattern(pattern, 10);
    // Also get mood-matched words
    const moodWords = this.dictionary.findByMood(arousal, valence, 10);

    // Should the brain speak? Pure equation: socialNeed × arousal × coherence
    const socialNeed = hypo.drives?.social_need ?? 0.5;
    const speechDrive = socialNeed * arousal * coherence;
    const shouldSpeak = speechDrive > SPEECH_THRESHOLD;

    // Generate sentence — brain speaks from whatever vocabulary it has
    let sentence = '';
    if (shouldSpeak && this.dictionary.size > 0) {
      sentence = this.dictionary.generateSentence(arousal, valence);
    }

    // Update current thought
    this.currentThought = {
      pattern,
      arousal,
      valence,
      psi,
      coherence,
      predictionError,
      mood,
      words,
      sentence,
      shouldSpeak,
      socialNeed,
      moodIntensity,
      vocabSize: this.dictionary.size,
    };

    // Store in history
    this._thoughtHistory.push({
      mood,
      arousal,
      valence,
      psi,
      time: brainState.time ?? 0,
    });
    if (this._thoughtHistory.length > this._maxHistory) {
      this._thoughtHistory.shift();
    }

    return this.currentThought;
  }

  /**
   * Learn from text the brain heard or spoke.
   * Every word gets stored with its cortex pattern and emotional context.
   *
   * @param {string} text — sentence heard or spoken
   * @param {Float64Array} cortexPattern — cortex state at the time
   * @param {number} arousal
   * @param {number} valence
   */
  learn(text, cortexPattern, arousal, valence) {
    this.dictionary.learnSentence(text, cortexPattern, arousal, valence);
  }

  /**
   * Generate a response from the brain's own vocabulary.
   * No AI model needed. Returns null if vocabulary is too small.
   *
   * @param {number} arousal
   * @param {number} valence
   * @returns {string|null}
   */
  speak(arousal, valence) {
    if (this.dictionary.size < MIN_VOCAB_FOR_SPEECH) return null;
    const sentence = this.dictionary.generateSentence(arousal, valence);
    return sentence || null;
  }

  /**
   * Save dictionary to persistent storage.
   */
  save() {
    this.dictionary.save();
  }

  /**
   * Get the current thought state for display.
   */
  getState() {
    return {
      mood: this.currentThought.mood,
      shouldSpeak: this.currentThought.shouldSpeak,
      vocabSize: this.dictionary.size,
      bigramCount: this.dictionary.bigramCount,
      sentence: this.currentThought.sentence,
      words: this.currentThought.words.slice(0, 5),
      moodIntensity: this.currentThought.moodIntensity,
      history: this._thoughtHistory.slice(-10),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────

  _downsample(arr, targetLen) {
    const result = new Float64Array(targetLen);
    if (!arr || arr.length === 0) return result;
    const step = Math.floor(arr.length / targetLen);
    for (let i = 0; i < targetLen; i++) {
      const idx = i * step;
      result[i] = idx < arr.length ? (arr[idx] + 70) / 20 : 0; // normalize voltage
    }
    return result;
  }
}
