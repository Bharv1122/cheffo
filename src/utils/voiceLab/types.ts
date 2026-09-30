export type VoiceProvider = 'gemini' | 'openai';

export interface VoiceSessionGrant {
  provider: VoiceProvider;
  model: string;
  token: string;
  maxSeconds: number;
  recipeLoaded: boolean;
}

export interface VoiceUsage {
  audioInTokens: number;
  audioOutTokens: number;
  textInTokens: number;
  textOutTokens: number;
  cachedInTokens: number;
}

export interface VoiceCallbacks {
  onStatus: (status: string) => void;
  onTranscript: (role: 'user' | 'chef', text: string) => void;
  // Fires when the assistant starts / stops producing audio for a reply.
  onChefSpeaking: (speaking: boolean) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => Record<string, unknown>;
  onUsage: (usage: Partial<VoiceUsage>) => void;
  onError: (message: string) => void;
  onClosed: () => void;
}

export interface VoiceConnection {
  stop: () => void;
}

// Approximate list prices used only for the lab's estimate (USD per minute of
// speech). Confirm against each provider's billing page after testing.
export const PER_MINUTE_RATES: Record<VoiceProvider, { listen: number; speak: number }> = {
  gemini: { listen: 0.005, speak: 0.018 },
  openai: { listen: 0.006, speak: 0.024 },
};
