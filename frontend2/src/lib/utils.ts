import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MODEL_DISPLAY_MAP: Record<string, string> = {
  // OpenAI
  'gpt-5.2': 'GPT-5.2',
  'gpt-4.1': 'GPT-4.1',
  'gpt-4.1-mini': 'GPT-4.1 mini',
  'gpt-4.1-nano': 'GPT-4.1 nano',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  'o3': 'o3',
  'o4-mini': 'o4-mini',
  // Anthropic
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  // Gemini
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
};

export function formatModelName(model: string): string {
  if (!model) return '-';
  // 날짜 suffix 제거: -YYYY-MM-DD 또는 -YYYYMMDD 형태
  const normalized = model.replace(/-(\d{4}-\d{2}-\d{2}|\d{8})$/, '');
  const key = normalized.toLowerCase();
  if (MODEL_DISPLAY_MAP[key]) return MODEL_DISPLAY_MAP[key];
  if (key.startsWith('gpt')) return normalized.replace(/^gpt/i, 'GPT');
  if (key.startsWith('gemini')) return normalized.replace(/^gemini/i, 'Gemini').replace(/-/g, ' ');
  if (key.startsWith('claude')) return normalized.replace(/^claude/i, 'Claude').replace(/-/g, ' ');
  return model;
}
