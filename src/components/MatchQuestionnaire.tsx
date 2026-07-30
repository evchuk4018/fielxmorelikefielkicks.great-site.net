import React, { useMemo } from 'react';
import { MultiToggle, Toggle } from './Toggle';
import { MatchQuestionDefinition, PitAnswer } from '../types';
import { getDefaultMatchAnswer, getMatchAnswer, isMatchQuestionVisible } from '../lib/seasonConfiguration';

type Props = {
  questions: MatchQuestionDefinition[];
  answers: Record<string, PitAnswer>;
  onChange: (key: string, value: PitAnswer) => void;
};

function answerFromInput(question: MatchQuestionDefinition, value: string): PitAnswer {
  if (question.type === 'number') {
    return value.trim() === '' ? null : Number(value);
  }
  return value;
}

export function MatchQuestionnaire({ questions, answers, onChange }: Props) {
  const payload = useMemo(() => ({ answers }), [answers]);
  const sections = useMemo(() => {
    const grouped = new Map<string, MatchQuestionDefinition[]>();
    questions
      .filter((question) => !question.archived)
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      .forEach((question) => {
        const current = grouped.get(question.section) || [];
        current.push(question);
        grouped.set(question.section, current);
      });
    return Array.from(grouped.entries());
  }, [questions]);

  const renderQuestion = (question: MatchQuestionDefinition) => {
    if (!isMatchQuestionVisible(payload, question)) {
      return null;
    }

    const value = getMatchAnswer(payload, question.key) ?? getDefaultMatchAnswer(question.type);
    const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:ring-2 focus:ring-blue-500';

    if (question.type === 'boolean') {
      return <Toggle key={question.key} label={question.label} value={value === true} onChange={(next) => onChange(question.key, next)} />;
    }

    if (question.type === 'single_choice') {
      return <MultiToggle key={question.key} label={question.label} options={question.options} value={typeof value === 'string' ? value : ''} onChange={(next) => onChange(question.key, next)} />;
    }

    if (question.type === 'multi_choice') {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div key={question.key} className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">{question.label}</label>
          <div className="grid grid-cols-2 gap-2">
            {question.options.map((option) => {
              const isSelected = selected.includes(option);
              return <button key={option} type="button" onClick={() => onChange(question.key, isSelected ? selected.filter((item) => item !== option) : [...selected, option])} className={`rounded-xl border p-3 text-sm font-medium transition-colors ${isSelected ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{option}</button>;
            })}
          </div>
        </div>
      );
    }

    if (question.type === 'number') {
      return (
        <div key={question.key} className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">{question.label}</label>
          <input type="number" value={typeof value === 'number' ? value : ''} min={question.min} max={question.max} step={question.step} onChange={(event) => onChange(question.key, answerFromInput(question, event.target.value))} className={inputClass} />
        </div>
      );
    }

    return (
      <div key={question.key} className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">{question.label}</label>
        {question.type === 'long_text' ? <textarea value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(question.key, event.target.value)} className={`${inputClass} min-h-[100px]`} /> : <input type="text" value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(question.key, event.target.value)} className={inputClass} />}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {sections.map(([section, sectionQuestions]) => (
        <div key={section} className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl">
          <h2 className="text-2xl font-bold text-white">{section}</h2>
          {sectionQuestions.map(renderQuestion)}
        </div>
      ))}
    </div>
  );
}
