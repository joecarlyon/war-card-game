export enum Suit {
  Hearts = '♥',
  Diamonds = '♦',
  Clubs = '♣',
  Spades = '♠'
}

export enum Rank {
  Two = '2', Three = '3', Four = '4', Five = '5', Six = '6', Seven = '7',
  Eight = '8', Nine = '9', Ten = '10', Jack = 'J', Queen = 'Q', King = 'K', Ace = 'A'
}

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // 2-14
  id: string; // Unique ID for React keys
}

export interface WarEvent {
  turn: number;
  type: 'Single' | 'Double' | 'Triple' | 'Quadruple' | 'Mega';
  winner: string;
  spoilsCount: number;
}

export interface GameState {
  status: 'idle' | 'playing' | 'paused' | 'finished';
  turnCount: number;
  playerDeck: Card[];
  computerDeck: Card[];
  playerActiveCard: Card | null;
  computerActiveCard: Card | null;
  pot: Card[]; // Cards currently at stake (including burned cards)
  warMode: boolean; // Are we currently resolving a war?
  warDepth: number; // 0 = no war, 1 = single war, 2 = double, etc.
  lastWinner: string | null;
  warHistory: WarEvent[];
  logs: string[];
}

export interface PlayerConfig {
  name: string;
  opponentName: string;
}