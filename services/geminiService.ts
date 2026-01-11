import { GoogleGenAI } from "@google/genai";
import { WarEvent } from "../types";

const getWarDescription = (depth: number) => {
  if (depth === 1) return "War";
  if (depth === 2) return "Double War";
  if (depth === 3) return "Triple War";
  return "Massive War";
};

export const generateBattleReport = async (
  winnerName: string,
  loserName: string,
  turnCount: number,
  warHistory: WarEvent[],
  finalScore: { winner: number; loser: number }
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not configured. Unable to generate battle report.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Filter for significant wars to keep the prompt concise
  const significantWars = warHistory.filter(w => w.type !== 'Single').slice(0, 10);
  const totalWars = warHistory.length;
  
  const prompt = `
    You are an enthusiastic, dramatic, old-timey war correspondent reporting on a card game of "War".
    
    Match Summary:
    - Victor: ${winnerName} (Score: ${finalScore.winner} cards)
    - Defeated: ${loserName} (Score: ${finalScore.loser} cards)
    - Total Turns: ${turnCount}
    - Total Conflicts (Wars): ${totalWars}
    
    Notable Battles (Wars):
    ${significantWars.length > 0 
      ? significantWars.map(w => `- Turn ${w.turn}: A ${w.type} occurred! Winner: ${w.winner}. Spoils: ${w.spoilsCount} cards.`).join('\n')
      : "No multi-stage wars occurred, just a steady grind of single skirmishes."}
    
    Write a short, spirited newspaper column style report (approx 150 words) summarizing the flow of the game, the intensity of the "wars", and the ultimate victory. Use military metaphors appropriate for a card game.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Report got lost in transmission.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "The telegraph lines are down! (Error generating report)";
  }
};