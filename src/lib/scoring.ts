import { MatchScoutData, EndGameClimbResult, AutoClimbResult, PitAnswer, ScoringRuleDefinition } from '../types';

export function getConfiguredScoringTotal(
  answers: Record<string, PitAnswer>,
  rules: ScoringRuleDefinition[],
  pitAnswers: Record<string, PitAnswer> = {},
): number {
  return rules.reduce((total, rule) => {
    const value = (rule.source === 'pit' ? pitAnswers : answers)[rule.key];
    if (Array.isArray(value)) {
      return total + value.reduce((sum, item) => sum + (rule.values[item] || 0), 0);
    }
    return total + (rule.values[String(value ?? '')] || 0);
  }, 0);
}

export const scoring = {
  getTowerPoints(endGameResult: EndGameClimbResult | '', autoResult?: AutoClimbResult): number {
    let points = 0;
    
    if (autoResult === 'Level 1 Successful') {
      points += 15;
    }

    switch (endGameResult) {
      case 'Level 1':
        points += 10;
        break;
      case 'Level 2':
        points += 20;
        break;
      case 'Level 3':
        points += 30;
        break;
    }

    return points;
  },

  getFuelPoints(autoFuel: number, teleopFuel: number): number {
    return autoFuel + teleopFuel;
  }
};
