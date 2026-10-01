import type { VoiceCallbacks, VoiceConnection, VoiceSessionGrant } from './types';

interface RealtimeEvent {
  type: string;
  transcript?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  error?: { message?: string };
  response?: {
    usage?: {
      input_token_details?: { audio_tokens?: number; text_tokens?: number; cached_tokens?: number };
      output_token_details?: { audio_tokens?: number; text_tokens?: number };
    };
  };
}

// OpenAI Realtime over WebRTC. The browser's WebRTC stack handles audio
// capture, playback and echo cancellation; events travel on a data channel.
export async function startOpenAi(
  grant: VoiceSessionGrant,
  mic: MediaStream,
  cb: VoiceCallbacks,
): Promise<VoiceConnection> {
  const pc = new RTCPeerConnection();
  const audio = document.createElement('audio');
  audio.autoplay = true;
  pc.ontrack = event => { audio.srcObject = event.streams[0]; };
  mic.getAudioTracks().forEach(track => pc.addTrack(track, mic));

  const channel = pc.createDataChannel('oai-events');
  let stopped = false;
  let toolOutputsPending = false;
  const send = (event: Record<string, unknown>) => {
    if (channel.readyState === 'open') channel.send(JSON.stringify(event));
  };

  channel.onopen = () => cb.onStatus('Connected. Start talking.');
  channel.onmessage = message => {
    let event: RealtimeEvent;
    try { event = JSON.parse(String(message.data)) as RealtimeEvent; } catch { return; }
    switch (event.type) {
      case 'output_audio_buffer.started':
        cb.onChefSpeaking(true);
        break;
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        cb.onChefSpeaking(false);
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript?.trim()) cb.onTranscript('user', event.transcript.trim());
        break;
      case 'response.output_audio_transcript.done':
        if (event.transcript?.trim()) cb.onTranscript('chef', event.transcript.trim());
        break;
      case 'response.function_call_arguments.done': {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(event.arguments || '{}') as Record<string, unknown>; } catch { /* keep empty */ }
        const result = cb.onToolCall(event.name ?? '', args);
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: event.call_id, output: JSON.stringify(result) } });
        toolOutputsPending = true;
        break;
      }
      case 'response.done': {
        const usage = event.response?.usage;
        if (usage) {
          cb.onUsage({
            audioInTokens: usage.input_token_details?.audio_tokens ?? 0,
            textInTokens: usage.input_token_details?.text_tokens ?? 0,
            cachedInTokens: usage.input_token_details?.cached_tokens ?? 0,
            audioOutTokens: usage.output_token_details?.audio_tokens ?? 0,
            textOutTokens: usage.output_token_details?.text_tokens ?? 0,
          });
        }
        // Ask for the spoken follow-up once all tool results for this turn are in.
        if (toolOutputsPending) {
          toolOutputsPending = false;
          send({ type: 'response.create' });
        }
        break;
      }
      case 'error':
        cb.onError(event.error?.message || 'OpenAI reported an error');
        break;
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') cb.onError('OpenAI connection failed');
    if ((pc.connectionState === 'failed' || pc.connectionState === 'closed') && !stopped) cb.onClosed();
  };

  cb.onStatus('Connecting to OpenAI…');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const response = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    body: offer.sdp,
    headers: { Authorization: `Bearer ${grant.token}`, 'Content-Type': 'application/sdp' },
  });
  if (!response.ok) {
    pc.close();
    throw new Error(`OpenAI connection failed (${response.status})`);
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() });

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      channel.close();
      pc.close();
      audio.srcObject = null;
      cb.onClosed();
    },
  };
}
