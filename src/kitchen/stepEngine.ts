// Hands-free cooking step engine, shared by the kitchen display (/kitchen/:id)
// and the WebXR kitchen (/kitchen/:id/xr).
//
// Pure reducer: every time-dependent action carries `now` so the same logic is
// testable in Node (scripts/verify-kitchen-engine.mjs) and immune to throttled
// background timers — a timer's remaining time is always derived from its
// end timestamp, never from counting ticks.
//
// Timers only ever use a duration that is already on the recipe step
// (`durationMinutes`) or one the cook picks explicitly. The engine never
// invents a cooking time.

import type { CookingStep } from '../types/recipe';

export interface KitchenTimer {
  id: string;
  label: string;
  stepNumber: number | null;
  durationMs: number;
  // Set while running; null while paused.
  endsAt: number | null;
  // Authoritative while paused; a snapshot while running.
  remainingMs: number;
  done: boolean;
}

export interface KitchenState {
  step: number;
  total: number;
  // Bumped by `repeat` so views can re-read / re-announce the current step.
  repeatCount: number;
  timers: KitchenTimer[];
  nextTimerId: number;
}

export type KitchenAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goto'; step: number }
  | { type: 'setTotal'; total: number }
  | { type: 'repeat' }
  | { type: 'addTimer'; label: string; minutes: number; stepNumber?: number | null; now: number }
  | { type: 'pauseTimer'; id: string; now: number }
  | { type: 'resumeTimer'; id: string; now: number }
  | { type: 'cancelTimer'; id: string }
  | { type: 'dismissDone' }
  | { type: 'tick'; now: number };

export const MAX_TIMERS = 4;
export const MAX_TIMER_MINUTES = 240;

export function initialKitchenState(total: number): KitchenState {
  return { step: 0, total: Math.max(0, total), repeatCount: 0, timers: [], nextTimerId: 1 };
}

const clampStep = (state: KitchenState, step: number) => Math.max(0, Math.min(Math.max(0, state.total - 1), Math.trunc(step)));

export function timerRemainingMs(timer: KitchenTimer, now: number): number {
  if (timer.done) return 0;
  if (timer.endsAt === null) return timer.remainingMs;
  // Clamp: a view's clock can lag the moment a timer was created.
  return Math.min(timer.durationMs, Math.max(0, timer.endsAt - now));
}

export function kitchenReducer(state: KitchenState, action: KitchenAction): KitchenState {
  switch (action.type) {
    case 'next':
      return { ...state, step: clampStep(state, state.step + 1) };
    case 'back':
      return { ...state, step: clampStep(state, state.step - 1) };
    case 'goto':
      return Number.isFinite(action.step) ? { ...state, step: clampStep(state, action.step) } : state;
    case 'setTotal': {
      const total = Math.max(0, Math.trunc(action.total) || 0);
      return total === state.total ? state : { ...state, total, step: Math.min(state.step, Math.max(0, total - 1)) };
    }
    case 'repeat':
      return { ...state, repeatCount: state.repeatCount + 1 };
    case 'addTimer': {
      const minutes = Number(action.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_TIMER_MINUTES) return state;
      if (state.timers.filter(timer => !timer.done).length >= MAX_TIMERS) return state;
      const durationMs = Math.round(minutes * 60_000);
      const timer: KitchenTimer = {
        id: `t${state.nextTimerId}`,
        label: action.label.slice(0, 40) || `${minutes} min`,
        stepNumber: action.stepNumber ?? null,
        durationMs,
        endsAt: action.now + durationMs,
        remainingMs: durationMs,
        done: false,
      };
      return { ...state, timers: [...state.timers, timer], nextTimerId: state.nextTimerId + 1 };
    }
    case 'pauseTimer':
      return mapTimer(state, action.id, timer =>
        timer.done || timer.endsAt === null ? timer : { ...timer, endsAt: null, remainingMs: Math.max(0, timer.endsAt - action.now) });
    case 'resumeTimer':
      return mapTimer(state, action.id, timer =>
        timer.done || timer.endsAt !== null ? timer : { ...timer, endsAt: action.now + timer.remainingMs });
    case 'cancelTimer':
      return { ...state, timers: state.timers.filter(timer => timer.id !== action.id) };
    case 'dismissDone':
      return { ...state, timers: state.timers.filter(timer => !timer.done) };
    case 'tick': {
      let changed = false;
      const timers = state.timers.map(timer => {
        if (timer.done || timer.endsAt === null || timer.endsAt > action.now) return timer;
        changed = true;
        return { ...timer, done: true, remainingMs: 0 };
      });
      return changed ? { ...state, timers } : state;
    }
  }
}

function mapTimer(state: KitchenState, id: string, fn: (timer: KitchenTimer) => KitchenTimer): KitchenState {
  return { ...state, timers: state.timers.map(timer => (timer.id === id ? fn(timer) : timer)) };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}

// A step's own timer is offered only when the recipe gives a duration.
export function stepTimerMinutes(step: CookingStep | undefined): number | null {
  const minutes = step?.durationMinutes;
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

// Formatted amounts usually already name the ingredient ("1 ¼ cups Chicken
// Breast (6 oz)"); only prefix the name when it's missing. Amounts are passed
// through untouched.
export function ingredientLine(name: string, formattedAmount: string): string {
  return formattedAmount.toLowerCase().includes(name.toLowerCase()) ? formattedAmount : `${name}: ${formattedAmount}`;
}

// Plain-text line to read aloud for a step.
export function spokenStep(step: CookingStep | undefined, index: number, total: number): string {
  if (!step) return '';
  return `Step ${index + 1} of ${total}. ${step.instruction}`;
}

export type KitchenCommand = 'next' | 'back' | 'repeat' | 'ingredients' | 'timer' | 'help';

// Voice / typed command parser. Checked in order, whole words only, so
// "go back" is back and "start timer" is timer.
const COMMANDS: Array<{ command: KitchenCommand; patterns: RegExp[] }> = [
  { command: 'back', patterns: [/\b(go back|back|previous|last step)\b/] },
  { command: 'repeat', patterns: [/\b(repeat|again|say that again|what was that)\b/] },
  { command: 'timer', patterns: [/\b(start (the )?timer|set (a |the )?timer|timer)\b/] },
  { command: 'ingredients', patterns: [/\b(ingredients?|what do i need)\b/] },
  { command: 'help', patterns: [/\b(help|what can i say)\b/] },
  { command: 'next', patterns: [/\b(next|continue|go on|forward|done)\b/] },
];

export function parseKitchenCommand(text: string): KitchenCommand | null {
  const lower = text.toLowerCase();
  for (const { command, patterns } of COMMANDS) if (patterns.some(pattern => pattern.test(lower))) return command;
  return null;
}

export const KITCHEN_VOICE_HELP = 'Say “next”, “back”, “repeat”, “ingredients” or “start timer”.';
