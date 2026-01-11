import { Card, Rank, Suit } from '../types';

export const createDeck = (): Card[] => {
  const suits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
  const ranks = Object.values(Rank);
  // Map ranks to values 2-14
  const getValue = (rank: Rank): number => {
    switch (rank) {
      case Rank.Two: return 2;
      case Rank.Three: return 3;
      case Rank.Four: return 4;
      case Rank.Five: return 5;
      case Rank.Six: return 6;
      case Rank.Seven: return 7;
      case Rank.Eight: return 8;
      case Rank.Nine: return 9;
      case Rank.Ten: return 10;
      case Rank.Jack: return 11;
      case Rank.Queen: return 12;
      case Rank.King: return 13;
      case Rank.Ace: return 14;
      default: return 0;
    }
  };

  const deck: Card[] = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({
        suit,
        rank,
        value: getValue(rank),
        id: `${rank}-${suit}-${Math.random().toString(36).substring(2, 11)}`
      });
    });
  });
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const dealCards = (deck: Card[]): [Card[], Card[]] => {
  const half = Math.ceil(deck.length / 2);
  return [deck.slice(0, half), deck.slice(half)];
};