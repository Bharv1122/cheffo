// Voice Lab — hidden, owner-only page for comparing realtime voice providers
// in a real kitchen before building voice into Cooking Mode. Not linked from
// the app; the server only issues sessions to VOICE_LAB_ALLOWED_EMAILS.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Timer, Copy, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { useRecipes } from '../../hooks/useRecipes';
import { supabase } from '../../lib/supabase';
import { PER_MINUTE_RATES, type VoiceConnection, type VoiceProvider, type VoiceSessionGrant, type VoiceUsage } from '../../utils/voiceLab/types';

const RESULTS_KEY = 'cheffo:voice-lab:results:v1';
const SPEECH_RMS_THRESHOLD = 0.02;
const PROVIDER_LABEL: Record<VoiceProvider, string> = { gemini: 'Gemini Live', openai: 'OpenAI Realtime' };

interface KitchenTimer { id: number; label: string; endsAt: number; done: boolean }
interface TranscriptLine { role: 'user' | 'chef' | 'system'; text: string }
interface SessionMetrics { seconds: number; userSpeechMs: number; chefSpeechMs: number; latenciesMs: number[]; usage: VoiceUsage }
interface SavedResult {
  at: string; provider: VoiceProvider; model: string; minutes: number; avgLatencyMs: number | null;
  estCost: number; understood: number; natural: number; noise: number; notes: string;
}

const EMPTY_USAGE: VoiceUsage = { audioInTokens: 0, audioOutTokens: 0, textInTokens: 0, textOutTokens: 0, cachedInTokens: 0 };
const EMPTY_METRICS: SessionMetrics = { seconds: 0, userSpeechMs: 0, chefSpeechMs: 0, latenciesMs: [], usage: EMPTY_USAGE };

function loadResults(): SavedResult[] {
  try { return JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '[]') as SavedResult[]; } catch { return []; }
}
function saveResults(results: SavedResult[]) {
  try { localStorage.setItem(RESULTS_KEY, JSON.stringify(results)); } catch { /* storage unavailable */ }
}

function estimateCost(provider: VoiceProvider, metrics: SessionMetrics): number {
  const rate = PER_MINUTE_RATES[provider];
  return (metrics.userSpeechMs / 60000) * rate.listen + (metrics.chefSpeechMs / 60000) * rate.speak;
}
function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => void ctx.close();
  } catch { /* audio unavailable */ }
}

export default function VoiceLabPage() {
  const { recipes } = useRecipes();
  const [provider, setProvider] = useState<VoiceProvider>('gemini');
  const [recipeId, setRecipeId] = useState('');
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<SessionMetrics>(EMPTY_METRICS);
  const [lastRun, setLastRun] = useState<{ provider: VoiceProvider; model: string; metrics: SessionMetrics } | null>(null);
  const [results, setResults] = useState<SavedResult[]>(loadResults);
  const [rating, setRating] = useState({ understood: 3, natural: 3, noise: 3, notes: '' });
  const [now, setNow] = useState(() => Date.now());
  const [sessionProvider, setSessionProvider] = useState<VoiceProvider>('gemini');

  const recipe = useMemo(() => recipes.find(item => item.id === recipeId) ?? null, [recipes, recipeId]);
  const connectionRef = useRef<VoiceConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<{ ctx: AudioContext; interval: number } | null>(null);
  const capRef = useRef<number | null>(null);
  const grantRef = useRef<VoiceSessionGrant | null>(null);
  const metricsRef = useRef<SessionMetrics>(EMPTY_METRICS);
  const speechRef = useRef({ chefSpeaking: false, chefStartedAt: 0, lastUserSpeechAt: 0, lastChefEndAt: 0, startedAt: 0 });

  const updateMetrics = useCallback((update: (m: SessionMetrics) => SessionMetrics) => {
    metricsRef.current = update(metricsRef.current);
    setMetrics(metricsRef.current);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);

  // Kitchen timers fire from their own timeouts; clear any left on unmount.
  const timerHandles = useRef(new Set<number>());
  useEffect(() => {
    const handles = timerHandles.current;
    return () => handles.forEach(handle => window.clearTimeout(handle));
  }, []);

  const addLine = useCallback((line: TranscriptLine) => setTranscript(list => [...list.slice(-80), line]), []);

  const handleTool = useCallback((name: string, args: Record<string, unknown>): Record<string, unknown> => {
    if (name === 'set_timer') {
      const minutes = Math.min(240, Math.max(0.5, Number(args.minutes) || 0));
      const label = String(args.label ?? 'timer').slice(0, 40);
      const id = Date.now();
      setTimers(list => [...list, { id, label, endsAt: id + minutes * 60000, done: false }]);
      const handle = window.setTimeout(() => {
        timerHandles.current.delete(handle);
        beep();
        setTimers(list => list.map(timer => (timer.id === id ? { ...timer, done: true } : timer)));
      }, minutes * 60000);
      timerHandles.current.add(handle);
      addLine({ role: 'system', text: `⏱ Timer set: ${label}, ${minutes} min` });
      return { ok: true, minutes, label };
    }
    if (name === 'go_to_step') {
      const step = recipe?.instructions.find(item => item.stepNumber === Number(args.step));
      if (!step) return { ok: false, error: 'No such step in this recipe.' };
      setCurrentStep(step.stepNumber);
      addLine({ role: 'system', text: `➡ Showing step ${step.stepNumber}` });
      return { ok: true, step: step.stepNumber, instruction: step.instruction };
    }
    return { ok: false, error: `Unknown tool ${name}` };
  }, [recipe, addLine]);

  const teardown = useCallback(() => {
    // Clear the ref first: a connection's stop() reports onClosed, which calls
    // back into stop() and must find nothing left to tear down.
    const connection = connectionRef.current;
    connectionRef.current = null;
    connection?.stop();
    micRef.current?.getTracks().forEach(track => track.stop());
    micRef.current = null;
    if (meterRef.current) {
      window.clearInterval(meterRef.current.interval);
      void meterRef.current.ctx.close();
      meterRef.current = null;
    }
    if (capRef.current) window.clearTimeout(capRef.current);
    capRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (!connectionRef.current && !micRef.current) return;
    const grant = grantRef.current;
    const speech = speechRef.current;
    if (speech.chefSpeaking) {
      speech.chefSpeaking = false;
      updateMetrics(m => ({ ...m, chefSpeechMs: m.chefSpeechMs + (Date.now() - speech.chefStartedAt) }));
    }
    micRef.current?.getTracks().forEach(track => track.stop());
    micRef.current = null;
    teardown();
    setRunning(false);
    setStatus('Stopped');
    if (grant) setLastRun({ provider: grant.provider, model: grant.model, metrics: metricsRef.current });
  }, [teardown, updateMetrics]);

  useEffect(() => () => teardown(), [teardown]);

  const start = async () => {
    setError(null);
    setStarting(true);
    setTranscript([]);
    setTimers([]);
    setCurrentStep(null);
    setLastRun(null);
    metricsRef.current = EMPTY_METRICS;
    setMetrics(EMPTY_METRICS);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session) throw new Error('Sign in first.');
      const response = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ provider, recipeId: recipeId || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 404) throw new Error('Voice Lab is not enabled for this account (VOICE_LAB_ALLOWED_EMAILS).');
      if (!response.ok) throw new Error(body.error || `Session request failed (${response.status})`);
      const grant = body as VoiceSessionGrant;
      grantRef.current = grant;
      setSessionProvider(grant.provider);

      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      micRef.current = mic;

      // Local speech meter: measures how long you talk and reply latency the
      // same way for both providers.
      const meterCtx = new AudioContext();
      const analyser = meterCtx.createAnalyser();
      analyser.fftSize = 1024;
      meterCtx.createMediaStreamSource(mic).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      speechRef.current = { chefSpeaking: false, chefStartedAt: 0, lastUserSpeechAt: 0, lastChefEndAt: 0, startedAt: Date.now() };
      const interval = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        const rms = Math.sqrt(sum / samples.length);
        const speech = speechRef.current;
        const talking = rms > SPEECH_RMS_THRESHOLD && !speech.chefSpeaking;
        if (talking) speech.lastUserSpeechAt = Date.now();
        updateMetrics(m => ({
          ...m,
          seconds: (Date.now() - speech.startedAt) / 1000,
          userSpeechMs: m.userSpeechMs + (talking ? 100 : 0),
        }));
      }, 100);
      meterRef.current = { ctx: meterCtx, interval };

      const callbacks = {
        onStatus: setStatus,
        onTranscript: (role: 'user' | 'chef', text: string) => addLine({ role, text }),
        onChefSpeaking: (speaking: boolean) => {
          const speech = speechRef.current;
          if (speaking === speech.chefSpeaking) return;
          const at = Date.now();
          if (speaking) {
            const gap = at - speech.lastUserSpeechAt;
            if (speech.lastUserSpeechAt > speech.lastChefEndAt && gap < 10000) {
              updateMetrics(m => ({ ...m, latenciesMs: [...m.latenciesMs, gap] }));
            }
            speech.chefStartedAt = at;
          } else {
            updateMetrics(m => ({ ...m, chefSpeechMs: m.chefSpeechMs + (at - speech.chefStartedAt) }));
            speech.lastChefEndAt = at;
          }
          speech.chefSpeaking = speaking;
        },
        onToolCall: handleTool,
        onUsage: (usage: Partial<VoiceUsage>) => updateMetrics(m => ({
          ...m,
          usage: {
            audioInTokens: m.usage.audioInTokens + (usage.audioInTokens ?? 0),
            audioOutTokens: m.usage.audioOutTokens + (usage.audioOutTokens ?? 0),
            textInTokens: m.usage.textInTokens + (usage.textInTokens ?? 0),
            textOutTokens: m.usage.textOutTokens + (usage.textOutTokens ?? 0),
            cachedInTokens: m.usage.cachedInTokens + (usage.cachedInTokens ?? 0),
          },
        })),
        onError: (message: string) => setError(message),
        onClosed: () => stop(),
      };

      const connect = grant.provider === 'gemini'
        ? (await import('../../utils/voiceLab/gemini')).startGemini
        : (await import('../../utils/voiceLab/openai')).startOpenAi;
      connectionRef.current = await connect(grant, mic, callbacks);
      capRef.current = window.setTimeout(() => {
        addLine({ role: 'system', text: 'Session limit reached.' });
        stop();
      }, grant.maxSeconds * 1000);
      setRunning(true);
    } catch (err) {
      teardown();
      setError(err instanceof Error ? err.message : 'Could not start the session.');
      setStatus('Ready');
    } finally {
      setStarting(false);
    }
  };

  const saveRating = () => {
    if (!lastRun) return;
    const next: SavedResult = {
      at: new Date().toISOString(),
      provider: lastRun.provider,
      model: lastRun.model,
      minutes: Math.round((lastRun.metrics.seconds / 60) * 10) / 10,
      avgLatencyMs: average(lastRun.metrics.latenciesMs),
      estCost: Math.round(estimateCost(lastRun.provider, lastRun.metrics) * 1000) / 1000,
      ...rating,
    };
    const updated = [next, ...results].slice(0, 50);
    setResults(updated);
    saveResults(updated);
    setLastRun(null);
    setRating({ understood: 3, natural: 3, noise: 3, notes: '' });
  };

  const copyResults = () => {
    const header = 'date\tprovider\tmodel\tminutes\tavg_latency_ms\test_cost_usd\tunderstood\tnatural\tnoise\tnotes';
    const rows = results.map(r => [r.at, r.provider, r.model, r.minutes, r.avgLatencyMs ?? '', r.estCost, r.understood, r.natural, r.noise, r.notes.replace(/\s+/g, ' ')].join('\t'));
    void navigator.clipboard?.writeText([header, ...rows].join('\n'));
  };

  const step = recipe?.instructions.find(item => item.stepNumber === currentStep);

  return (
    <AppShell active="settings">
      <section className="doggo-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#a34c11]">Owner test page · not visible to customers</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#2b2118]">Voice Lab</h1>
        <p className="mt-2 text-sm text-[#6f6459]">
          Try each voice provider while actually cooking. Prop your phone on the counter, run a few minutes with each,
          then rate it. Sessions stop automatically after 15 minutes.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-[#2b2118]">
            Provider
            <select className="doggo-input mt-1 w-full" value={provider} disabled={running || starting}
              onChange={event => setProvider(event.target.value as VoiceProvider)}>
              <option value="gemini">Gemini Live (Google)</option>
              <option value="openai">OpenAI Realtime</option>
            </select>
          </label>
          <label className="text-sm font-medium text-[#2b2118]">
            Recipe to cook
            <select className="doggo-input mt-1 w-full" value={recipeId} disabled={running || starting}
              onChange={event => setRecipeId(event.target.value)}>
              <option value="">No recipe (general questions)</option>
              {recipes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {running ? (
            <Button variant="danger" icon={<Square size={16} />} onClick={stop}>Stop</Button>
          ) : (
            <Button icon={<Mic size={16} />} loading={starting} onClick={() => void start()}>Start talking</Button>
          )}
          <span className="text-sm text-[#6f6459]" role="status">{status}</span>
        </div>
        {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>

      {(running || metrics.seconds > 0) && (
        <section className="doggo-card mt-4 grid grid-cols-2 gap-3 p-5 text-sm sm:grid-cols-4">
          <div><p className="text-[#8b8378]">Session</p><p className="text-lg font-semibold">{formatClock(metrics.seconds)}</p></div>
          <div><p className="text-[#8b8378]">Avg reply delay</p><p className="text-lg font-semibold">{average(metrics.latenciesMs) !== null ? `${(average(metrics.latenciesMs)! / 1000).toFixed(2)} s` : '—'}</p></div>
          <div><p className="text-[#8b8378]">You / Chef talking</p><p className="text-lg font-semibold">{formatClock(metrics.userSpeechMs / 1000)} / {formatClock(metrics.chefSpeechMs / 1000)}</p></div>
          <div><p className="text-[#8b8378]">Est. cost</p><p className="text-lg font-semibold">${estimateCost(sessionProvider, metrics).toFixed(3)}</p></div>
          <p className="col-span-2 text-xs text-[#8b8378] sm:col-span-4">
            Provider-reported tokens: audio in {metrics.usage.audioInTokens}, audio out {metrics.usage.audioOutTokens}, text in {metrics.usage.textInTokens}, text out {metrics.usage.textOutTokens}, cached {metrics.usage.cachedInTokens}.
            The estimate uses list per-minute prices and your measured talk time; check the provider's billing page for actual charges.
          </p>
        </section>
      )}

      {(step || timers.length > 0) && (
        <section className="doggo-card mt-4 p-5">
          {step && <p className="text-lg font-semibold text-[#2b2118]">Step {step.stepNumber}: <span className="font-normal">{step.instruction}</span></p>}
          {timers.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {timers.map(timer => (
                <li key={timer.id} className={['flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold', timer.done ? 'bg-red-100 text-red-700' : 'bg-[#fff0de] text-[#a34c11]'].join(' ')}>
                  <Timer size={14} aria-hidden="true" /> {timer.label}: {timer.done ? 'done!' : formatClock((timer.endsAt - now) / 1000)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {transcript.length > 0 && (
        <section className="doggo-card mt-4 max-h-80 overflow-y-auto p-5 text-sm" aria-live="polite">
          {transcript.map((line, index) => (
            <p key={index} className={line.role === 'chef' ? 'mt-2 text-[#2b2118]' : line.role === 'user' ? 'mt-2 text-[#a34c11]' : 'mt-2 text-xs text-[#8b8378]'}>
              {line.role === 'chef' ? '🐾 Chef: ' : line.role === 'user' ? 'You: ' : ''}{line.text}
            </p>
          ))}
        </section>
      )}

      {lastRun && (
        <section className="doggo-card mt-4 p-5">
          <h2 className="text-base font-semibold">Rate that {PROVIDER_LABEL[lastRun.provider]} session</h2>
          {(['understood', 'natural', 'noise'] as const).map(key => (
            <label key={key} className="mt-3 block text-sm">
              {key === 'understood' ? 'Understood me' : key === 'natural' ? 'Sounded natural & quick' : 'Handled kitchen noise'}: <strong>{rating[key]}</strong>/5
              <input type="range" min={1} max={5} value={rating[key]} className="mt-1 block w-full"
                onChange={event => setRating(r => ({ ...r, [key]: Number(event.target.value) }))} />
            </label>
          ))}
          <textarea className="doggo-input mt-3 w-full" rows={3} placeholder="Notes: anything it got wrong, echo, interruptions…"
            value={rating.notes} onChange={event => setRating(r => ({ ...r, notes: event.target.value }))} />
          <Button className="mt-3" onClick={saveRating}>Save rating</Button>
        </section>
      )}

      {results.length > 0 && (
        <section className="doggo-card mt-4 overflow-x-auto p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Saved results (this device)</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={copyResults}>Copy</Button>
              <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => { setResults([]); saveResults([]); }}>Clear</Button>
            </div>
          </div>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-[#8b8378]"><tr><th className="pr-3">Provider</th><th className="pr-3">Min</th><th className="pr-3">Delay</th><th className="pr-3">Cost</th><th className="pr-3">Und.</th><th className="pr-3">Nat.</th><th className="pr-3">Noise</th><th>Notes</th></tr></thead>
            <tbody>
              {results.map(r => (
                <tr key={r.at} className="border-t border-[#eadfce]">
                  <td className="pr-3 py-1">{PROVIDER_LABEL[r.provider]}</td><td className="pr-3">{r.minutes}</td>
                  <td className="pr-3">{r.avgLatencyMs !== null ? `${(r.avgLatencyMs / 1000).toFixed(2)}s` : '—'}</td>
                  <td className="pr-3">${r.estCost.toFixed(3)}</td><td className="pr-3">{r.understood}</td><td className="pr-3">{r.natural}</td><td className="pr-3">{r.noise}</td>
                  <td className="text-xs">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </AppShell>
  );
}
