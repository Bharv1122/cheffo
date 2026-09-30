// Voice Lab microphone capture: resamples the mic to 16 kHz mono 16-bit PCM
// and posts ~40 ms chunks to the page (used by the Gemini Live connection).
class MicPcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.position = 0;
    this.chunk = new Int16Array(640);
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    while (this.position < input.length) {
      const index = Math.floor(this.position);
      const next = Math.min(index + 1, input.length - 1);
      const fraction = this.position - index;
      const sample = input[index] + (input[next] - input[index]) * fraction;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.chunk[this.filled++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      if (this.filled === this.chunk.length) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
        this.chunk = new Int16Array(640);
        this.filled = 0;
      }
      this.position += this.ratio;
    }
    this.position -= input.length;
    return true;
  }
}

registerProcessor('voice-lab-mic', MicPcmWorklet);
