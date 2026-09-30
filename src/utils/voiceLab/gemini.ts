import type { VoiceCallbacks, VoiceConnection, VoiceSessionGrant } from './types';

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToPcm16(data: string): Float32Array {
  const binary = atob(data);
  const samples = new Float32Array(Math.floor(binary.length / 2));
  for (let i = 0; i < samples.length; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    const value = (hi << 8) | lo;
    samples[i] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000;
  }
  return samples;
}

// Gemini Live over WebSocket. The browser captures 16 kHz PCM itself and plays
// the 24 kHz PCM reply through Web Audio. The token is constrained server-side,
// so the config sent here is ignored for every locked field.
export async function startGemini(
  grant: VoiceSessionGrant,
  mic: MediaStream,
  cb: VoiceCallbacks,
): Promise<VoiceConnection> {
  const { GoogleGenAI, Modality } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: grant.token, httpOptions: { apiVersion: 'v1alpha' } });

  const captureCtx = new AudioContext();
  const playCtx = new AudioContext({ sampleRate: 24000 });
  await captureCtx.audioWorklet.addModule('/voice-lab-mic-worklet.js');
  const micSource = captureCtx.createMediaStreamSource(mic);
  const micNode = new AudioWorkletNode(captureCtx, 'voice-lab-mic');
  const mute = captureCtx.createGain();
  mute.gain.value = 0;
  micSource.connect(micNode);
  micNode.connect(mute).connect(captureCtx.destination); // keeps the worklet running

  const playing = new Set<AudioBufferSourceNode>();
  let nextStart = 0;
  let speaking = false;
  let userText = '';
  let chefText = '';
  let stopped = false;

  const setSpeaking = (value: boolean) => {
    if (speaking === value) return;
    speaking = value;
    cb.onChefSpeaking(value);
  };
  const flushUser = () => { if (userText.trim()) cb.onTranscript('user', userText.trim()); userText = ''; };
  const flushChef = () => { if (chefText.trim()) cb.onTranscript('chef', chefText.trim()); chefText = ''; };
  const stopPlayback = () => {
    playing.forEach(node => { try { node.stop(); } catch { /* already stopped */ } });
    playing.clear();
    nextStart = 0;
    setSpeaking(false);
  };

  const play = (samples: Float32Array) => {
    const buffer = playCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);
    const node = playCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(playCtx.destination);
    const startAt = Math.max(playCtx.currentTime + 0.02, nextStart);
    node.start(startAt);
    nextStart = startAt + buffer.duration;
    playing.add(node);
    setSpeaking(true);
    node.onended = () => {
      playing.delete(node);
      if (playing.size === 0) setSpeaking(false);
    };
  };

  cb.onStatus('Connecting to Gemini…');
  const session = await ai.live.connect({
    model: grant.model,
    config: { responseModalities: [Modality.AUDIO] },
    callbacks: {
      onopen: () => cb.onStatus('Connected. Start talking.'),
      onmessage: message => {
        const content = message.serverContent;
        if (content?.interrupted) stopPlayback();
        if (content?.inputTranscription?.text) userText += content.inputTranscription.text;
        if (content?.outputTranscription?.text) {
          flushUser();
          chefText += content.outputTranscription.text;
        }
        for (const part of content?.modelTurn?.parts ?? []) {
          const data = part.inlineData?.data;
          if (data && part.inlineData?.mimeType?.startsWith('audio/')) {
            flushUser();
            play(base64ToPcm16(data));
          }
        }
        if (content?.turnComplete) { flushUser(); flushChef(); }

        const calls = message.toolCall?.functionCalls ?? [];
        if (calls.length) {
          session.sendToolResponse({
            functionResponses: calls.map(call => ({
              id: call.id,
              name: call.name,
              response: cb.onToolCall(call.name ?? '', (call.args ?? {}) as Record<string, unknown>),
            })),
          });
        }

        const usage = message.usageMetadata;
        if (usage) {
          const sum = (details: typeof usage.promptTokensDetails, modality: string) =>
            (details ?? []).filter(item => item.modality === modality).reduce((total, item) => total + (item.tokenCount ?? 0), 0);
          cb.onUsage({
            audioInTokens: sum(usage.promptTokensDetails, 'AUDIO'),
            textInTokens: sum(usage.promptTokensDetails, 'TEXT'),
            audioOutTokens: sum(usage.responseTokensDetails, 'AUDIO'),
            textOutTokens: sum(usage.responseTokensDetails, 'TEXT'),
            cachedInTokens: usage.cachedContentTokenCount ?? 0,
          });
        }
        if (message.goAway) cb.onStatus('Gemini is about to end this session.');
      },
      onerror: event => cb.onError(event.message || 'Gemini connection error'),
      onclose: event => {
        if (!stopped && event.reason) cb.onError(`Gemini closed the session: ${event.reason}`);
        cb.onClosed();
      },
    },
  });

  micNode.port.onmessage = event => {
    if (stopped) return;
    session.sendRealtimeInput({ audio: { data: bytesToBase64(event.data as ArrayBuffer), mimeType: 'audio/pcm;rate=16000' } });
  };

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      micNode.port.onmessage = null;
      stopPlayback();
      try { session.close(); } catch { /* already closed */ }
      micSource.disconnect();
      micNode.disconnect();
      void captureCtx.close();
      void playCtx.close();
    },
  };
}
