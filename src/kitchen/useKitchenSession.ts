import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Recipe } from '../types/recipe';
import {
  KITCHEN_VOICE_HELP,
  initialKitchenState,
  kitchenReducer,
  parseKitchenCommand,
  spokenStep,
  stepTimerMinutes,
  type KitchenCommand,
} from './stepEngine';

// ── Screen wake lock ─────────────────────────────────────────────────────────
// Keeps a tablet / smart display awake while cooking. Rejection is normal
// (battery saver, unsupported browser, iframe) and only changes the status.

export type WakeLockStatus = 'active' | 'unsupported' | 'unavailable';

type WakeLockSentinelLike = { release(): Promise<void>; addEventListener(type: 'release', cb: () => void): void };
type WakeLockNavigator = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };

export function useScreenWakeLock(enabled = true): WakeLockStatus {
  const supported = typeof navigator !== 'undefined' && !!(navigator as WakeLockNavigator).wakeLock;
  const [status, setStatus] = useState<WakeLockStatus>(supported ? 'unavailable' : 'unsupported');

  useEffect(() => {
    if (!enabled || !supported) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible' || sentinel) return;
      try {
        const lock = await (navigator as WakeLockNavigator).wakeLock!.request('screen');
        if (disposed) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        setStatus('active');
        lock.addEventListener('release', () => {
          sentinel = null;
          if (!disposed) setStatus('unavailable');
        });
      } catch {
        setStatus('unavailable');
      }
    };
    void acquire();
    // The browser drops the lock whenever the tab is hidden; take it back.
    const onVisible = () => void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled, supported]);

  return status;
}

// ── Timer alert ──────────────────────────────────────────────────────────────

function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.32);
    });
    window.setTimeout(() => void ctx.close().catch(() => {}), 1500);
  } catch {
    // Audio is a nice-to-have; the on-screen alert still shows.
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Not supported.
  }
}

// ── Speech (Web Speech API; optional everywhere) ────────────────────────────

interface SpeechAlt { transcript: string }
interface SpeechResult { isFinal: boolean; 0: SpeechAlt }
interface SpeechEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type VoiceStatus = 'unsupported' | 'off' | 'listening' | 'error';

export function useKitchenVoice(onCommand: (command: KitchenCommand, heard: string) => void) {
  const supportedRecognition = !!recognitionCtor();
  const supportedSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [status, setStatus] = useState<VoiceStatus>(supportedRecognition ? 'off' : 'unsupported');
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const active = useRef(false);
  const commandRef = useRef(onCommand);
  useEffect(() => {
    commandRef.current = onCommand;
  }, [onCommand]);

  const stop = useCallback(() => {
    active.current = false;
    try {
      recognition.current?.abort();
    } catch {
      // already stopped
    }
    recognition.current = null;
    setStatus(s => (s === 'unsupported' ? s : 'off'));
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    let rec: Recognition;
    try {
      rec = new Ctor();
    } catch {
      setStatus('error');
      setNote('Voice couldn’t start in this browser. Everything works by touch.');
      return;
    }
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const text = result[0].transcript.trim();
        setHeard(text);
        const command = parseKitchenCommand(text);
        if (command) commandRef.current(command, text);
        else setNote(`Heard “${text}”. ${KITCHEN_VOICE_HELP}`);
      }
    };
    rec.onerror = event => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      active.current = false;
      setStatus('error');
      setNote(event.error === 'not-allowed'
        ? 'Microphone permission was denied. Everything still works by touch.'
        : 'Voice stopped. Tap the mic to try again, or keep going by touch.');
    };
    // Continuous recognition ends on its own after a pause; restart until the cook turns it off.
    rec.onend = () => {
      if (!active.current) return;
      try {
        rec.start();
      } catch {
        active.current = false;
        setStatus('off');
      }
    };
    recognition.current = rec;
    active.current = true;
    try {
      rec.start();
      setStatus('listening');
      setNote(KITCHEN_VOICE_HELP);
    } catch {
      active.current = false;
      setStatus('error');
      setNote('Voice couldn’t start. Everything works by touch.');
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!supportedSpeech || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech output is optional.
    }
  }, [supportedSpeech]);

  useEffect(() => () => {
    active.current = false;
    try {
      recognition.current?.abort();
    } catch {
      // already stopped
    }
    if (supportedSpeech) window.speechSynthesis.cancel();
  }, [supportedSpeech]);

  return { status, heard, note, start, stop, speak, supportedSpeech };
}

// ── The session: engine + timers + alerts ───────────────────────────────────

export function useKitchenSession(recipe: Recipe | undefined) {
  const total = recipe?.instructions.length ?? 0;
  const [state, dispatch] = useReducer(kitchenReducer, total, initialKitchenState);
  const [now, setNow] = useState(() => Date.now());
  const running = state.timers.some(timer => !timer.done && timer.endsAt !== null);
  const doneCount = state.timers.filter(timer => timer.done).length;
  const lastDone = useRef(doneCount);

  // The recipe can arrive after the first render (saved recipes load async).
  if (state.total !== total) dispatch({ type: 'setTotal', total });

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    }, 250);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (doneCount > lastDone.current) playChime();
    lastDone.current = doneCount;
  }, [doneCount]);

  const step = recipe?.instructions[state.step];
  const actions = useMemo(() => ({
    next: () => dispatch({ type: 'next' }),
    back: () => dispatch({ type: 'back' }),
    goto: (index: number) => dispatch({ type: 'goto', step: index }),
    repeat: () => dispatch({ type: 'repeat' }),
    addTimer: (label: string, minutes: number, stepNumber?: number | null) =>
      dispatch({ type: 'addTimer', label, minutes, stepNumber, now: Date.now() }),
    pauseTimer: (id: string) => dispatch({ type: 'pauseTimer', id, now: Date.now() }),
    resumeTimer: (id: string) => dispatch({ type: 'resumeTimer', id, now: Date.now() }),
    cancelTimer: (id: string) => dispatch({ type: 'cancelTimer', id }),
    dismissDone: () => dispatch({ type: 'dismissDone' }),
  }), []);

  const startStepTimer = useCallback(() => {
    const minutes = stepTimerMinutes(step);
    if (!step || !minutes) return false;
    actions.addTimer(`Step ${state.step + 1}`, minutes, step.stepNumber);
    return true;
  }, [actions, step, state.step]);

  return {
    state: state,
    step,
    now,
    actions,
    startStepTimer,
    stepMinutes: stepTimerMinutes(step),
    spoken: spokenStep(step, state.step, total),
  };
}
