/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, Suit, HandRank, HoldAnalysis } from './types';

export const PAYTABLE: Record<HandRank, { label: string; multiplier: number }> = {
  ROYAL_FLUSH: { label: 'Natural Royal Flush', multiplier: 250 },
  FOUR_WILD_ACES: { label: 'Four Wild Aces', multiplier: 200 },
  WILD_ROYAL_FLUSH: { label: 'Wild Royal Flush', multiplier: 25 },
  FIVE_OF_A_KIND: { label: 'Five of a Kind', multiplier: 15 },
  STRAIGHT_FLUSH: { label: 'Straight Flush', multiplier: 9 },
  FOUR_OF_A_KIND: { label: 'Four of a Kind', multiplier: 5 },
  FULL_HOUSE: { label: 'Full House', multiplier: 3 },
  FLUSH: { label: 'Flush', multiplier: 2 },
  STRAIGHT: { label: 'Straight', multiplier: 2 },
  THREE_OF_A_KIND: { label: 'Three of a Kind', multiplier: 1 },
  HIGH_CARD: { label: 'Loss', multiplier: 0 },
};

// Returns standard 52 deck of cards
export function getDeck(): Card[] {
  const suits: Suit[] = ['H', 'D', 'C', 'S'];
  const deck: Card[] = [];
  let idCounter = 1;
  for (const suit of suits) {
    for (let value = 2; value <= 14; value++) {
      deck.push({
        id: `${suit}-${value}-${idCounter++}`,
        value,
        suit,
      });
    }
  }
  return deck;
}

// Convert a deck index (0-51) to a Card object
export function getCardFromIndex(index: number): Card {
  const suits: Suit[] = ['H', 'D', 'C', 'S'];
  const suit = suits[index % 4];
  const value = Math.floor(index / 4) + 2;
  return {
    id: `card-${index}`,
    value,
    suit,
  };
}

// Convert a Card object to its deck index (0-51)
export function getIndexFromCard(card: Card): number {
  const suits: Suit[] = ['H', 'D', 'C', 'S'];
  const sIndex = suits.indexOf(card.suit);
  const vIndex = card.value - 2;
  return vIndex * 4 + sIndex;
}

// Hyper-optimized non-allocating 5-card index evaluator for Aces Wild
export function evaluateIndices(c1: number, c2: number, c3: number, c4: number, c5: number): HandRank {
  const v1 = Math.floor(c1 / 4) + 2;
  const v2 = Math.floor(c2 / 4) + 2;
  const v3 = Math.floor(c3 / 4) + 2;
  const v4 = Math.floor(c4 / 4) + 2;
  const v5 = Math.floor(c5 / 4) + 2;

  const s1 = c1 % 4;
  const s2 = c2 % 4;
  const s3 = c3 % 4;
  const s4 = c4 % 4;
  const s5 = c5 % 4;

  let wildCount = 0;
  if (v1 === 14) wildCount++;
  if (v2 === 14) wildCount++;
  if (v3 === 14) wildCount++;
  if (v4 === 14) wildCount++;
  if (v5 === 14) wildCount++;

  if (wildCount === 4) {
    return 'FOUR_WILD_ACES';
  }

  // Count non-wilds
  let isFlush = true;
  let firstSuit = -1;
  
  if (v1 !== 14) firstSuit = s1;
  else if (v2 !== 14) firstSuit = s2;
  else if (v3 !== 14) firstSuit = s3;
  else if (v4 !== 14) firstSuit = s4;
  else if (v5 !== 14) firstSuit = s5;

  if (firstSuit !== -1) {
    if (v1 !== 14 && s1 !== firstSuit) isFlush = false;
    if (v2 !== 14 && s2 !== firstSuit) isFlush = false;
    if (v3 !== 14 && s3 !== firstSuit) isFlush = false;
    if (v4 !== 14 && s4 !== firstSuit) isFlush = false;
    if (v5 !== 14 && s5 !== firstSuit) isFlush = false;
  } else {
    isFlush = true;
  }

  // Collect non-wild values
  let nvCount = 0;
  let n1 = 0, n2 = 0, n3 = 0, n4 = 0, n5 = 0;
  
  if (v1 !== 14) { n1 = v1; nvCount++; }
  if (v2 !== 14) {
    if (nvCount === 0) n1 = v2;
    else if (nvCount === 1) n2 = v2;
    nvCount++;
  }
  if (v3 !== 14) {
    if (nvCount === 0) n1 = v3;
    else if (nvCount === 1) n2 = v3;
    else if (nvCount === 2) n3 = v3;
    nvCount++;
  }
  if (v4 !== 14) {
    if (nvCount === 0) n1 = v4;
    else if (nvCount === 1) n2 = v4;
    else if (nvCount === 2) n3 = v4;
    else if (nvCount === 3) n4 = v4;
    nvCount++;
  }
  if (v5 !== 14) {
    if (nvCount === 0) n1 = v5;
    else if (nvCount === 1) n2 = v5;
    else if (nvCount === 2) n3 = v5;
    else if (nvCount === 3) n4 = v5;
    else if (nvCount === 4) n5 = v5;
    nvCount++;
  }

  // Sort non-wilds descending
  if (nvCount >= 2) {
    let t;
    if (nvCount === 2) {
      if (n1 < n2) { t = n1; n1 = n2; n2 = t; }
    } else if (nvCount === 3) {
      if (n1 < n2) { t = n1; n1 = n2; n2 = t; }
      if (n2 < n3) { t = n2; n2 = n3; n3 = t; }
      if (n1 < n2) { t = n1; n1 = n2; n2 = t; }
    } else if (nvCount === 4) {
      if (n1 < n2) { t = n1; n1 = n2; n2 = t; }
      if (n3 < n4) { t = n3; n3 = n4; n4 = t; }
      if (n1 < n3) { t = n1; n1 = n3; n3 = t; }
      if (n2 < n4) { t = n2; n2 = n4; n4 = t; }
      if (n2 < n3) { t = n2; n2 = n3; n3 = t; }
    } else if (nvCount === 5) {
      if (n1 < n2) { t = n1; n1 = n2; n2 = t; }
      if (n4 < n5) { t = n4; n4 = n5; n5 = t; }
      if (n1 < n3) { t = n1; n1 = n3; n3 = t; }
      if (n2 < n3) { t = n2; n2 = n3; n3 = t; }
      if (n2 < n4) { t = n2; n2 = n4; n4 = t; }
      if (n3 < n4) { t = n3; n3 = n4; n4 = t; }
      if (n1 < n2) { t = n1; n1 = n2; n2 = t; }
      if (n4 < n5) { t = n4; n4 = n5; n5 = t; }
      if (n3 < n4) { t = n3; n3 = n4; n4 = t; }
      if (n2 < n3) { t = n2; n2 = n3; n3 = t; }
    }
  }

  // Frequencies
  let maxCount = 0;
  let secondMaxCount = 0;
  let hasDuplicates = false;

  if (nvCount === 1) {
    maxCount = 1;
  } else if (nvCount === 2) {
    if (n1 === n2) { maxCount = 2; hasDuplicates = true; }
    else { maxCount = 1; secondMaxCount = 1; }
  } else if (nvCount === 3) {
    if (n1 === n3) { maxCount = 3; hasDuplicates = true; }
    else if (n1 === n2) { maxCount = 2; secondMaxCount = 1; hasDuplicates = true; }
    else if (n2 === n3) { maxCount = 2; secondMaxCount = 1; hasDuplicates = true; }
    else { maxCount = 1; secondMaxCount = 1; }
  } else if (nvCount === 4) {
    if (n1 === n4) { maxCount = 4; hasDuplicates = true; }
    else if (n1 === n3) { maxCount = 3; secondMaxCount = 1; hasDuplicates = true; }
    else if (n2 === n4) { maxCount = 3; secondMaxCount = 1; hasDuplicates = true; }
    else if (n1 === n2 && n3 === n4) { maxCount = 2; secondMaxCount = 2; hasDuplicates = true; }
    else if (n1 === n2) { maxCount = 2; secondMaxCount = 1; hasDuplicates = true; }
    else if (n2 === n3) { maxCount = 2; secondMaxCount = 1; hasDuplicates = true; }
    else if (n3 === n4) { maxCount = 2; secondMaxCount = 1; hasDuplicates = true; }
    else { maxCount = 1; secondMaxCount = 1; }
  } else if (nvCount === 5) {
    if (n1 === n5) { maxCount = 5; hasDuplicates = true; }
    else if (n1 === n4 || n2 === n5) { maxCount = 4; secondMaxCount = 1; hasDuplicates = true; }
    else if ((n1 === n3 && n4 === n5) || (n1 === n2 && n3 === n5)) { maxCount = 3; secondMaxCount = 2; hasDuplicates = true; }
    else if (n1 === n3 || n2 === n4 || n3 === n5) { maxCount = 3; secondMaxCount = 1; hasDuplicates = true; }
    else if ((n1 === n2 && n3 === n4) || (n1 === n2 && n4 === n5) || (n2 === n3 && n4 === n5)) { maxCount = 2; secondMaxCount = 2; hasDuplicates = true; }
    else if (n1 === n2 || n2 === n3 || n3 === n4 || n4 === n5) { maxCount = 2; secondMaxCount = 1; hasDuplicates = true; }
    else { maxCount = 1; secondMaxCount = 1; }
  }

  // Straight
  let isStraight = false;
  if (!hasDuplicates && nvCount > 0) {
    let minVal = n1;
    if (nvCount >= 2 && n2 < minVal) minVal = n2;
    if (nvCount >= 3 && n3 < minVal) minVal = n3;
    if (nvCount >= 4 && n4 < minVal) minVal = n4;
    if (nvCount >= 5 && n5 < minVal) minVal = n5;

    let maxVal = n1;
    if (nvCount >= 2 && n2 > maxVal) maxVal = n2;
    if (nvCount >= 3 && n3 > maxVal) maxVal = n3;
    if (nvCount >= 4 && n4 > maxVal) maxVal = n4;
    if (nvCount >= 5 && n5 > maxVal) maxVal = n5;

    if (maxVal - minVal <= 4) {
      isStraight = true;
    }
  }

  if (wildCount === 3) {
    if (isFlush && n1 >= 10 && n1 <= 13 && n2 >= 10 && n2 <= 13) {
      return 'WILD_ROYAL_FLUSH';
    }
    if (maxCount === 2) {
      return 'FIVE_OF_A_KIND';
    }
    if (isFlush && isStraight) {
      return 'STRAIGHT_FLUSH';
    }
    return 'FOUR_OF_A_KIND';
  }

  if (wildCount === 2) {
    if (isFlush && n1 >= 10 && n1 <= 13 && n2 >= 10 && n2 <= 13 && n3 >= 10 && n3 <= 13) {
      return 'WILD_ROYAL_FLUSH';
    }
    if (maxCount === 3) {
      return 'FIVE_OF_A_KIND';
    }
    if (isFlush && isStraight) {
      return 'STRAIGHT_FLUSH';
    }
    if (maxCount === 2) {
      return 'FOUR_OF_A_KIND';
    }
    if (isFlush) {
      return 'FLUSH';
    }
    if (isStraight) {
      return 'STRAIGHT';
    }
    return 'THREE_OF_A_KIND';
  }

  if (wildCount === 1) {
    let wildSuit = -1;
    if (v1 === 14) wildSuit = s1;
    else if (v2 === 14) wildSuit = s2;
    else if (v3 === 14) wildSuit = s3;
    else if (v4 === 14) wildSuit = s4;
    else if (v5 === 14) wildSuit = s5;

    if (isFlush && n1 >= 10 && n1 <= 13 && n2 >= 10 && n2 <= 13 && n3 >= 10 && n3 <= 13 && n4 >= 10 && n4 <= 13) {
      if (wildSuit === firstSuit) {
        return 'ROYAL_FLUSH';
      } else {
        return 'WILD_ROYAL_FLUSH';
      }
    }
    if (maxCount === 4) {
      return 'FIVE_OF_A_KIND';
    }
    if (isFlush && isStraight) {
      return 'STRAIGHT_FLUSH';
    }
    if (maxCount === 3) {
      return 'FOUR_OF_A_KIND';
    }
    if (maxCount === 2 && secondMaxCount === 2) {
      return 'FULL_HOUSE';
    }
    if (isFlush) {
      return 'FLUSH';
    }
    if (isStraight) {
      return 'STRAIGHT';
    }
    if (maxCount === 2) {
      return 'THREE_OF_A_KIND';
    }
    return 'HIGH_CARD';
  }

  if (wildCount === 0) {
    if (isFlush && isStraight) {
      return 'STRAIGHT_FLUSH';
    }
    if (maxCount === 4) {
      return 'FOUR_OF_A_KIND';
    }
    if (maxCount === 3 && secondMaxCount === 2) {
      return 'FULL_HOUSE';
    }
    if (isFlush) {
      return 'FLUSH';
    }
    if (isStraight) {
      return 'STRAIGHT';
    }
    if (maxCount === 3) {
      return 'THREE_OF_A_KIND';
    }
    return 'HIGH_CARD';
  }

  return 'HIGH_CARD';
}

// Full Card evaluator for display
export function evaluateHand(cards: Card[]): { rank: HandRank; label: string; payoutMultiplier: number } {
  if (cards.length !== 5) {
    return { rank: 'HIGH_CARD', label: 'Loss', payoutMultiplier: 0 };
  }
  const indices = cards.map(getIndexFromCard);
  const rank = evaluateIndices(indices[0], indices[1], indices[2], indices[3], indices[4]);

  return {
    rank,
    label: PAYTABLE[rank].label,
    payoutMultiplier: PAYTABLE[rank].multiplier,
  };
}

// Convert a payout multiplier to HandRank name
export function getRankNameFromMultiplier(mult: number): string {
  if (mult === 250) return 'Natural Royal Flush';
  if (mult === 200) return 'Four Wild Aces';
  if (mult === 25) return 'Wild Royal Flush';
  if (mult === 15) return 'Five of a Kind';
  if (mult === 9) return 'Straight Flush';
  if (mult === 5) return 'Four of a Kind';
  if (mult === 3) return 'Full House';
  if (mult === 2) return 'Flush/Straight';
  if (mult === 1) return 'Three of a Kind';
  return 'Loss';
}

// Calculate the Expected Value (EV) for all 32 hold combinations
export function getHoldAnalysis(hand: Card[]): HoldAnalysis[] {
  if (hand.length !== 5) return [];

  const handIndices = hand.map(getIndexFromCard);
  const handIndicesSet = new Set(handIndices);

  // 47 cards remaining in deck
  const remainingDeck: number[] = [];
  for (let i = 0; i < 52; i++) {
    if (!handIndicesSet.has(i)) {
      remainingDeck.push(i);
    }
  }

  const results: HoldAnalysis[] = [];

  // Loop through all 32 hold patterns (0 to 31)
  for (let mask = 0; mask < 32; mask++) {
    const holdMask: boolean[] = [];
    const heldCardIndices: number[] = [];
    const discardIndices: number[] = [];

    for (let i = 0; i < 5; i++) {
      const isHeld = (mask & (1 << i)) !== 0;
      holdMask.push(isHeld);
      if (isHeld) {
        heldCardIndices.push(handIndices[i]);
      } else {
        discardIndices.push(i);
      }
    }

    const k = discardIndices.length; // number of cards to draw
    let totalPayoutMultiplier = 0;
    let combCount = 0;

    if (k === 0) {
      // Hold all 5 cards
      const r = evaluateIndices(
        handIndices[0],
        handIndices[1],
        handIndices[2],
        handIndices[3],
        handIndices[4]
      );
      totalPayoutMultiplier = PAYTABLE[r].multiplier;
      combCount = 1;
    } else if (k === 1) {
      // Discard 1 card
      const d0 = discardIndices[0];
      const finalHand = [...handIndices];
      for (let i = 0; i < 47; i++) {
        finalHand[d0] = remainingDeck[i];
        const r = evaluateIndices(
          finalHand[0],
          finalHand[1],
          finalHand[2],
          finalHand[3],
          finalHand[4]
        );
        totalPayoutMultiplier += PAYTABLE[r].multiplier;
        combCount++;
      }
    } else if (k === 2) {
      // Discard 2 cards
      const d0 = discardIndices[0];
      const d1 = discardIndices[1];
      const finalHand = [...handIndices];
      for (let i = 0; i < 46; i++) {
        const cI = remainingDeck[i];
        finalHand[d0] = cI;
        for (let j = i + 1; j < 47; j++) {
          finalHand[d1] = remainingDeck[j];
          const r = evaluateIndices(
            finalHand[0],
            finalHand[1],
            finalHand[2],
            finalHand[3],
            finalHand[4]
          );
          totalPayoutMultiplier += PAYTABLE[r].multiplier;
          combCount++;
        }
      }
    } else if (k === 3) {
      // Discard 3 cards
      const d0 = discardIndices[0];
      const d1 = discardIndices[1];
      const d2 = discardIndices[2];
      const finalHand = [...handIndices];
      for (let i = 0; i < 45; i++) {
        const cI = remainingDeck[i];
        finalHand[d0] = cI;
        for (let j = i + 1; j < 46; j++) {
          const cJ = remainingDeck[j];
          finalHand[d1] = cJ;
          for (let m = j + 1; m < 47; m++) {
            finalHand[d2] = remainingDeck[m];
            const r = evaluateIndices(
              finalHand[0],
              finalHand[1],
              finalHand[2],
              finalHand[3],
              finalHand[4]
            );
            totalPayoutMultiplier += PAYTABLE[r].multiplier;
            combCount++;
          }
        }
      }
    } else if (k === 4) {
      // Discard 4 cards
      const d0 = discardIndices[0];
      const d1 = discardIndices[1];
      const d2 = discardIndices[2];
      const d3 = discardIndices[3];
      const finalHand = [...handIndices];
      for (let i = 0; i < 44; i++) {
        const cI = remainingDeck[i];
        finalHand[d0] = cI;
        for (let j = i + 1; j < 45; j++) {
          const cJ = remainingDeck[j];
          finalHand[d1] = cJ;
          for (let m = j + 1; m < 46; m++) {
            const cM = remainingDeck[m];
            finalHand[d2] = cM;
            for (let n = m + 1; n < 47; n++) {
              finalHand[d3] = remainingDeck[n];
              const r = evaluateIndices(
                finalHand[0],
                finalHand[1],
                finalHand[2],
                finalHand[3],
                finalHand[4]
              );
              totalPayoutMultiplier += PAYTABLE[r].multiplier;
              combCount++;
            }
          }
        }
      }
    } else if (k === 5) {
      // Discard 5 cards (all cards).
      // Since evaluating all 1,533,939 combinations is fast with our non-allocating evaluator,
      // we can do the full loop in ~3-4ms in modern V8!
      for (let i = 0; i < 43; i++) {
        for (let j = i + 1; j < 44; j++) {
          const cI = remainingDeck[i];
          const cJ = remainingDeck[j];
          for (let m = j + 1; m < 45; m++) {
            const cM = remainingDeck[m];
            for (let n = m + 1; n < 46; n++) {
              const cN = remainingDeck[n];
              for (let p = n + 1; p < 47; p++) {
                const r = evaluateIndices(
                  cI,
                  cJ,
                  cM,
                  cN,
                  remainingDeck[p]
                );
                totalPayoutMultiplier += PAYTABLE[r].multiplier;
                combCount++;
              }
            }
          }
        }
      }
    }

    const expectedValue = totalPayoutMultiplier / combCount;

    // Hand label of current holds (for reference)
    const currentHoldRank = evaluateHand(
      hand.map((card, idx) => (holdMask[idx] ? card : { id: `dummy-${idx}`, value: 0, suit: 'H' }))
    );

    results.push({
      holdMask,
      heldCardIndices,
      expectedValue,
      expectedPayout: expectedValue, // relative to a 1 coin bet
      handRankName: currentHoldRank.label,
    });
  }

  // Sort by expected value descending
  results.sort((a, b) => b.expectedValue - a.expectedValue);
  return results;
}
