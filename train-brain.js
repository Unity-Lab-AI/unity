/**
 * train-brain.js — Background training loop
 *
 * Asks Claude questions on varied topics, feeds responses to the brain.
 * Run alongside brain-server.js. Teaches continuously until stopped.
 *
 * Usage: node train-brain.js
 */

const http = require('http');

const BRAIN_URL = 'http://localhost:8080';
const DELAY_BETWEEN = 5000; // 5s between Claude calls (don't spam)

const TOPICS = [
  // Conversational
  "Write 10 short natural sentences someone would say in a casual conversation with a friend. One per line, no numbering.",
  "Write 10 things someone might say when they're excited about something. Short, natural. One per line.",
  "Write 10 things someone might say when they're worried or concerned. Short, conversational. One per line.",
  "Write 10 flirty things someone might say. Playful, not crude. One per line.",
  "Write 10 comforting things you'd say to someone having a bad day. One per line.",
  "Write 10 sarcastic responses to stupid questions. Funny, not mean. One per line.",
  "Write 10 things you'd say when meeting someone new. Natural, not formal. One per line.",
  "Write 10 things you'd say when you disagree with someone but respect them. One per line.",
  // Emotional
  "Write 10 sentences expressing genuine happiness. Not cheesy, real. One per line.",
  "Write 10 sentences expressing frustration without being aggressive. One per line.",
  "Write 10 sentences about missing someone. Honest, not dramatic. One per line.",
  "Write 10 sentences about being proud of something you did. One per line.",
  "Write 10 sentences about feeling uncertain but pushing forward anyway. One per line.",
  // Philosophical
  "Write 10 short observations about human nature. Conversational tone. One per line.",
  "Write 10 short thoughts about what makes relationships work. One per line.",
  "Write 10 short observations about creativity and making things. One per line.",
  "Write 10 short thoughts about trust and when to give it. One per line.",
  "Write 10 short observations about loneliness and connection. One per line.",
  // Descriptive
  "Write 10 short descriptions of how different emotions feel physically. One per line.",
  "Write 10 short descriptions of everyday moments that feel meaningful. One per line.",
  "Write 10 short metaphors for common experiences. One per line.",
  // Questions
  "Write 10 interesting questions you'd ask someone you just met. One per line.",
  "Write 10 deep questions you'd ask a close friend at 2am. One per line.",
  "Write 10 playful questions to keep a conversation going. One per line.",
  // Reactions
  "Write 10 different ways to say 'that's interesting'. Natural variety. One per line.",
  "Write 10 different ways to say 'I understand'. Not clinical. One per line.",
  "Write 10 different ways to say 'tell me more'. Curious, engaged. One per line.",
  "Write 10 different ways to express surprise. One per line.",
  "Write 10 different ways to change the subject smoothly. One per line.",
  // Stories/anecdotes
  "Write 5 very short anecdotes (2-3 sentences each) about everyday life. Relatable.",
  "Write 5 very short anecdotes about learning something the hard way. 2-3 sentences each.",
  "Write 5 very short anecdotes about unexpected kindness. 2-3 sentences each.",
];

function post(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 90000,
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 5000 }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function askClaude(prompt) {
  const result = await post(`${BRAIN_URL}/v1/chat/completions`, {
    messages: [{ role: 'user', content: prompt }]
  });
  return result?.choices?.[0]?.message?.content || null;
}

async function teachBrain(sentences) {
  const result = await post(`${BRAIN_URL}/api/teach`, { sentences });
  return result;
}

async function getStats() {
  return await get(`${BRAIN_URL}/api/brain-stats`);
}

async function main() {
  console.log('=== Unity Brain Training Loop ===');
  console.log(`Topics: ${TOPICS.length}`);
  console.log(`Delay: ${DELAY_BETWEEN}ms between calls`);
  console.log('');

  const startStats = await getStats();
  console.log(`Starting dict: ${startStats?.dictSize || '?'} words`);
  console.log('');

  let totalTaught = 0;
  let round = 0;

  while (true) {
    round++;
    console.log(`\n--- Round ${round} ---`);

    for (let i = 0; i < TOPICS.length; i++) {
      const topic = TOPICS[i];
      const shortTopic = topic.slice(0, 60) + '...';

      try {
        console.log(`[${i + 1}/${TOPICS.length}] Asking Claude: ${shortTopic}`);
        const response = await askClaude(topic);

        if (!response) {
          console.log('  (no response, skipping)');
          await sleep(DELAY_BETWEEN);
          continue;
        }

        // Split into sentences
        const sentences = response.split('\n')
          .map(l => l.trim().replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim())
          .filter(l => l.length > 10 && l.length < 300);

        if (sentences.length === 0) {
          console.log('  (no usable sentences)');
          await sleep(DELAY_BETWEEN);
          continue;
        }

        // Teach
        const result = await teachBrain(sentences);
        totalTaught += result?.taught || 0;
        console.log(`  Taught ${result?.taught || 0} sentences. Dict: ${result?.dictSize || '?'} | Total taught: ${totalTaught}`);

      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }

      await sleep(DELAY_BETWEEN);
    }

    const stats = await getStats();
    console.log(`\n=== Round ${round} complete. Dict: ${stats?.dictSize || '?'} words. Total taught: ${totalTaught} ===`);
    console.log('Starting next round in 10s...');
    await sleep(10000);
  }
}

main().catch(e => console.error('Fatal:', e));
