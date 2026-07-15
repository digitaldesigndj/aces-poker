/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Suit = 'H' | 'D' | 'C' | 'S'; // Hearts, Diamonds, Clubs, Spades

export interface Card {
  id: string; // unique identifier for animations and keys
  value: number; // 2 through 14 (11=J, 12=Q, 13=K, 14=A)
  suit: Suit;
}

export type HandRank =
  | 'ROYAL_FLUSH'
  | 'FOUR_WILD_ACES'
  | 'WILD_ROYAL_FLUSH'
  | 'FIVE_OF_A_KIND'
  | 'STRAIGHT_FLUSH'
  | 'FOUR_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'FLUSH'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'HIGH_CARD';

export interface PaytableRow {
  rank: HandRank;
  label: string;
  payouts: [number, number, number, number, number]; // payouts for 1, 2, 3, 4, 5 coins
}

export interface HoldAnalysis {
  holdMask: boolean[]; // 5 booleans indicating which cards are held
  heldCardIndices: number[];
  expectedValue: number;
  expectedPayout: number;
  handRankName: string;
}

export interface GameStats {
  handsPlayed: number;
  totalBet: number;
  totalWon: number;
  netCredits: number;
  perfectHoldCount: number; // hands where player played mathematically optimal hold
  totalHoldAccuracy: number; // sum of actual_hold_EV / optimal_hold_EV
  royalFlushes: number;
  fourWildAces: number;
  wildRoyalFlushes: number;
  fiveOfAKinds: number;
  straightFlushes: number;
  fourOfAKinds: number;
  fullHouses: number;
  flushes: number;
  straights: number;
  threeOfAKinds: number;
  twoPairs: number;
  jacksOrBetter: number;
  losses: number;
}

export interface HandHistory {
  id: string;
  timestamp: string;
  initialHand: Card[];
  heldIndices: number[];
  finalHand: Card[];
  finalRank: HandRank;
  bet: number;
  won: number;
  optimalHoldIndices: number[];
  holdAccuracy: number; // actual EV / optimal EV
}
