/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini SDK lazily to avoid crashing on start if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Coach endpoint to explain hands
app.post('/api/coach', async (req, res) => {
  try {
    const { initialHand, heldIndices, optimalHold, evList } = req.body;

    if (!initialHand || !heldIndices || !optimalHold || !evList) {
      res.status(400).json({ error: 'Missing required hand data' });
      return;
    }

    const ai = getAiClient();

    // Map card data into readable text format
    const formatHand = (cards: any[]) =>
      cards
        .map((c) => {
          const valMap: Record<number, string> = {
            11: 'J',
            12: 'Q',
            13: 'K',
            14: 'A',
          };
          const valStr = valMap[c.value] || c.value.toString();
          const suitMap: Record<string, string> = {
            H: '♥️',
            D: '♦️',
            C: '♣️',
            S: '♠️',
          };
          const suitStr = suitMap[c.suit] || c.suit;
          return `${valStr}${suitStr}`;
        })
        .join(', ');

    const formatHolds = (cards: any[], holds: boolean[]) => {
      const held = cards.filter((_, idx) => holds[idx]);
      return held.length > 0 ? formatHand(held) : 'None';
    };

    const initialHandStr = formatHand(initialHand);
    const playerHeldStr = formatHolds(initialHand, heldIndices);
    const optimalHeldStr = formatHolds(initialHand, optimalHold);

    const playerEv = evList.find((item: any) =>
      item.holdMask.every((val: boolean, idx: number) => val === heldIndices[idx])
    )?.expectedValue || 0;

    const optimalEv = evList[0]?.expectedValue || 0;

    const evDiff = optimalEv - playerEv;
    const playedOptimally = evDiff < 0.0001;

    // Build top 3 hold options for Gemini to reference
    const topChoicesStr = evList
      .slice(0, 3)
      .map((item: any, i: number) => {
        const hCards = initialHand.filter((_, idx) => item.holdMask[idx]);
        const hCardsStr = hCards.length > 0 ? formatHand(hCards) : 'None';
        return `${i + 1}. Hold [${hCardsStr}] (EV: ${item.expectedValue.toFixed(4)})`;
      })
      .join('\n');

    // Create system prompt and user contents
    const systemInstruction = `You are a professional, friendly, and highly analytical video poker mentor/coach for a standard Aces Wild video poker game where Aces are completely wild.
Your goal is to explain card-hold decisions in a supportive, educational, and fun manner.
Analyze the expected value (EV), mathematical variance, and poker logic behind the hand.
Acknowledge if the player made the perfect optimal choice, or explain why another hold combination has a higher expected value.
Explain that Aces are wild, making them extremely valuable to hold, and that high cards without matching wild-rank value do not yield any payout unless you get at least a Three of a Kind.
Keep your explanation concise, extremely clear, engaging, and directly applicable. Focus purely on poker strategy. Do not speak in deep developer jargon or reference code parameters.`;

    const contents = `Analyze this video poker hand:
- Initial Hand Dealt: [${initialHandStr}]
- Player chose to hold: [${playerHeldStr}] (EV: ${playerEv.toFixed(4)})
- Mathematically Optimal hold: [${optimalHeldStr}] (EV: ${optimalEv.toFixed(4)})
- EV Difference: ${evDiff.toFixed(4)}
- Is Player Hold Optimal?: ${playedOptimally ? 'YES' : 'NO'}

Top 3 Mathematical Hold Options:
${topChoicesStr}

Please provide:
1. A quick "Coach Verdict" (e.g., "Perfect Play!", "Close, but...", "A bit of a gamble!")
2. A direct explanation of *why* the optimal hold is mathematically superior. Explain the combinations we are hoping to hit (e.g. four-to-a-flush with a wild Ace, holding wild Aces, inside straight draw vs keeping wild cards).
3. A friendly pro tip for standard Aces Wild strategy related to this situation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ analysis: response.text });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      error: 'Failed to generate coach advice.',
      details: error.message || error,
    });
  }
});

// Serve frontend assets & start listening
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
