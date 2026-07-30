import { MatchQuestionDefinition } from '../types';

export function createCustomMatchQuestion(order = 1000): MatchQuestionDefinition {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    key: `custom_match_${suffix}`,
    label: 'New Match Question',
    type: 'short_text',
    options: [],
    archived: false,
    order,
    section: 'Custom Questions',
  };
}
