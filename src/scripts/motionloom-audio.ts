// =========================================
// =========================================
// src/scripts/motionloom-audio.ts

/** The WASM mixer owns all edit semantics; this adapter only supplies browser I/O. */
export interface AudioMixerHandle {
  plan_json(): string;
  add_asset(id: string, samples: Float32Array): void;
  render(start: number, frames: number): Float32Array;
  free(): void;
}
export interface AudioWasmModule {
  WasmAudioMixer: new (script: string, sampleRate: number) => AudioMixerHandle;
}
export class MotionLoomAudio {
  private sources = new Set<AudioBufferSourceNode>();
  private startClock = 0;
  private startTimeline = 0;
  private scheduledSamples = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private playing = false;
  private disposed = false;
  readonly sampleRate = 48000;
  private constructor(
    private mixer: AudioMixerHandle,
    private context: AudioContext,
    private output: GainNode,
  ) {}

  static async create(mod: AudioWasmModule, script: string, baseUrl = document.baseURI) {
    if (!mod.WasmAudioMixer) throw new Error('Rebuild MotionLoom WASM to enable audio.');
    const mixer = new mod.WasmAudioMixer(script, 48000);
    let context: AudioContext | undefined;
    try {
      context = new AudioContext({ sampleRate: 48000 });
      const plan = JSON.parse(mixer.plan_json()) as { assets: { id: string; src: string }[] };
      let decodedBytes = 0;
      for (const asset of plan.assets) {
        const response = await fetch(new URL(asset.src, baseUrl));
        if (!response.ok) throw new Error(`Audio ${asset.id}: HTTP ${response.status}`);
        const decoded = await context.decodeAudioData(await response.arrayBuffer());
        decodedBytes += decoded.length * 8;
        if (decodedBytes > 256 * 1024 * 1024) throw new Error('Decoded audio exceeds the 256 MiB session budget.');
        // Offline Web Audio performs the browser channel downmix and sample-rate conversion.
        const offline = new OfflineAudioContext(2, Math.ceil(decoded.duration * 48000), 48000);
        const source = offline.createBufferSource();
        source.buffer = decoded;
        // Match FFmpeg's equal-power mono-to-stereo upmix instead of doubling mono power.
        const normalization = offline.createGain();
        normalization.gain.value = decoded.numberOfChannels === 1 ? Math.SQRT1_2 : 1;
        source.connect(normalization);
        normalization.connect(offline.destination);
        source.start();
        const stereo = await offline.startRendering();
        const pcm = new Float32Array(stereo.length * 2);
        const left = stereo.getChannelData(0), right = stereo.getChannelData(1);
        for (let i = 0; i < stereo.length; i++) { pcm[i * 2] = left[i]; pcm[i * 2 + 1] = right[i]; }
        mixer.add_asset(asset.id, pcm);
      }
      const output = context.createGain();
      output.gain.value = 0;
      output.connect(context.destination);
      return new MotionLoomAudio(mixer, context, output);
    } catch (error) {
      mixer.free(); await context?.close(); throw error;
    }
  }

  /** Render an absolute sample range for both preview and offline export. */
  buffer(start: number, frames: number): AudioBuffer {
    const pcm = this.mixer.render(start, frames);
    const result = this.context.createBuffer(2, frames, this.sampleRate);
    const left = result.getChannelData(0), right = result.getChannelData(1);
    for (let i = 0; i < frames; i++) { left[i] = pcm[i * 2]; right[i] = pcm[i * 2 + 1]; }
    return result;
  }

  /** Schedule ahead against AudioContext time, then let the visual timeline follow it. */
  play(time: number, duration: number, onError: (error: unknown) => void) {
    this.pause();
    // Keep the UI on Play when asynchronous loading has outlived the user gesture.
    if (this.context.state !== 'running' && !navigator.userActivation?.isActive) return false;
    this.playing = true;
    this.startTimeline = time;
    this.startClock = this.context.currentTime + 0.05;
    this.scheduledSamples = 0;
    const total = Math.max(1, Math.round(duration * this.sampleRate));
    const pump = () => {
      if (!this.playing || this.disposed) return;
      try {
        // Recover from background-tab throttling without replaying stale queued audio.
        const elapsed = Math.max(0, this.context.currentTime - this.startClock);
        this.scheduledSamples = Math.max(this.scheduledSamples, Math.floor(elapsed * this.sampleRate));
        while (this.startClock + this.scheduledSamples / this.sampleRate < this.context.currentTime + 0.3) {
          const absolute = Math.round(this.startTimeline * this.sampleRate) + this.scheduledSamples;
          const start = absolute % total;
          const frames = Math.min(4096, total - start);
          const source = this.context.createBufferSource();
          source.buffer = this.buffer(start, frames);
          source.connect(this.output);
          this.sources.add(source);
          source.onended = () => { this.sources.delete(source); source.disconnect(); };
          source.start(this.startClock + this.scheduledSamples / this.sampleRate);
          this.scheduledSamples += frames;
        }
      } catch (error) { this.pause(); onError(error); }
    };
    pump();
    this.timer = setInterval(pump, 50);
    void this.context.resume().catch(error => { this.pause(); onError(error); });
    return true;
  }
  time(duration: number): number {
    return (this.startTimeline + Math.max(0, this.context.currentTime - this.startClock)) % duration;
  }
  pause() {
    this.playing = false;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    for (const source of this.sources) { source.stop(); source.disconnect(); }
    this.sources.clear();
  }
  setMuted(muted: boolean) {
    this.output.gain.setValueAtTime(muted ? 0 : 1, this.context.currentTime);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pause(); this.output.disconnect(); this.mixer.free(); void this.context.close();
  }
}

declare global {
  interface Window {
    motionloomCreateAudio?: typeof MotionLoomAudio.create;
  }
}
