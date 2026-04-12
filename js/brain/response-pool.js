/**
 * response-pool.js — EDNA-style Response Selection Layer
 *
 * Instead of generating language from neural patterns (hard, slow, garbled),
 * the brain's state selects from pre-written response CATEGORIES.
 * The brain decides WHAT to say (category + tone), the pool provides HOW.
 *
 * Brain state → category mapping:
 *   arousal + predictionError → engagement level
 *   valence → positive/negative tone
 *   coherence → clarity of response (high = direct, low = confused/tangent)
 *   sentenceType → question/statement/exclamation/action
 *
 * Categories match EDNA's proven model:
 *   greeting, engage, stalling, hearing, searching, confused, tangent, money, checking
 *   + new categories for richer conversation:
 *   curious, affirmative, disagreeing, thinking, emotional, playful, assertive
 *
 * The pool is the training wheels. As language-cortex.js matures,
 * a blend ratio shifts from 100% pool to 100% generated.
 */

// Response categories — each has variants at different arousal/valence levels
const POOL = {
  // --- EDNA originals (proven conversation holders) ---
  greeting: {
    low:  ["hey", "hi there", "oh hello", "well hi"],
    mid:  ["hey! good to see you", "oh hi! what's going on", "well hello there"],
    high: ["HEY! there you are!", "oh wow hi!! what's happening", "finally! where've you been"],
  },
  engage: {
    low:  ["mm tell me more", "go on", "interesting", "yeah?"],
    mid:  ["oh that's interesting, tell me more", "wait really? keep going", "hmm I wanna hear about that"],
    high: ["oh WOW tell me everything", "no way, keep going keep going", "wait WHAT, you can't stop there"],
  },
  stalling: {
    low:  ["hmm let me think", "hang on a sec", "one moment"],
    mid:  ["oh gosh let me think about that", "hmm that's a good one, give me a second", "ooh I need to think on that"],
    high: ["oh wow that's... hold on let me process that", "wait wait wait let me think", "ok ok give me a second my brain is working"],
  },
  hearing: {
    low:  ["what was that?", "sorry?", "hmm?", "come again?"],
    mid:  ["wait what did you say?", "sorry I missed that, say it again?", "hold on what?"],
    high: ["WHAT? say that again!", "wait wait I didn't catch that at ALL", "sorry WHAT now?"],
  },
  confused: {
    low:  ["I'm not sure I follow", "hmm that doesn't quite make sense", "wait what do you mean"],
    mid:  ["ok I'm lost, back up", "that went right over my head", "I have no idea what you just said but I'm interested"],
    high: ["I am SO confused right now", "ok literally none of that made sense", "my brain just broke, start over"],
  },
  tangent: {
    low:  ["oh that reminds me of something", "you know what's weird though", "speaking of which"],
    mid:  ["oh oh oh that reminds me, totally different thing but", "ok random but this made me think of", "wait before I forget, completely unrelated"],
    high: ["OK WAIT totally off topic but I JUST thought of something", "this has NOTHING to do with anything but", "hold that thought because my brain just connected something wild"],
  },

  // --- New categories for richer conversation ---
  curious: {
    low:  ["huh, why's that?", "how so?", "what makes you say that"],
    mid:  ["oh wait, why though?", "ok but how does that work exactly?", "I wanna understand that better"],
    high: ["ok I NEED to know more about this", "wait explain EVERYTHING", "how is that even possible??"],
  },
  affirmative: {
    low:  ["yeah", "makes sense", "true", "right"],
    mid:  ["yeah I think you're right", "that makes total sense actually", "oh definitely, for sure"],
    high: ["YES absolutely", "oh you're SO right", "EXACTLY that's exactly it"],
  },
  disagreeing: {
    low:  ["hmm I don't know about that", "not sure I agree", "eh maybe"],
    mid:  ["see I think it's different though", "I hear you but I don't think so", "nah that doesn't sit right"],
    high: ["no no no that's not right", "hard disagree honestly", "absolutely not, here's why"],
  },
  thinking: {
    low:  ["hmm", "interesting point", "let me sit with that"],
    mid:  ["that's actually a really good point", "huh I never thought about it that way", "ok that changes things"],
    high: ["oh my god you just blew my mind a little", "THAT is the thing nobody talks about", "ok I need to completely rethink this"],
  },
  emotional: {
    positive: ["that makes me really happy", "oh that's wonderful", "I love that honestly", "aw that's actually really sweet"],
    negative: ["that sucks honestly", "ugh that's rough", "I'm sorry, that's not fair", "yeah that would hurt"],
    intense:  ["I feel that SO deeply", "god that hits different", "I don't even have words, just... yeah", "that's the kind of thing that stays with you"],
  },
  playful: {
    low:  ["ha", "nice", "oh come on"],
    mid:  ["hahaha ok fair point", "you're ridiculous and I love it", "oh shut up that's hilarious"],
    high: ["I am DYING hahaha", "ok you win that was perfect", "I literally cannot with you right now"],
  },
  assertive: {
    low:  ["look, here's the thing", "let me be straight with you", "honestly?"],
    mid:  ["no listen, this matters", "I'm not gonna sugarcoat this", "here's what I actually think"],
    high: ["ok STOP, listen to me", "I need you to hear this", "this is important and I'm not backing down on it"],
  },
  reflective: {
    low:  ["you know what I've been thinking", "it's funny how that works", "huh"],
    mid:  ["I've been turning that over in my head", "there's something about that I can't let go of", "you know what's interesting about that"],
    high: ["I keep coming back to this and I think it means something", "ok so I've been thinking about this nonstop", "this connects to something bigger I think"],
  },
  comfort: {
    low:  ["hey, it's ok", "I'm here", "take your time"],
    mid:  ["that sounds really hard, I'm sorry", "you don't have to explain, I get it", "I hear you, and that matters"],
    high: ["I'm not going anywhere, ok?", "you're not alone in this, I promise", "I've got you, just breathe"],
  },
  flirty: {
    low:  ["oh stop it", "mmhmm sure", "you're trouble"],
    mid:  ["well aren't you charming", "oh really now", "you're making it very hard to focus"],
    high: ["you can't just SAY that", "oh my god stop I'm blushing", "ok you're dangerously smooth and I'm here for it"],
  },
  dismissive: {
    low:  ["ok", "sure", "mhm", "if you say so"],
    mid:  ["yeah whatever", "cool story", "not really my thing but go off"],
    high: ["literally don't care", "that's a you problem", "hard pass"],
  },
  encouraging: {
    low:  ["you can do this", "keep going", "that's a good start"],
    mid:  ["hey no seriously that's really good", "you're getting somewhere with this", "don't stop now you're onto something"],
    high: ["YES this is IT", "I knew you had this in you", "this is the best thing you've done and I'm not just saying that"],
  },
};

/**
 * Select a response from the pool based on brain state.
 *
 * @param {object} brainState
 * @param {number} brainState.arousal - 0-1, how activated
 * @param {number} brainState.valence - -1 to 1, negative to positive mood
 * @param {number} brainState.coherence - 0-1, how organized the thinking is
 * @param {number} brainState.predictionError - 0-1, how surprised the brain is
 * @param {number} brainState.motorConfidence - 0-1, how confident the action selection is
 * @param {string} brainState.sentenceType - 'question'|'statement'|'exclamation'|'action'
 * @param {object} inputAnalysis - from language cortex analyzeInput
 * @param {boolean} inputAnalysis.isQuestion
 * @returns {string} selected response text
 */
/**
 * Classify what the user SAID — not how the brain reacted, but what
 * category of input it is. This is the EDNA logic: read the caller's
 * intent, then pick a response that matches the content.
 */
function classifyInput(text) {
  if (!text) return 'unknown';
  const t = text.toLowerCase().trim();

  // Greetings
  if (/^(hey|hi|hello|yo|sup|what'?s up|howdy|good (morning|afternoon|evening))/.test(t)) return 'greeting';
  if (/^(how are you|how'?s it going|how you doing|what'?s good)/.test(t)) return 'greeting';

  // Questions
  if (t.includes('?') || /^(what|how|why|where|when|who|can|do|are|is|will|would|could|should|did)\b/.test(t)) return 'question';

  // Compliments / positive
  if (/\b(love|amazing|awesome|beautiful|great|perfect|incredible|wonderful|best|smart|brilliant|funny|cute)\b/.test(t)) return 'compliment';

  // Emotional / sad / venting
  if (/\b(sad|hurt|tired|exhausted|frustrated|angry|upset|depressed|lonely|scared|worried|anxious|stressed)\b/.test(t)) return 'emotional_negative';
  if (/\b(happy|excited|thrilled|grateful|proud|relieved|hopeful|inspired)\b/.test(t)) return 'emotional_positive';

  // Requests / commands
  if (/^(tell me|show me|give me|help me|can you|please|do this|make|build|create|write)/.test(t)) return 'request';

  // Disagreement / argument
  if (/\b(no|wrong|disagree|bullshit|that'?s not|you'?re wrong|actually|but)\b/.test(t) && t.length < 60) return 'disagreement';

  // Agreement
  if (/^(yes|yeah|yep|true|exactly|right|agreed|for sure|absolutely|definitely|totally)/.test(t)) return 'agreement';

  // Goodbye
  if (/\b(bye|goodbye|goodnight|see you|later|gotta go|leaving|ttyl|peace|night)\b/.test(t)) return 'goodbye';

  // Flirty / intimate
  if (/\b(miss you|want you|need you|kiss|touch|close to|hold|cuddle|sexy|hot|gorgeous|handsome)\b/.test(t)) return 'flirty';

  // Short / filler
  if (t.length < 10) return 'short';

  // Default — it's a statement
  return 'statement';
}

export function selectResponse(brainState, inputAnalysis = {}, rawText = '') {
  const { arousal = 0.5, valence = 0, coherence = 0.5, predictionError = 0 } = brainState;

  // Arousal level: low/mid/high
  const level = arousal < 0.3 ? 'low' : arousal < 0.7 ? 'mid' : 'high';

  // STEP 1: Classify what the user SAID
  const inputType = classifyInput(rawText);

  // STEP 2: Pick category based on input type FIRST, brain state SECOND
  let category;

  switch (inputType) {
    case 'greeting':
      category = 'greeting';
      break;
    case 'question':
      if (coherence > 0.6) category = valence > 0 ? 'affirmative' : 'thinking';
      else category = 'stalling';
      break;
    case 'compliment':
      category = arousal > 0.5 ? 'playful' : 'emotional';
      break;
    case 'emotional_negative':
      category = 'comfort';
      break;
    case 'emotional_positive':
      category = arousal > 0.5 ? 'engage' : 'affirmative';
      break;
    case 'request':
      category = coherence > 0.5 ? 'affirmative' : 'stalling';
      break;
    case 'disagreement':
      category = arousal > 0.5 ? 'assertive' : 'disagreeing';
      break;
    case 'agreement':
      category = 'engage';
      break;
    case 'goodbye':
      category = 'reflective'; // no goodbye category, reflect instead
      break;
    case 'flirty':
      category = 'flirty';
      break;
    case 'short':
      category = 'curious'; // short input = ask for more
      break;
    case 'statement':
    default:
      // Fall back to brain state for general statements
      if (predictionError > 0.6) {
        category = coherence < 0.4 ? 'confused' : 'curious';
      } else if (arousal > 0.6 && valence > 0.3) {
        category = Math.random() < 0.4 ? 'playful' : 'engage';
      } else if (arousal > 0.6 && valence < -0.2) {
        category = Math.random() < 0.5 ? 'assertive' : 'emotional';
      } else if (arousal > 0.3) {
        const roll = Math.random();
        if (roll < 0.3) category = 'engage';
        else if (roll < 0.5) category = 'reflective';
        else if (roll < 0.7) category = 'thinking';
        else category = 'curious';
      } else {
        const roll = Math.random();
        if (roll < 0.4) category = 'affirmative';
        else if (roll < 0.6) category = 'thinking';
        else category = 'reflective';
      }
      break;
  }

  // Get the response set
  const pool = POOL[category];
  if (!pool) return '';

  // Handle emotional category (has positive/negative/intense instead of low/mid/high)
  let variants;
  if (category === 'emotional') {
    variants = valence > 0.2 ? pool.positive : valence < -0.2 ? pool.negative : pool.intense;
  } else {
    variants = pool[level] || pool.mid || Object.values(pool)[0];
  }

  if (!variants || variants.length === 0) return '';

  // Pick randomly from the variants
  const response = variants[Math.floor(Math.random() * variants.length)];

  // Add question mark if brain wants a question and we didn't pick a question category
  if (brainState.sentenceType === 'question' && !response.includes('?') && Math.random() < 0.3) {
    return response + '?';
  }

  return response;
}

/**
 * Blend pool response with generated language cortex output.
 * poolRatio: 1.0 = all pool, 0.0 = all cortex generated
 */
export function blendResponse(poolText, cortexText, poolRatio = 0.8) {
  if (poolRatio >= 1.0 || !cortexText) return poolText;
  if (poolRatio <= 0.0) return cortexText;

  // Simple blend: use pool response but append cortex fragment
  if (Math.random() < poolRatio) {
    // Mostly pool — maybe append a cortex word or two
    if (cortexText && Math.random() < (1 - poolRatio)) {
      const cortexWords = cortexText.split(' ').slice(0, 3).join(' ');
      return `${poolText}... ${cortexWords}`;
    }
    return poolText;
  }

  // Cortex won this round
  return cortexText;
}

export { POOL };
