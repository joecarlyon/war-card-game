import React from 'react';
import { Card as CardType, Suit } from '../types';

interface CardProps {
  card: CardType | null;
  hidden?: boolean;
  isPot?: boolean;
  className?: string;
}

const Card: React.FC<CardProps> = ({ card, hidden = false, isPot = false, className = '' }) => {
  if (!card && !hidden) return <div className={`w-24 h-36 rounded-lg border-2 border-dashed border-white/20 bg-transparent ${className}`}></div>;

  // Back of card
  if (hidden) {
    return (
      <div className={`w-24 h-36 rounded-lg border border-white/10 bg-blue-900 shadow-xl flex items-center justify-center relative overflow-hidden transform transition-transform ${className}`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-20"></div>
        <div className="w-20 h-32 border-2 border-blue-400/30 rounded flex items-center justify-center">
            <span className="text-4xl text-blue-200 opacity-50">⚔️</span>
        </div>
      </div>
    );
  }

  // Front of card
  if (!card) return null;

  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds;

  return (
    <div className={`w-24 h-36 bg-white rounded-lg shadow-xl relative flex flex-col justify-between p-2 select-none transform transition-all duration-300 ${className} ${isPot ? 'scale-90 rotate-12' : ''}`}>
      <div className={`text-lg font-bold leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        <div>{card.rank}</div>
        <div className="text-sm">{card.suit}</div>
      </div>
      
      <div className={`absolute inset-0 flex items-center justify-center text-4xl ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.suit}
      </div>

      <div className={`text-lg font-bold leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        <div>{card.rank}</div>
        <div className="text-sm">{card.suit}</div>
      </div>
    </div>
  );
};

export default Card;