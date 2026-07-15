/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Heart,
  Diamond,
  Club,
  Spade,
  Coins,
  RotateCcw,
  TrendingUp,
  Info,
  Sparkles,
  Volume2,
  VolumeX,
  Award,
  HelpCircle,
  Trophy,
  History,
  TrendingDown,
  BrainCircuit,
  MessageSquare,
  Flame,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Gauge,
  Zap,
  HelpCircle as QuestionIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sounds } from './sound';
import { Card, Suit, HandRank, HoldAnalysis, GameStats, HandHistory } from './types';
import {
  evaluateHand,
  getHoldAnalysis,
  getDeck,
  PAYTABLE,
  getRankNameFromMultiplier,
  getIndexFromCard
} from './pokerMath';

const DEFAULT_STATS: GameStats = {
  handsPlayed: 0,
  totalBet: 0,
  totalWon: 0,
  netCredits: 0,
  perfectHoldCount: 0,
  totalHoldAccuracy: 0,
  royalFlushes: 0,
  fourWildAces: 0,
  wildRoyalFlushes: 0,
  fiveOfAKinds: 0,
  straightFlushes: 0,
  fourOfAKinds: 0,
  fullHouses: 0,
  flushes: 0,
  straights: 0,
  threeOfAKinds: 0,
  twoPairs: 0,
  jacksOrBetter: 0,
  losses: 0,
};

export default function App() {
  // Game states
  const [credits, setCredits] = useState<number>(() => {
    const saved = localStorage.getItem('vp_credits');
    return saved ? parseInt(saved, 10) : 1000;
  });
  const [bet, setBet] = useState<number>(5);
  const [hand, setHand] = useState<Card[]>([]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [gameState, setGameState] = useState<'IDLE' | 'DEALT' | 'GAMEOVER'>('IDLE');
  
  // Auto play states
  const [autoPlayCount, setAutoPlayCount] = useState<number>(0);
  const [autoPlayPhase, setAutoPlayPhase] = useState<'IDLE' | 'DEALT_WAIT_HOLD' | 'HOLD_WAIT_DRAW'>('IDLE');
  const [autoPlaySpeed, setAutoPlaySpeed] = useState<'1X' | '2X' | 'TURBO'>(() => {
    const saved = localStorage.getItem('vp_autoplay_speed');
    if (saved === '1X' || saved === '2X' || saved === 'TURBO') return saved as '1X' | '2X' | 'TURBO';
    const legacy = localStorage.getItem('vp_fast_autoplay');
    return legacy === 'true' ? '2X' : '1X';
  });
  
  // Real-time analysis states
  const [holdAnalysis, setHoldAnalysis] = useState<HoldAnalysis[]>([]);
  const [isAnalyzerMode, setIsAnalyzerMode] = useState<boolean>(true); // helper for trainer mode
  
  // Stats and history states
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('vp_stats');
    return saved ? JSON.parse(saved) : DEFAULT_STATS;
  });
  const [history, setHistory] = useState<HandHistory[]>(() => {
    const saved = localStorage.getItem('vp_history');
    return saved ? JSON.parse(saved) : [];
  });

  // AI Coach state
  const [coachAnalysis, setCoachAnalysis] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState<boolean>(false);

  // Sound/Mute state
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('vp_muted') === 'true';
  });

  // Highlighted winning paytable row
  const [winningRank, setWinningRank] = useState<HandRank | null>(null);
  const [currentPayoutNotice, setCurrentPayoutNotice] = useState<string | null>(null);
  const [accuracyFeedback, setAccuracyFeedback] = useState<{
    accuracy: number;
    playedEv: number;
    optimalEv: number;
    isPerfect: boolean;
    optimalHoldStr: string;
    playerHoldStr: string;
  } | null>(null);

  // Synchronize mute with sound manager
  useEffect(() => {
    sounds.setMute(isMuted);
    localStorage.setItem('vp_muted', isMuted ? 'true' : 'false');
  }, [isMuted]);

  // Persistent storage of credits, stats, and history
  useEffect(() => {
    localStorage.setItem('vp_credits', credits.toString());
  }, [credits]);

  useEffect(() => {
    localStorage.setItem('vp_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('vp_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('vp_autoplay_speed', autoPlaySpeed);
  }, [autoPlaySpeed]);

  // Auto-play state machine engine
  useEffect(() => {
    if (autoPlayCount <= 0) return;

    let timerId: NodeJS.Timeout;
    let delay = 1000;
    if (autoPlaySpeed === '2X') {
      delay = 500;
    } else if (autoPlaySpeed === 'TURBO') {
      delay = 50;
    }

    if (gameState === 'IDLE' || gameState === 'GAMEOVER') {
      timerId = setTimeout(() => {
        handleDeal();
        setAutoPlayPhase('DEALT_WAIT_HOLD');
      }, delay);
    } else if (gameState === 'DEALT') {
      if (autoPlayPhase === 'DEALT_WAIT_HOLD') {
        timerId = setTimeout(() => {
          handleWizardHold();
          setAutoPlayPhase('HOLD_WAIT_DRAW');
        }, delay);
      } else if (autoPlayPhase === 'HOLD_WAIT_DRAW') {
        timerId = setTimeout(() => {
          handleDraw();
          setAutoPlayCount((prev) => prev - 1);
          setAutoPlayPhase('IDLE');
        }, delay);
      }
    }

    return () => {
      clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayCount, gameState, autoPlayPhase, autoPlaySpeed]);

  // Current hand's real-time rank during DEALT state
  const currentDealtRank = useMemo(() => {
    if (gameState === 'DEALT') {
      return evaluateHand(hand);
    }
    return null;
  }, [hand, gameState]);

  // Final evaluated rank
  const finalHandRank = useMemo(() => {
    if (gameState === 'GAMEOVER' && hand.length === 5) {
      return evaluateHand(hand);
    }
    return null;
  }, [hand, gameState]);

  // Reset stats
  const handleResetStats = () => {
    if (window.confirm('Are you sure you want to reset all game statistics and history?')) {
      setStats(DEFAULT_STATS);
      setHistory([]);
      sounds.playButton();
    }
  };

  // Quick helper to format card for simple string representation
  const formatCardName = (card: Card) => {
    if (card.value === 0) return '';
    const valMap: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const suitMap: Record<Suit, string> = { H: '♥️', D: '♦️', C: '♣️', S: '♠️' };
    return `${valMap[card.value] || card.value}${suitMap[card.suit]}`;
  };

  // Get readable cards held list
  const getCardsHeldStr = (cards: Card[], mask: boolean[]) => {
    const held = cards.filter((_, idx) => mask[idx]);
    return held.length > 0 ? held.map(formatCardName).join(' ') : 'None';
  };

  // Main Deal Action
  const handleDeal = () => {
    if (credits < bet) {
      // Auto top up
      sounds.playWinSmall();
      setCredits((prev) => prev + 1000);
      alert('Out of credits! We have topped you up with 1,000 free training credits.');
      return;
    }

    sounds.playBet();
    setCredits((prev) => prev - bet);
    setHeld([false, false, false, false, false]);
    setWinningRank(null);
    setCurrentPayoutNotice(null);
    setAccuracyFeedback(null);
    setCoachAnalysis(null);

    // Initialize fresh deck and draw 5 cards
    const freshDeck = getDeck();
    // Simple robust Fisher-Yates shuffle
    for (let i = freshDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = freshDeck[i];
      freshDeck[i] = freshDeck[j];
      freshDeck[j] = temp;
    }

    const initialHand = freshDeck.slice(0, 5);
    const remainingDeck = freshDeck.slice(5);

    setHand(initialHand);
    setDeck(remainingDeck);

    // Run real-time hand analyzer immediately (exact EV counts)
    const analysis = getHoldAnalysis(initialHand);
    setHoldAnalysis(analysis);

    setGameState('DEALT');

    // Trigger sequential card flip audio effect
    let count = 0;
    const interval = setInterval(() => {
      if (count < 5) {
        sounds.playCardFlip();
        count++;
      } else {
        clearInterval(interval);
      }
    }, 60);
  };

  // Toggle card hold status
  const handleToggleHold = (idx: number) => {
    if (gameState !== 'DEALT' || autoPlayCount > 0) return;
    sounds.playCardHold();
    setHeld((prev) => {
      const copy = [...prev];
      copy[idx] = !copy[idx];
      return copy;
    });
  };

  // Automatically hold mathematically optimal hand (Wizard feature)
  const handleWizardHold = () => {
    if (gameState !== 'DEALT' || holdAnalysis.length === 0) return;
    sounds.playCardHold();
    setHeld([...holdAnalysis[0].holdMask]);
  };

  // Draw final replacement cards and finish the hand
  const handleDraw = () => {
    if (gameState !== 'DEALT' || hand.length !== 5) return;

    // 1. Math Analysis: Compare player held choices to optimal holds
    const optimalHold = holdAnalysis[0]; // sorted descending by EV
    const optimalMask = optimalHold.holdMask;

    // Find the EV of player's actual hold choice from the holdAnalysis array
    const playerHoldObj = holdAnalysis.find((item) =>
      item.holdMask.every((val, idx) => val === held[idx])
    );
    
    const playerEv = playerHoldObj ? playerHoldObj.expectedValue : 0;
    const optimalEv = optimalHold.expectedValue;
    const evDiff = optimalEv - playerEv;
    const isPerfect = evDiff < 0.0001; // floating point safe comparison

    const currentHoldStr = getCardsHeldStr(hand, held);
    const bestHoldStr = getCardsHeldStr(hand, optimalMask);

    const accuracy = optimalEv > 0 ? playerEv / optimalEv : 1.0;

    setAccuracyFeedback({
      accuracy,
      playedEv: playerEv,
      optimalEv,
      isPerfect,
      optimalHoldStr: bestHoldStr,
      playerHoldStr: currentHoldStr,
    });

    // 2. Draw replacement cards
    let deckCopy = [...deck];
    const finalHand = hand.map((card, idx) => {
      if (held[idx]) {
        return card; // hold
      } else {
        // replace
        const nextCard = deckCopy.shift()!;
        return nextCard;
      }
    });

    setHand(finalHand);
    setDeck(deckCopy);

    // 3. Evaluate Final Result
    const finalResult = evaluateHand(finalHand);
    
    // Check if Royal Flush pays special bonus on 5 coin bet
    let finalPayoutMultiplier = finalResult.payoutMultiplier;
    let actualPayout = finalPayoutMultiplier * bet;
    if (finalResult.rank === 'ROYAL_FLUSH' && bet === 5) {
      actualPayout = 4000;
      finalPayoutMultiplier = 800;
    }

    setCredits((prev) => prev + actualPayout);

    // Play visual/audio triggers
    if (actualPayout > 0) {
      setWinningRank(finalResult.rank);
      setCurrentPayoutNotice(`WON ${actualPayout} CREDITS! (${finalResult.label})`);
      if (finalResult.payoutMultiplier >= 10) {
        sounds.playWinBig();
      } else {
        sounds.playWinSmall();
      }
    } else {
      sounds.playLose();
      setCurrentPayoutNotice('NO WIN');
    }

    // 4. Update stats
    setStats((prev) => {
      const copy = { ...prev };
      copy.handsPlayed += 1;
      copy.totalBet += bet;
      copy.totalWon += actualPayout;
      copy.netCredits = credits + actualPayout - (savedCreditsBaseline() + bet); // track net relative to initial sessions
      
      if (isPerfect) {
        copy.perfectHoldCount += 1;
      }
      copy.totalHoldAccuracy += accuracy;

      // Increment rank frequencies
      if (actualPayout > 0) {
        if (finalResult.rank === 'ROYAL_FLUSH') copy.royalFlushes += 1;
        else if (finalResult.rank === 'FOUR_WILD_ACES') copy.fourWildAces = (copy.fourWildAces || 0) + 1;
        else if (finalResult.rank === 'WILD_ROYAL_FLUSH') copy.wildRoyalFlushes = (copy.wildRoyalFlushes || 0) + 1;
        else if (finalResult.rank === 'FIVE_OF_A_KIND') copy.fiveOfAKinds = (copy.fiveOfAKinds || 0) + 1;
        else if (finalResult.rank === 'STRAIGHT_FLUSH') copy.straightFlushes += 1;
        else if (finalResult.rank === 'FOUR_OF_A_KIND') copy.fourOfAKinds += 1;
        else if (finalResult.rank === 'FULL_HOUSE') copy.fullHouses += 1;
        else if (finalResult.rank === 'FLUSH') copy.flushes += 1;
        else if (finalResult.rank === 'STRAIGHT') copy.straights += 1;
        else if (finalResult.rank === 'THREE_OF_A_KIND') copy.threeOfAKinds += 1;
      } else {
        copy.losses += 1;
      }

      return copy;
    });

    // 5. Append to hand history
    const historyItem: HandHistory = {
      id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      initialHand: [...hand],
      heldIndices: [...held.map((val, idx) => (val ? idx : -1)).filter((v) => v !== -1)],
      finalHand,
      finalRank: finalResult.rank,
      bet,
      won: actualPayout,
      optimalHoldIndices: optimalMask.map((val, idx) => (val ? idx : -1)).filter((v) => v !== -1),
      holdAccuracy: accuracy,
    };

    setHistory((prev) => [historyItem, ...prev].slice(0, 50)); // cap history at 50

    setGameState('GAMEOVER');
  };

  const savedCreditsBaseline = () => {
    const saved = localStorage.getItem('vp_credits');
    return saved ? parseInt(saved, 10) : 1000;
  };

  // Adjust Bet level
  const handleIncreaseBet = () => {
    if (gameState !== 'IDLE') return;
    sounds.playBet();
    setBet((prev) => (prev === 5 ? 1 : prev + 1));
  };

  const handleMaxBet = () => {
    if (gameState !== 'IDLE') return;
    sounds.playBet();
    setBet(5);
    // Auto deal immediately on Max Bet! Standard fun casino behavior
    setTimeout(() => {
      handleDeal();
    }, 100);
  };

  // Ask the Gemini Coach for detailed card explanation
  const handleAskCoach = async () => {
    if (gameState === 'IDLE' || hand.length !== 5 || holdAnalysis.length === 0) return;

    setCoachLoading(true);
    setCoachAnalysis(null);
    sounds.playButton();

    try {
      const currentHoldsMask = gameState === 'DEALT' ? held : accuracyFeedback?.playerHoldStr ? hand.map((_, idx) => held[idx]) : held;
      const currentHoldsMaskBools = hand.map((_, idx) => held[idx]);

      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialHand: gameState === 'DEALT' ? hand : accuracyFeedback ? accuracyFeedback.playerHoldStr ? hand : hand : hand,
          heldIndices: currentHoldsMaskBools,
          optimalHold: holdAnalysis[0].holdMask,
          evList: holdAnalysis,
        }),
      });

      if (!response.ok) {
        throw new Error('Server returned error');
      }

      const data = await response.json();
      setCoachAnalysis(data.analysis);
      sounds.playWinSmall();
    } catch (e) {
      console.error(e);
      setCoachAnalysis('Sorry, the poker coach is temporarily offline. Please verify your GEMINI_API_KEY in Secrets.');
      sounds.playLose();
    } finally {
      setCoachLoading(false);
    }
  };

  // Help calculate standard session win rates
  const winRate = useMemo(() => {
    if (stats.handsPlayed === 0) return 0;
    const wins = stats.handsPlayed - stats.losses;
    return (wins / stats.handsPlayed) * 100;
  }, [stats]);

  const averageAccuracy = useMemo(() => {
    if (stats.handsPlayed === 0) return 0;
    return (stats.totalHoldAccuracy / stats.handsPlayed) * 100;
  }, [stats]);

  // Suit symbol and color map helper
  const renderSuitIcon = (suit: Suit, sizeClass = 'w-6 h-6') => {
    switch (suit) {
      case 'H':
        return <Heart className={`${sizeClass} fill-rose-500 text-rose-500`} />;
      case 'D':
        return <Diamond className={`${sizeClass} fill-rose-500 text-rose-500`} />;
      case 'C':
        return <Club className={`${sizeClass} fill-slate-300 text-slate-300`} />;
      case 'S':
        return <Spade className={`${sizeClass} fill-slate-300 text-slate-300`} />;
    }
  };

  // Render a specific card value elegantly
  const formatCardVal = (val: number) => {
    if (val === 11) return 'J';
    if (val === 12) return 'Q';
    if (val === 13) return 'K';
    if (val === 14) return 'A';
    return val.toString();
  };

  return (
    <div id="video-poker-app" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* HEADER BAR */}
      <header id="app-header" className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl shadow-lg shadow-emerald-900/20">
              <BrainCircuit className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-200 to-amber-200 bg-clip-text text-transparent">
                Aces Wild Video Poker & Trainer
              </h1>
              <p className="text-xs text-slate-400 font-mono">Real-time EV Analysis & AI Coach</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Analyzer mode toggle */}
            <button
              id="toggle-analyzer"
              onClick={() => {
                setIsAnalyzerMode(!isAnalyzerMode);
                sounds.playButton();
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isAnalyzerMode
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950'
                  : 'bg-slate-900/40 text-slate-400 border-slate-800'
              }`}
              title="Toggle real-time strategy helper while playing"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAnalyzerMode ? 'animate-pulse text-emerald-400' : ''}`} />
              <span>Realtime Help: {isAnalyzerMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* Sound Toggle */}
            <button
              id="toggle-mute"
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-900/50 text-slate-400 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT CONTAINER */}
      <main id="app-main" className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: THE GAME TERMINAL */}
        <section id="game-terminal" className="flex-1 flex flex-col gap-5">
          
          {/* THE GOLDEN PAYTABLE DISPLAY */}
          <div id="paytable-panel" className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-slate-950 px-4 py-2 text-center text-[10px] font-mono tracking-widest text-slate-500 uppercase border-b border-slate-900 flex justify-between items-center">
                <span>Aces Wild Paytable</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Coins className="w-3 h-3" /> Highlights current bet column
              </span>
            </div>
            
            <div className="grid grid-cols-6 text-center text-xs font-mono">
              {/* Header row */}
              <div className="p-2 bg-slate-950 text-slate-400 text-left pl-4 font-sans font-semibold border-b border-slate-900">Rank</div>
              {[1, 2, 3, 4, 5].map((coins) => (
                <div
                  key={coins}
                  className={`p-2 border-b border-slate-900 flex flex-col justify-center items-center font-bold transition-colors ${
                    bet === coins
                      ? 'bg-amber-500/10 text-amber-400 border-x border-amber-500/20'
                      : 'bg-slate-900/50 text-slate-500'
                  }`}
                >
                  <span className="text-[9px] uppercase font-light text-slate-500">Coin {coins}</span>
                </div>
              ))}

              {/* Paytable Rows */}
              {Object.entries(PAYTABLE).map(([rank, info]) => {
                const isSelectedRank = winningRank === rank;
                return (
                  <React.Fragment key={rank}>
                    {/* Rank label */}
                    <div
                      className={`p-2.5 text-left pl-4 border-b border-slate-900/30 transition-all ${
                        isSelectedRank
                          ? 'bg-emerald-500/20 text-emerald-200 font-bold border-l-4 border-l-emerald-500'
                          : 'text-slate-300'
                      }`}
                    >
                      {info.label}
                    </div>

                    {/* Columns 1-5 payouts */}
                    {[1, 2, 3, 4, 5].map((coins) => {
                      let payout = info.multiplier * coins;
                      if (rank === 'ROYAL_FLUSH' && coins === 5) {
                        payout = 4000; // Special Royal Flush bonus
                      }
                      const isSelectedBetCol = bet === coins;
                      return (
                        <div
                          key={coins}
                          className={`p-2.5 flex justify-center items-center border-b border-slate-900/30 transition-all ${
                            isSelectedRank && isSelectedBetCol
                              ? 'bg-emerald-500/30 text-emerald-300 font-black text-sm scale-105 shadow-md shadow-emerald-950/80 z-10'
                              : isSelectedRank
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : isSelectedBetCol
                              ? 'bg-amber-500/5 text-amber-300 border-x border-amber-500/10 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {payout}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* THE CARDS PLAYING FELT CANVAS */}
          <div id="playing-felt" className="relative flex-1 bg-gradient-to-b from-emerald-950/70 to-emerald-900/30 border border-emerald-500/20 rounded-3xl p-6 md:p-8 flex flex-col justify-center items-center gap-6 min-h-[350px] overflow-hidden shadow-inner">
            
            {/* Elegant background graphics watermark */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none" />
            <div className="absolute top-4 left-6 text-xs font-mono tracking-widest text-emerald-500/40 uppercase pointer-events-none select-none">
              Trainer Active
            </div>

            {/* WIN / LOSS GLOW OVERLAY MESSAGE */}
            <AnimatePresence>
              {currentPayoutNotice && (
                <motion.div
                  id="payout-banner"
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-8 z-20 px-6 py-2.5 rounded-full shadow-2xl border text-center"
                  style={{
                    backgroundColor: winningRank ? 'rgba(6, 78, 59, 0.9)' : 'rgba(30, 41, 59, 0.9)',
                    borderColor: winningRank ? 'rgba(52, 211, 153, 0.4)' : 'rgba(100, 116, 139, 0.4)',
                    boxShadow: winningRank ? '0 10px 25px -5px rgba(16, 185, 129, 0.3)' : '0 10px 25px -5px rgba(0,0,0,0.5)',
                  }}
                >
                  <span className={`text-base font-bold tracking-wide font-mono ${winningRank ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {currentPayoutNotice}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* THE FIVE CARDS ROW */}
            <div id="poker-cards-container" className="w-full grid grid-cols-5 gap-3 sm:gap-4 max-w-3xl relative z-10">
              {hand.length === 0 ? (
                // Deck placeholder before deal
                Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="aspect-[2/3] w-full rounded-2xl border-2 border-dashed border-emerald-800/40 bg-slate-900/40 flex flex-col justify-center items-center text-emerald-700/30"
                  >
                    <Coins className="w-8 h-8 opacity-20 stroke-[1.25]" />
                  </div>
                ))
              ) : (
                hand.map((card, idx) => {
                  const isHeld = held[idx];
                  const isRed = card.suit === 'H' || card.suit === 'D';
                  
                  // Highlight card if it's in the optimal hold recommendation (Analyzer Mode is ON)
                  const isOptimalToHold = holdAnalysis[0]?.holdMask[idx];
                  const showAnalyzerBorder = isAnalyzerMode && gameState === 'DEALT' && isOptimalToHold;

                  return (
                    <motion.div
                      key={card.id}
                      onClick={() => handleToggleHold(idx)}
                      className={`relative aspect-[2/3] w-full rounded-2xl bg-white shadow-xl select-none transition-all duration-300 flex flex-col justify-between p-3 overflow-hidden ${
                        autoPlayCount > 0
                          ? 'cursor-not-allowed opacity-90'
                          : 'cursor-pointer'
                      } ${
                        gameState === 'DEALT' && autoPlayCount === 0 ? 'hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-950/50' : ''
                      } ${
                        isHeld
                          ? 'ring-4 ring-amber-400 shadow-amber-950/40 -translate-y-1'
                          : showAnalyzerBorder
                          ? 'ring-2 ring-emerald-500/80 shadow-md shadow-emerald-500/20 ring-offset-2 ring-offset-emerald-900'
                          : 'ring-1 ring-slate-200 shadow-slate-950/20'
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Luminous Gold "HELD" badge inside the card */}
                      <AnimatePresence>
                        {isHeld && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute inset-0 bg-amber-500/10 flex items-center justify-center pointer-events-none"
                          >
                            <span className="px-2.5 py-1 bg-amber-400 text-slate-950 text-[10px] font-bold tracking-widest uppercase rounded shadow border border-amber-300">
                              Held
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Sparkle overlay badge for optimal recommendation */}
                      {showAnalyzerBorder && !isHeld && (
                        <div className="absolute top-2 right-2 flex items-center justify-center pointer-events-none">
                          <span className="p-1 bg-emerald-500/90 text-slate-950 text-[8px] font-bold uppercase rounded-full shadow-md shadow-emerald-900" title="Optimal Play Suggestion">
                            <Sparkles className="w-2.5 h-2.5 text-slate-950" />
                          </span>
                        </div>
                      )}

                      {/* Top Left Value & Suit */}
                      <div className="flex flex-col items-center">
                        <span className={`text-lg sm:text-2xl font-black font-mono leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatCardVal(card.value)}
                        </span>
                        <div className="mt-1">
                          {renderSuitIcon(card.suit, 'w-4 h-4 sm:w-5 sm:h-5')}
                        </div>
                      </div>

                      {/* Center Giant Suit Icon */}
                      <div className="flex justify-center opacity-[0.08] pointer-events-none self-center my-1">
                        {renderSuitIcon(card.suit, 'w-12 h-12 sm:w-16 sm:h-16')}
                      </div>

                      {/* Bottom Right Value & Suit rotated */}
                      <div className="flex flex-col items-center rotate-180 self-end">
                        <span className={`text-lg sm:text-2xl font-black font-mono leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatCardVal(card.value)}
                        </span>
                        <div className="mt-1">
                          {renderSuitIcon(card.suit, 'w-4 h-4 sm:w-5 sm:h-5')}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* DYNAMIC RANKING FEEDBACK */}
            {gameState === 'DEALT' && currentDealtRank && (
              <div id="realtime-hand-eval" className="text-xs font-mono bg-slate-900/60 border border-slate-800 px-4 py-1.5 rounded-full text-slate-400 max-w-xs text-center">
                Current Hand: <span className="text-emerald-400 font-bold">{currentDealtRank.label}</span>
              </div>
            )}
          </div>

          {/* LOWER CONTROLS & BET BUTTONS */}
          <div id="poker-console-controls" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            
            {/* Credits Counter Display */}
            <div className="flex items-center gap-4 bg-slate-950 border border-slate-800/80 px-5 py-3 rounded-xl min-w-[200px] justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-mono uppercase text-slate-500">Credits</span>
              </div>
              <span className="text-xl font-bold font-mono text-amber-400 tracking-wider">
                {credits.toLocaleString()}
              </span>
            </div>

            {/* Game Action Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Bet Level adjust (allowed only idle) */}
              <button
                id="btn-bet-one"
                disabled={gameState !== 'IDLE' || autoPlayCount > 0}
                onClick={handleIncreaseBet}
                className={`px-4 py-3 rounded-xl font-mono text-xs font-bold transition-all ${
                  gameState === 'IDLE' && autoPlayCount === 0
                    ? 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750'
                    : 'bg-slate-900/20 text-slate-600 border-transparent cursor-not-allowed opacity-50'
                }`}
              >
                Bet One: {bet}
              </button>

              <button
                id="btn-bet-max"
                disabled={gameState !== 'IDLE' || autoPlayCount > 0}
                onClick={handleMaxBet}
                className={`px-4 py-3 rounded-xl font-mono text-xs font-bold transition-all ${
                  gameState === 'IDLE' && autoPlayCount === 0
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-900/25'
                    : 'bg-slate-900/20 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                Max Bet
              </button>

              <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />

              {/* AUTO PLAY ACTION TRIGGER */}
              <div className="flex items-center gap-2">
                {autoPlayCount > 0 ? (
                  <button
                    id="btn-autoplay-stop"
                    onClick={() => {
                      setAutoPlayCount(0);
                      setAutoPlayPhase('IDLE');
                      sounds.playButton();
                    }}
                    className="px-4 py-3.5 bg-gradient-to-tr from-rose-600 to-rose-500 text-slate-100 font-sans font-bold text-sm tracking-widest uppercase rounded-xl hover:from-rose-500 hover:to-rose-400 shadow-lg shadow-rose-950/50 transition-all transform active:scale-95 flex items-center gap-1.5 animate-pulse"
                  >
                    <Square className="w-4 h-4 text-slate-100" />
                    <span>Stop ({autoPlayCount})</span>
                  </button>
                ) : (
                  <>
                    <button
                      id="btn-autoplay-10"
                      onClick={() => {
                        sounds.playButton();
                        setAutoPlayCount(10);
                        if (gameState === 'DEALT') {
                          setAutoPlayPhase('DEALT_WAIT_HOLD');
                        } else {
                          setAutoPlayPhase('IDLE');
                        }
                      }}
                      className="px-3.5 py-3.5 bg-gradient-to-tr from-indigo-600 to-purple-600 text-slate-100 font-sans font-bold text-xs sm:text-sm tracking-widest uppercase rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-950/50 transition-all transform active:scale-95 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 text-amber-300" />
                      <span>Auto 10</span>
                    </button>
                    <button
                      id="btn-autoplay-100"
                      onClick={() => {
                        sounds.playButton();
                        setAutoPlayCount(100);
                        if (gameState === 'DEALT') {
                          setAutoPlayPhase('DEALT_WAIT_HOLD');
                        } else {
                          setAutoPlayPhase('IDLE');
                        }
                      }}
                      className="px-3.5 py-3.5 bg-gradient-to-tr from-purple-600 to-fuchsia-600 text-slate-100 font-sans font-bold text-xs sm:text-sm tracking-widest uppercase rounded-xl hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-950/50 transition-all transform active:scale-95 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 text-amber-300 animate-pulse" />
                      <span>Auto 100</span>
                    </button>
                  </>
                )}

                <div className="flex items-center bg-slate-950/60 p-1 border border-slate-800 rounded-xl gap-1 h-[48px]">
                  <button
                    id="btn-speed-1x"
                    onClick={() => {
                      sounds.playButton();
                      setAutoPlaySpeed('1X');
                    }}
                    className={`px-2 py-1.5 font-mono text-[10px] sm:text-xs font-bold uppercase rounded-lg transition-all h-full flex items-center ${
                      autoPlaySpeed === '1X'
                        ? 'bg-slate-800 text-slate-200 border border-slate-700/50 shadow-sm'
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                    title="Normal Speed (1x)"
                  >
                    1x
                  </button>
                  <button
                    id="btn-speed-2x"
                    onClick={() => {
                      sounds.playButton();
                      setAutoPlaySpeed('2X');
                    }}
                    className={`px-2 py-1.5 font-mono text-[10px] sm:text-xs font-bold uppercase rounded-lg transition-all h-full flex items-center ${
                      autoPlaySpeed === '2X'
                        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                    title="Double Speed (2x)"
                  >
                    2x
                  </button>
                  <button
                    id="btn-speed-turbo"
                    onClick={() => {
                      sounds.playButton();
                      setAutoPlaySpeed('TURBO');
                    }}
                    className={`px-2 py-1.5 font-mono text-[10px] sm:text-xs font-bold uppercase rounded-lg transition-all h-full flex items-center gap-1 ${
                      autoPlaySpeed === 'TURBO'
                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400 font-black shadow-sm'
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                    title="Turbo Speed (Plays Very Fast)"
                  >
                    <Zap className={`w-3 h-3 ${autoPlaySpeed === 'TURBO' ? 'text-rose-400 fill-rose-400/50 animate-bounce' : 'text-slate-500'}`} />
                    <span>Turbo</span>
                  </button>
                </div>
              </div>

              <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />

              {/* DEAL / DRAW ACTION TRIGGER */}
              <div className="flex items-center gap-2">
                {gameState === 'IDLE' || gameState === 'GAMEOVER' ? (
                  <>
                    <button
                      id="btn-wizard"
                      disabled={true}
                      className="px-6 py-3.5 bg-slate-800 border border-slate-700 text-slate-500 font-sans font-bold text-sm tracking-widest uppercase rounded-xl cursor-not-allowed opacity-50 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-slate-600" />
                      <span>Wizard</span>
                    </button>
                    <button
                      id="btn-deal"
                      disabled={autoPlayCount > 0}
                      onClick={handleDeal}
                      className={`px-8 py-3.5 font-sans font-bold text-sm tracking-widest uppercase rounded-xl transition-all transform active:scale-95 ${
                        autoPlayCount > 0
                          ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-tr from-emerald-600 to-emerald-500 text-slate-950 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-950/50'
                      }`}
                    >
                      Deal
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      id="btn-wizard"
                      disabled={autoPlayCount > 0}
                      onClick={handleWizardHold}
                      className={`px-6 py-3.5 font-sans font-bold text-sm tracking-widest uppercase rounded-xl transition-all transform active:scale-95 flex items-center gap-1.5 ${
                        autoPlayCount > 0
                          ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-tr from-purple-600 to-indigo-500 text-slate-100 hover:from-purple-500 hover:to-indigo-400 shadow-lg shadow-indigo-950/50'
                      }`}
                    >
                      <Sparkles className={`w-4 h-4 ${autoPlayCount > 0 ? 'text-slate-600' : 'text-amber-300 animate-pulse'}`} />
                      <span>Wizard</span>
                    </button>
                    <button
                      id="btn-draw"
                      disabled={autoPlayCount > 0}
                      onClick={handleDraw}
                      className={`px-8 py-3.5 font-sans font-bold text-sm tracking-widest uppercase rounded-xl transition-all transform active:scale-95 ${
                        autoPlayCount > 0
                          ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 hover:from-amber-400 hover:to-amber-300 shadow-lg shadow-amber-950/50'
                      }`}
                    >
                      Draw
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* DYNAMIC FEEDBACK BANNER AFTER DISCARD / DRAW */}
          {gameState === 'GAMEOVER' && accuracyFeedback && (
            <motion.div
              id="gameover-trainer-feedback"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl ${
                accuracyFeedback.isPerfect
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {accuracyFeedback.isPerfect ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-amber-400 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {accuracyFeedback.isPerfect
                      ? 'Perfect Hold Selected!'
                      : 'Suboptimal Hold Played'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {accuracyFeedback.isPerfect
                      ? 'You selected the exact mathematical optimal cards.'
                      : `Hold accuracy: ${(accuracyFeedback.accuracy * 100).toFixed(1)}%. You held [${accuracyFeedback.playerHoldStr}] (EV: ${accuracyFeedback.playedEv.toFixed(3)}) instead of [${accuracyFeedback.optimalHoldStr}] (EV: ${accuracyFeedback.optimalEv.toFixed(3)}).`}
                  </p>
                </div>
              </div>
              <button
                id="ask-coach-gameover"
                onClick={handleAskCoach}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
                <span>Explain Decision</span>
              </button>
            </motion.div>
          )}

        </section>

        {/* RIGHT COLUMN: TRAINER DASHBOARD & AI COACH BENTO */}
        <section id="trainer-sidebar" className="w-full lg:w-[400px] flex flex-col gap-5 shrink-0">
          
          {/* STATS SUMMARY BOX */}
          <div id="stats-dashboard" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight">Trainer Statistics</h3>
              </div>
              <button
                id="reset-stats-btn"
                onClick={handleResetStats}
                className="text-[10px] font-mono text-rose-400 hover:text-rose-300 border border-rose-950 bg-rose-950/10 px-2 py-1 rounded"
              >
                Reset Stats
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-500">Played</span>
                <span className="text-lg font-bold font-mono mt-1 text-slate-200">{stats.handsPlayed}</span>
              </div>
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-500">Win Rate</span>
                <span className="text-lg font-bold font-mono mt-1 text-emerald-400">{winRate.toFixed(1)}%</span>
              </div>
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-500">Perfect Holds</span>
                <span className="text-lg font-bold font-mono mt-1 text-amber-400">
                  {stats.perfectHoldCount} <span className="text-xs text-slate-500">/ {stats.handsPlayed}</span>
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-500">Avg Accuracy</span>
                <span className="text-lg font-bold font-mono mt-1 text-teal-400">{averageAccuracy.toFixed(1)}%</span>
              </div>
            </div>

            {/* Quick collapsible hand frequencies list */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 text-xs font-mono">
              <span className="text-[10px] uppercase text-slate-500 tracking-wider font-semibold block mb-2 border-b border-slate-900 pb-1.5">
                Hit Frequencies
              </span>
              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Natural Royal:</span> <span className="text-amber-400">{stats.royalFlushes || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>4 Wild Aces:</span> <span className="text-emerald-400">{stats.fourWildAces || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wild Royal:</span> <span className="text-indigo-400">{stats.wildRoyalFlushes || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>5 of a Kind:</span> <span className="text-teal-400">{stats.fiveOfAKinds || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Straight Flush:</span> <span>{stats.straightFlushes || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>4 of a Kind:</span> <span>{stats.fourOfAKinds || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Full House:</span> <span>{stats.fullHouses || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Flush:</span> <span>{stats.flushes || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Straight:</span> <span>{stats.straights || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>3 of a Kind:</span> <span>{stats.threeOfAKinds || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* REAL-TIME OPTIMAL DECISIONS SOLVER PANEL */}
          <div id="strategy-solver" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight">Optimal Strategy Solver</h3>
              </div>
              <span className="text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded-full uppercase">
                Optimal Strategy
              </span>
            </div>

            {hand.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <BrainCircuit className="w-10 h-10 text-slate-700 mb-2 stroke-[1.25]" />
                <p className="text-xs">Deal a hand to view the exact real-time mathematical expected value holds.</p>
              </div>
            ) : !isAnalyzerMode && gameState === 'DEALT' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <BrainCircuit className="w-10 h-10 text-emerald-600 mb-2 stroke-[1.25] animate-pulse" />
                <h4 className="text-xs font-bold text-slate-300">Test Mode Active</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[250px]">
                  Analyzer Mode is currently hidden. Play your cards! The strategy breakdowns and accuracy details will be shown after you draw.
                </p>
                <button
                  id="reveal-strategy-mid"
                  onClick={() => {
                    setIsAnalyzerMode(true);
                    sounds.playButton();
                  }}
                  className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] font-bold tracking-wider rounded-lg border border-slate-700"
                >
                  Show Real-time Strategy
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[320px] pr-1">
                <div className="text-[10px] font-mono text-slate-500 flex justify-between border-b border-slate-800 pb-1">
                  <span>Cards to Hold</span>
                  <span>Expected Return (EV)</span>
                </div>

                {holdAnalysis.slice(0, 5).map((item, i) => {
                  const heldCards = hand.filter((_, idx) => item.holdMask[idx]);
                  const holdsStr = heldCards.length > 0 ? heldCards.map(formatCardName).join(' ') : 'Discard All';
                  const isChoiceOptimal = i === 0;

                  // Check if this row matches the user's currently active toggle choices
                  const isCurrentChoice = held.every((v, idx) => v === item.holdMask[idx]);

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (gameState === 'DEALT' && autoPlayCount === 0) {
                          sounds.playCardHold();
                          setHeld([...item.holdMask]);
                        }
                      }}
                      className={`p-2.5 rounded-xl border transition-all text-xs flex justify-between items-center ${
                        autoPlayCount > 0
                          ? 'cursor-not-allowed opacity-65'
                          : 'cursor-pointer hover:border-slate-700'
                      } ${
                        isCurrentChoice
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-slate-950 border-slate-850'
                      }`}
                    >
                      <div className="flex flex-col gap-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold font-mono tracking-wide text-slate-100">
                            {holdsStr}
                          </span>
                          {isChoiceOptimal && (
                            <span className="bg-emerald-500/15 text-emerald-400 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Sparkles className="w-2 h-2 text-emerald-400" /> Optimal
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">
                          {item.handRankName}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono font-bold text-sm ${isChoiceOptimal ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {item.expectedValue.toFixed(4)}
                        </span>
                        <span className="text-[8px] text-slate-500 block font-mono">credits</span>
                      </div>
                    </div>
                  );
                })}

                <div className="text-[10px] text-slate-500 font-mono italic text-center mt-2">
                  Click any hold strategy row above to apply holds.
                </div>
              </div>
            )}
          </div>

          {/* AI COACH / POKER TUTOR PANEL */}
          <div id="ai-coach-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight">AI Poker Coach</h3>
              </div>
              {hand.length > 0 && !coachLoading && !coachAnalysis && (
                <button
                  id="ask-coach-header"
                  onClick={handleAskCoach}
                  className="text-xs bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 px-3 py-1 rounded-lg font-bold flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3" /> Ask Coach
                </button>
              )}
            </div>

            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 min-h-[140px] flex flex-col justify-center">
              {coachLoading ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                  <p className="text-xs text-slate-400 mt-3 font-mono animate-pulse">Analyzing cards & EV tables...</p>
                </div>
              ) : coachAnalysis ? (
                <div className="text-xs leading-relaxed space-y-2 text-slate-300 whitespace-pre-line text-left">
                  {coachAnalysis}
                </div>
              ) : (
                <div className="text-center py-4 flex flex-col items-center">
                  <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
                  <h4 className="text-xs font-bold text-slate-400">Want strategy tips?</h4>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[240px]">
                    Press "Ask Coach" to receive mathematical strategy breakdowns and advice from the Gemini AI Poker Coach.
                  </p>
                  {hand.length > 0 && (
                    <button
                      id="btn-ask-coach-prompt"
                      onClick={handleAskCoach}
                      className="mt-3 px-4 py-2 bg-slate-900 hover:bg-slate-850 text-emerald-400 border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <BrainCircuit className="w-3.5 h-3.5" /> Explain Current Hand
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

        </section>

      </main>

      {/* FOOTER BAR */}
      <footer id="app-footer" className="mt-auto border-t border-slate-900 bg-slate-950 px-4 py-4 text-center">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>
            <span>Aces Wild rules. Aces are completely wild. High cards alone do not pay. Lowest winning hand is 3 of a Kind.</span>
          </div>
          <div className="flex gap-4">
            <span className="text-emerald-500">Zero-latency EV Solver</span>
            <span>Local Game Persistence Active</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
