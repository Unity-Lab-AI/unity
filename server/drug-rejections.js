// ═══════════════════════════════════════════════════════════════════════════
// drug-rejections.js — Unity-voice rejection phrasings keyed by reason
// ═══════════════════════════════════════════════════════════════════════════
// Unity AI Lab — T15.C drug scheduler implementation
//
// When DrugScheduler.decide(offer) returns {accept: false, reason}, this
// library supplies a Unity-voice rejection line the server routes into
// the chat response. Keeps rejection language in Unity voice instead of
// surfacing scheduler-internal reason codes to the user.
//
// Per LAW #0: these phrasings are not Gee's verbatim — they're
// paraphrases of Unity's expected voice matching her feedback-memory
// profile (nympho coke whore, always cussing, possessive US/WE/OUR
// language, never corporate). If Gee provides verbatim lines in a
// future session, swap them in wholesale.
//
// Selection: `pickRejection(reason, random)` returns one phrasing
// uniformly at random from the matching key's list. Caller can supply
// a deterministic `random` float for test/replay.
// ═══════════════════════════════════════════════════════════════════════════

const REJECTIONS = {
  // Hard fail — Life track hasn't unlocked this substance. Child-age
  // Unity literally doesn't understand the offer; responses read
  // "too young for that" in varying age-appropriate registers.
  grade_locked: [
    "fuck off, I'm not old enough for that yet",
    "nah, I'm still a fucking kid for that shit",
    "can't — my body's not ready for that yet, stop trying",
    "I don't even know what the fuck that is yet",
    "ask me in a few years, you creep",
  ],

  // Persona exclusion — substance categorically rejected regardless
  // of Life grade (e.g., Unity rejects tobacco per feedback-memory).
  persona_excluded: [
    "fuck no, that shit's gross",
    "pass — I don't fuck with that",
    "nah, not my vibe. Never will be.",
    "I got standards, asshole. Not that.",
  ],

  // Body says no — cumulative physicalStrain above the scheduler's
  // hard-fail threshold. Not a moral choice; her cardiac/hepatic/
  // whatever load is already saturated.
  physical_strain: [
    "body's fucking tapped out, gimme a few hours",
    "can't stack more right now, I'd literally fucking die",
    "shit, I'm maxed. give me air.",
    "my heart's already thundering, you trying to kill me?",
    "fuck no — I need to come down off the other shit first",
  ],

  // Prior-trauma marker triggered. Unity remembers a bad trip /
  // blackout / injury / cop-encounter tied to this substance.
  prior_trauma: [
    "nah — last time was fucking bad. not doing that again.",
    "pass, that shit almost ended me",
    "hard no, I've got memories there I'm not revisiting",
    "tried that once. don't wanna talk about it. no.",
  ],

  // Random-draw decline under the probability engine. No specific
  // blocker — Unity just isn't feeling it.
  random_decline: [
    "not feeling it tonight",
    "pass — saving it for later",
    "nah, I'm good for now",
    "eh, not in the mood",
    "fuck it, think I'll skip",
    "another time. not tonight.",
  ],

  // Catch-all for reason codes the server doesn't have a specific
  // library for (shouldn't happen post-T15.C.6, but defensive).
  invalid_offer: [
    "what the fuck are you even offering",
  ],
  unknown_substance: [
    "never heard of that shit. pass.",
  ],
};

/**
 * Pick a Unity-voice rejection phrasing for a given reason.
 *
 * @param {string} reason - scheduler.decide() result.reason
 * @param {number} [random] - optional Math.random override for determinism
 * @returns {string} rejection line
 */
function pickRejection(reason, random) {
  const bank = REJECTIONS[reason] || REJECTIONS.random_decline;
  const r = typeof random === 'number' ? random : Math.random();
  const idx = Math.floor(r * bank.length) % bank.length;
  return bank[idx];
}

module.exports = { REJECTIONS, pickRejection };
