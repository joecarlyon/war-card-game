import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, FastForward, RotateCcw, Trophy, Swords, ScrollText, SkipForward } from 'lucide-react';
import { Card as CardType, GameState, PlayerConfig, WarEvent } from './types';
import { createDeck, shuffleDeck, dealCards } from './services/deck';
import { generateBattleReport } from './services/geminiService';
import Card from './components/Card';

// Speed constants in ms
const SPEEDS = {
  SLOW: 1500,
  NORMAL: 800,
  FAST: 200,
  INSTANT: 0, // Special handling
};

const getWarLabel = (depth: number) => {
  if (depth <= 1) return 'WAR!';
  if (depth === 2) return 'DOUBLE WAR!';
  if (depth === 3) return 'TRIPLE WAR!';
  if (depth === 4) return 'QUADRUPLE WAR!';
  return 'MEGA WAR!';
};

const getFullRankName = (rank: string) => {
  switch (rank) {
    case 'J': return 'Jack';
    case 'Q': return 'Queen';
    case 'K': return 'King';
    case 'A': return 'Ace';
    default: return rank;
  }
};

const formatCard = (c: CardType) => `${getFullRankName(c.rank)}${c.suit}`;

// Pure logic function for processing a single turn
const processTurn = (prevState: GameState, config: PlayerConfig): GameState => {
  // 1. Check if game is already finished or decks empty (Win Condition)
  if (prevState.status === 'finished') return prevState;
  
  if (prevState.playerDeck.length === 0) {
      return { ...prevState, status: 'finished', logs: [...prevState.logs, `Game Over! ${config.opponentName} wins!`] };
  }
  if (prevState.computerDeck.length === 0) {
      return { ...prevState, status: 'finished', logs: [...prevState.logs, `Game Over! ${config.name} wins!`] };
  }

  // 2. Determine move based on War Mode
  let newPlayerDeck = [...prevState.playerDeck];
  let newComputerDeck = [...prevState.computerDeck];
  let newPot = [...prevState.pot];
  let pCard: CardType | null = null;
  let cCard: CardType | null = null;
  
  let isWar = prevState.warMode;
  let warDepth = prevState.warDepth;
  
  // Logic for drawing cards
  if (isWar) {
    // In a war, we need to pop usually 2 cards: one face down (burn), one face up (battle)
    // Check if players have enough cards
    if (newPlayerDeck.length < 2 || newComputerDeck.length < 2) {
        // Not enough cards to finish the war. Usually, the person who runs out loses.
        if (newPlayerDeck.length < 2 && newComputerDeck.length >= 2) return { ...prevState, status: 'finished', logs: [...prevState.logs, `${config.name} ran out of reinforcements during WAR!`], playerDeck: [], computerDeck: [...newComputerDeck, ...newPlayerDeck, ...newPot] }; // Player loses
        if (newComputerDeck.length < 2 && newPlayerDeck.length >= 2) return { ...prevState, status: 'finished', logs: [...prevState.logs, `${config.opponentName} ran out of reinforcements during WAR!`], computerDeck: [], playerDeck: [...newPlayerDeck, ...newComputerDeck, ...newPot] }; // Computer loses
        // Both out? Draw
        if (newPlayerDeck.length < 2 && newComputerDeck.length < 2) return { ...prevState, status: 'finished', logs: [...prevState.logs, `Both armies annihilated during WAR! It's a draw.`] };
    }

    // Burn one
    const pBurn = newPlayerDeck.shift()!;
    const cBurn = newComputerDeck.shift()!;
    newPot.push(pBurn, cBurn);
    
    // Play one active
    pCard = newPlayerDeck.shift()!;
    cCard = newComputerDeck.shift()!;
    warDepth += 1; // Increase war depth
  } else {
    // Normal turn
    pCard = newPlayerDeck.shift()!;
    cCard = newComputerDeck.shift()!;
  }

  // Add active cards to pot (temporarily for calculation, they stay visual as 'active' until resolved)
  
  const pVal = pCard.value;
  const cVal = cCard.value;
  
  let nextStatus: GameState['status'] = 'playing';
  let nextWarMode = false;
  let nextLastWinner = prevState.lastWinner;
  let nextLogs = [...prevState.logs];
  let nextWarHistory = [...prevState.warHistory];
  let nextWarDepth = 0;

  // Compare
  if (pVal > cVal) {
    // Player wins
    const spoils = [...newPot, pCard, cCard];
    
    // Identify spoils vs risked
    // Even indices in spoils = Player origin, Odd = Computer origin
    const captured = spoils.filter((_, i) => i % 2 !== 0);
    const risked = spoils.filter((_, i) => i % 2 === 0);
    
    newPlayerDeck.push(...spoils); // Add to bottom
    
    let log = `${config.name} wins with ${getFullRankName(pCard.rank)} vs ${getFullRankName(cCard.rank)}.`;
    if (isWar) {
        log += `\nSpoils of Victory: ${captured.map(formatCard).join(', ')}`;
        log += `\nRisked & Recovered: ${risked.map(formatCard).join(', ')}`;
    } else {
        log += ` Won: ${captured.map(formatCard).join(', ')}, ${risked.map(formatCard).join(', ')}`;
    }
    nextLogs.push(log);
    
    nextLastWinner = 'player';
    
    // Record war if it was one
    if (isWar) {
         const typeStr = warDepth === 1 ? 'Single' : warDepth === 2 ? 'Double' : warDepth === 3 ? 'Triple' : 'Mega';
         nextWarHistory.push({
             turn: prevState.turnCount + 1,
             type: typeStr as any,
             winner: config.name,
             spoilsCount: spoils.length
         });
         nextLogs.push(`WAR RESOLVED! ${config.name} wins the ${typeStr} War!`);
    }
    
    newPot = []; // Clear pot
  } else if (cVal > pVal) {
    // Computer wins
    const spoils = [...newPot, pCard, cCard];
    
    // Even indices in spoils = Player origin, Odd = Computer origin
    const captured = spoils.filter((_, i) => i % 2 === 0);
    const risked = spoils.filter((_, i) => i % 2 !== 0);

    newComputerDeck.push(...spoils);
    
    let log = `${config.opponentName} wins with ${getFullRankName(cCard.rank)} vs ${getFullRankName(pCard.rank)}.`;
    if (isWar) {
        log += `\nSpoils of Victory: ${captured.map(formatCard).join(', ')}`;
        log += `\nRisked & Recovered: ${risked.map(formatCard).join(', ')}`;
    } else {
        log += ` Won: ${captured.map(formatCard).join(', ')}, ${risked.map(formatCard).join(', ')}`;
    }
    nextLogs.push(log);
    
    nextLastWinner = 'computer';

    if (isWar) {
        const typeStr = warDepth === 1 ? 'Single' : warDepth === 2 ? 'Double' : warDepth === 3 ? 'Triple' : 'Mega';
        nextWarHistory.push({
            turn: prevState.turnCount + 1,
            type: typeStr as any,
            winner: config.opponentName,
            spoilsCount: spoils.length
        });
        nextLogs.push(`WAR RESOLVED! ${config.opponentName} wins the ${typeStr} War!`);
   }

    newPot = [];
  } else {
    // Tie - WAR!
    nextWarMode = true;
    nextWarDepth = isWar ? warDepth : 0; // Keep depth if already in war, otherwise 0 (will increment next turn)
    newPot.push(pCard, cCard); // Move active cards to pot
    nextLogs.push(`TIE! ${getFullRankName(pCard.rank)} vs ${getFullRankName(cCard.rank)}. PREPARE FOR WAR!`);
    nextStatus = 'playing';
  }

  return {
    ...prevState,
    status: nextStatus,
    turnCount: prevState.turnCount + 1,
    playerDeck: newPlayerDeck,
    computerDeck: newComputerDeck,
    playerActiveCard: pCard,
    computerActiveCard: cCard,
    pot: newPot,
    warMode: nextWarMode,
    warDepth: nextWarDepth,
    lastWinner: nextLastWinner,
    logs: nextLogs,
    warHistory: nextWarHistory,
  };
};

const App: React.FC = () => {
  // --- Config State ---
  const [config, setConfig] = useState<PlayerConfig>({ name: '', opponentName: 'The General' });
  const [isConfigured, setIsConfigured] = useState(false);

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    turnCount: 0,
    playerDeck: [],
    computerDeck: [],
    playerActiveCard: null,
    computerActiveCard: null,
    pot: [],
    warMode: false,
    warDepth: 0,
    lastWinner: null,
    warHistory: [],
    logs: [],
  });

  const [simulationSpeed, setSimulationSpeed] = useState<number>(SPEEDS.NORMAL);
  const [battleReport, setBattleReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Scroll logs
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.logs]);

  // --- Logic Helpers ---

  const initializeGame = () => {
    const fullDeck = shuffleDeck(createDeck());
    const [p1, p2] = dealCards(fullDeck);
    setGameState({
      status: 'idle',
      turnCount: 0,
      playerDeck: p1,
      computerDeck: p2,
      playerActiveCard: null,
      computerActiveCard: null,
      pot: [],
      warMode: false,
      warDepth: 0,
      lastWinner: null,
      warHistory: [],
      logs: ['Game initialized. Decks shuffled and dealt.'],
    });
    setBattleReport(null);
  };

  const resolveRound = useCallback(() => {
    setGameState(prev => processTurn(prev, config));
  }, [config]);

  const jumpToEnd = useCallback(() => {
    // Clear interval if running
    if (loopRef.current) {
        clearInterval(loopRef.current);
        loopRef.current = null;
    }

    setGameState(prev => {
        let currentState = { ...prev, status: 'playing' as const };
        let safetyCounter = 0;
        const MAX_TURNS = 5000;

        // Start processing loops
        while (currentState.status === 'playing' && safetyCounter < MAX_TURNS) {
            currentState = processTurn(currentState, config);
            safetyCounter++;
        }

        // Handle limits or finish
        if (safetyCounter >= MAX_TURNS && currentState.status === 'playing') {
             return {
                 ...currentState,
                 status: 'finished',
                 logs: [...currentState.logs.slice(-50), `[System] Max turns (${MAX_TURNS}) reached. Game ended to prevent infinite stalemate.`]
             };
        }
        
        // Optimizing logs for the jump: only keep the last 100 entries to preserve memory
        const meaningfulLogs = currentState.logs.length > 100 
            ? ['... (previous turns skipped for brevity) ...', ...currentState.logs.slice(-100)] 
            : currentState.logs;

        return {
            ...currentState,
            logs: meaningfulLogs
        };
    });
  }, [config]);

  // --- Game Loop ---
  
  // Ref to hold the interval ID
  const loopRef = useRef<number | null>(null);

  const startLoop = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    
    // For instant speed, we still use a small interval to allow UI updates unless user clicked Jump To End
    const effectiveSpeed = simulationSpeed === SPEEDS.INSTANT ? 5 : simulationSpeed;

    loopRef.current = window.setInterval(() => {
      resolveRound();
    }, effectiveSpeed);
  }, [resolveRound, simulationSpeed]);

  const stopLoop = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gameState.status === 'playing') {
      startLoop();
    } else {
      stopLoop();
    }
    return () => stopLoop();
  }, [gameState.status, startLoop, stopLoop]);

  // --- Handlers ---

  const handleStartGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.name.trim()) return;
    setIsConfigured(true);
    initializeGame();
  };

  const togglePlayPause = () => {
    setGameState(prev => ({
      ...prev,
      status: prev.status === 'playing' ? 'paused' : 'playing'
    }));
  };

  const handleGenerateReport = async () => {
    if (gameState.status !== 'finished') return;
    setIsGeneratingReport(true);
    
    const winner = gameState.playerDeck.length > 0 ? config.name : config.opponentName;
    const loser = gameState.playerDeck.length > 0 ? config.opponentName : config.name;
    const winnerScore = Math.max(gameState.playerDeck.length, gameState.computerDeck.length);
    const loserScore = Math.min(gameState.playerDeck.length, gameState.computerDeck.length);

    const report = await generateBattleReport(
      winner,
      loser,
      gameState.turnCount,
      gameState.warHistory,
      { winner: winnerScore, loser: loserScore }
    );
    
    setBattleReport(report);
    setIsGeneratingReport(false);
  };

  // --- Render Sections ---

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-wood.png')] opacity-30"></div>
        <div className="z-10 bg-stone-800 p-8 rounded-xl shadow-2xl border border-stone-600 max-w-md w-full">
           <div className="text-center mb-8">
             <h1 className="text-4xl font-bold text-amber-500 mb-2 brand-font tracking-wider">WAR</h1>
             <p className="text-stone-400 text-sm">The Classic Game of Attrition</p>
           </div>
           
           <form onSubmit={handleStartGame} className="space-y-6">
             <div>
               <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Your Name</label>
               <input 
                 type="text" 
                 value={config.name}
                 onChange={(e) => setConfig({...config, name: e.target.value})}
                 className="w-full bg-stone-900 border border-stone-700 rounded px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                 placeholder="Enter Commander Name"
                 autoFocus
               />
             </div>
             
             <div>
               <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Opponent</label>
               <input 
                 type="text" 
                 value={config.opponentName}
                 onChange={(e) => setConfig({...config, opponentName: e.target.value})}
                 className="w-full bg-stone-900 border border-stone-700 rounded px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
               />
             </div>
             
             <button 
                type="submit"
                disabled={!config.name.trim()}
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
             >
                <Swords size={20} /> DECLARE WAR
             </button>
           </form>
        </div>
      </div>
    );
  }

  const pPercent = (gameState.playerDeck.length / 52) * 100;
  const cPercent = (gameState.computerDeck.length / 52) * 100;

  return (
    <div className="h-screen bg-stone-900 flex flex-col relative overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/p6.png')] opacity-10 pointer-events-none"></div>

      {/* Header / Stats Bar */}
      <header className="bg-stone-950 border-b border-stone-800 p-4 z-20 flex justify-between items-center shadow-md shrink-0">
         <div className="flex items-center gap-4">
            <h2 className="text-xl text-amber-500 brand-font font-bold">WAR</h2>
            <div className="h-6 w-px bg-stone-700"></div>
            <div className="text-stone-400 text-sm">Turn: <span className="text-white font-mono">{gameState.turnCount}</span></div>
            <div className="text-stone-400 text-sm">Wars: <span className="text-red-400 font-mono">{gameState.warHistory.length}</span></div>
         </div>

         <div className="flex items-center gap-4">
             <button onClick={() => setSimulationSpeed(SPEEDS.SLOW)} className={`p-2 rounded ${simulationSpeed === SPEEDS.SLOW ? 'bg-amber-600 text-white' : 'text-stone-500 hover:text-white'}`} title="Slow"><Play size={16} /></button>
             <button onClick={() => setSimulationSpeed(SPEEDS.NORMAL)} className={`p-2 rounded ${simulationSpeed === SPEEDS.NORMAL ? 'bg-amber-600 text-white' : 'text-stone-500 hover:text-white'}`} title="Normal"><FastForward size={16} /></button>
             <button onClick={() => setSimulationSpeed(SPEEDS.FAST)} className={`p-2 rounded ${simulationSpeed === SPEEDS.FAST ? 'bg-amber-600 text-white' : 'text-stone-500 hover:text-white'}`} title="Fast"><FastForward size={16} fill="currentColor" /></button>
         </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col md:flex-row z-10 overflow-hidden">
        
        {/* Left: Logs */}
        <aside className="w-full md:w-80 bg-stone-950/80 border-r border-stone-800 flex flex-col text-xs font-mono h-48 md:h-full order-3 md:order-1 shrink-0">
          <div className="p-2 bg-stone-900 border-b border-stone-800 text-stone-500 uppercase tracking-wider text-[10px] font-bold shrink-0">Battle Log</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {gameState.logs.map((log, i) => (
              <div key={i} className={`whitespace-pre-wrap ${log.includes('WAR') ? 'text-red-400 font-bold' : log.includes('wins') ? 'text-green-400/80' : 'text-stone-400'}`}>
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </aside>

        {/* Center: Table */}
        <section className="flex-1 bg-[#2d4a3e] relative flex flex-col justify-between p-4 order-1 md:order-2 shadow-inner shadow-black overflow-hidden">
           {/* Center Decoration */}
           <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <div className="w-64 h-64 border-4 border-white/20 rounded-full flex items-center justify-center">
                 <Swords size={100} className="text-white" />
              </div>
           </div>

           {/* Opponent Area (Top) */}
           <div className="flex flex-col items-center">
             <div className="mb-2 flex items-center gap-2">
                <span className="font-bold text-stone-300">{config.opponentName}</span>
                <span className="bg-stone-800 text-stone-400 px-2 py-0.5 rounded text-xs font-mono">{gameState.computerDeck.length}</span>
             </div>
             <div className="relative">
                {gameState.computerDeck.length > 0 && (
                     <div className="relative">
                         {/* Deck Stack Effect */}
                         {gameState.computerDeck.length > 1 && <div className="absolute top-1 left-1 w-24 h-36 bg-blue-900 rounded-lg border border-white/10 opacity-50"></div>}
                         {gameState.computerDeck.length > 2 && <div className="absolute top-2 left-2 w-24 h-36 bg-blue-900 rounded-lg border border-white/10 opacity-30"></div>}
                         <Card card={null} hidden className="relative z-10" />
                     </div>
                )}
                {gameState.computerDeck.length === 0 && <div className="w-24 h-36 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center text-white/20">Empty</div>}
             </div>
           </div>

           {/* Battle Area (Middle) */}
           <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
              
              {gameState.warMode && (
                  <div className="mb-4 animate-pulse">
                      <span className="bg-red-600 text-white px-4 py-1 rounded-full text-sm font-bold tracking-widest shadow-lg shadow-red-900/50">
                        {getWarLabel(gameState.warDepth)}
                      </span>
                  </div>
              )}

              <div className="flex items-center gap-8 md:gap-16">
                 {/* Opponent Active */}
                 <div className="relative">
                    <Card card={gameState.computerActiveCard} />
                    {gameState.status === 'playing' && gameState.computerActiveCard && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-white/50 text-xs font-bold uppercase tracking-widest">VS</div>
                    )}
                 </div>
                 
                 {/* Player Active */}
                 <div className="relative">
                    <Card card={gameState.playerActiveCard} />
                 </div>
              </div>

              {/* Pot Display */}
              {gameState.pot.length > 0 && (
                  <div className="mt-8 text-center">
                      <div className="text-xs text-amber-400/80 mb-1 uppercase tracking-widest font-semibold">Spoils of War</div>
                      <div className="h-2 w-32 bg-black/30 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500/50" style={{ width: '100%' }}></div>
                      </div>
                      <div className="mt-1 text-xs text-white/60">{gameState.pot.length} cards at stake</div>
                  </div>
              )}
           </div>

           {/* Player Area (Bottom) */}
           <div className="flex flex-col items-center">
             <div className="relative mb-2">
                {gameState.playerDeck.length > 0 && (
                     <div className="relative">
                         {gameState.playerDeck.length > 1 && <div className="absolute top-1 left-1 w-24 h-36 bg-blue-900 rounded-lg border border-white/10 opacity-50"></div>}
                         {gameState.playerDeck.length > 2 && <div className="absolute top-2 left-2 w-24 h-36 bg-blue-900 rounded-lg border border-white/10 opacity-30"></div>}
                         <Card card={null} hidden className="relative z-10" />
                     </div>
                )}
                 {gameState.playerDeck.length === 0 && <div className="w-24 h-36 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center text-white/20">Empty</div>}
             </div>
             <div className="flex items-center gap-2">
                <span className="font-bold text-amber-500">{config.name}</span>
                <span className="bg-stone-800 text-stone-400 px-2 py-0.5 rounded text-xs font-mono">{gameState.playerDeck.length}</span>
             </div>
           </div>

           {/* Progress Bars */}
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-stone-900 flex flex-col">
              <div className="bg-amber-600 transition-all duration-300" style={{ height: `${pPercent}%`, marginTop: 'auto' }}></div>
              <div className="bg-red-900 transition-all duration-300" style={{ height: `${cPercent}%` }}></div>
           </div>
        </section>

        {/* Right: Stats/Controls (Mobile: below log, Desktop: Right) */}
        <aside className="w-full md:w-64 bg-stone-900 border-l border-stone-800 p-6 flex flex-col gap-6 order-2 md:order-3 overflow-y-auto md:h-full">
            <div>
                <h3 className="text-stone-500 uppercase text-xs font-bold tracking-wider mb-4">Controls</h3>
                <button 
                  onClick={togglePlayPause} 
                  disabled={gameState.status === 'finished'}
                  className={`w-full disabled:opacity-50 text-white font-semibold py-3 rounded flex items-center justify-center gap-2 mb-2 transition-colors ${gameState.status === 'playing' ? 'bg-stone-800 hover:bg-stone-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {gameState.status === 'playing' 
                      ? <><Pause size={18} /> PAUSE</> 
                      : gameState.status === 'idle'
                        ? <><Play size={18} /> START</>
                        : <><Play size={18} /> RESUME</>
                    }
                </button>
                <button 
                  onClick={jumpToEnd} 
                  disabled={gameState.status === 'finished'}
                  className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 rounded flex items-center justify-center gap-2 mb-2 transition-colors border border-amber-600"
                >
                    <SkipForward size={18} /> JUMP TO END
                </button>
                <button 
                  onClick={initializeGame} 
                  className="w-full border border-stone-700 hover:bg-stone-800 text-stone-400 hover:text-white py-2 rounded flex items-center justify-center gap-2 text-sm transition-colors"
                >
                    <RotateCcw size={16} /> RESTART
                </button>
            </div>

            <div className="flex-1">
                <h3 className="text-stone-500 uppercase text-xs font-bold tracking-wider mb-4">War Room Stats</h3>
                <div className="space-y-4">
                    <div className="bg-stone-950 p-3 rounded border border-stone-800">
                        <div className="text-xs text-stone-500 mb-1">Double Wars</div>
                        <div className="text-xl font-mono text-white">{gameState.warHistory.filter(w => w.type === 'Double').length}</div>
                    </div>
                    <div className="bg-stone-950 p-3 rounded border border-stone-800">
                        <div className="text-xs text-stone-500 mb-1">Triple+ Wars</div>
                        <div className="text-xl font-mono text-amber-500">{gameState.warHistory.filter(w => w.type === 'Triple' || w.type === 'Quadruple' || w.type === 'Mega').length}</div>
                    </div>
                    <div className="bg-stone-950 p-3 rounded border border-stone-800">
                        <div className="text-xs text-stone-500 mb-1">Largest Spoils</div>
                        <div className="text-xl font-mono text-green-400">
                            {gameState.warHistory.length > 0 
                              ? Math.max(...gameState.warHistory.map(w => w.spoilsCount)) 
                              : 0} cards
                        </div>
                    </div>
                </div>
            </div>
        </aside>
      </main>

      {/* Game Over Modal */}
      {gameState.status === 'finished' && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
                <div className="bg-stone-950 p-6 border-b border-stone-800 text-center">
                    <h2 className="text-3xl font-bold text-amber-500 brand-font mb-2">WAR IS OVER</h2>
                    <p className="text-stone-400">
                        Winner: <span className="text-white font-bold">{gameState.playerDeck.length > 0 ? config.name : config.opponentName}</span>
                    </p>
                </div>
                
                <div className="p-8 overflow-y-auto">
                    {!battleReport ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Trophy size={64} className="text-amber-500 mb-6" />
                            <p className="text-stone-300 mb-8 max-w-md">
                                The dust has settled. {gameState.turnCount} turns were played. {gameState.warHistory.length} conflicts were resolved.
                            </p>
                            <button 
                                onClick={handleGenerateReport}
                                disabled={isGeneratingReport}
                                className="bg-amber-600 hover:bg-amber-700 disabled:bg-stone-700 text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-all transform hover:scale-105"
                            >
                                {isGeneratingReport ? (
                                    <>Processing Intelligence...</>
                                ) : (
                                    <><ScrollText size={20} /> Generate War Correspondent Report</>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="prose prose-invert max-w-none">
                            <h3 className="text-amber-500 font-serif text-xl border-b border-stone-700 pb-2 mb-4">The Daily Frontline</h3>
                            <div className="text-stone-300 font-serif leading-relaxed whitespace-pre-wrap">
                                {battleReport}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-stone-950 p-4 border-t border-stone-800 flex justify-end gap-4">
                    <button 
                        onClick={initializeGame}
                        className="text-stone-400 hover:text-white font-semibold transition-colors"
                    >
                        Rematch
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;