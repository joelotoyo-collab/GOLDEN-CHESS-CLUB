// Web Audio sound engine — generates all sounds procedurally, no audio files needed.

type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private isMusicPlaying = false;

  private ensureContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.masterGain);
  }

  resume() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.ensureContext();
    if (!this.masterGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.15);
  }

  private playTone(freq: number, duration: number, type: OscillatorType, gainValue: number, delay = 0, destination?: GainNode) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(destination ?? this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  private playNoise(duration: number, gainValue: number, filterFreq: number, delay = 0) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
    source.stop(now + duration);
  }

  // Distinct tone profile per piece type — wooden, mellow, with character.
  private readonly pieceFreqs: Record<PieceType, number[]> = {
    pawn: [261.63, 329.63],
    knight: [392, 493.88, 587.33],
    bishop: [349.23, 440, 523.25],
    rook: [196, 261.63, 329.63],
    queen: [523.25, 659.25, 783.99, 1046.5],
    king: [174.61, 261.63, 349.23, 440],
  };

  playMove(pieceType: PieceType, isCapture: boolean) {
    this.ensureContext();
    this.resume();
    if (!this.ctx) return;
    const freqs = this.pieceFreqs[pieceType];
    const baseDelay = 0;
    freqs.forEach((freq, i) => {
      this.playTone(freq, 0.32, 'triangle', 0.22, baseDelay + i * 0.045);
    });
    // Soft wood-knock body
    this.playTone(110, 0.12, 'sine', 0.18, 0.02);
    if (isCapture) {
      this.playNoise(0.18, 0.25, 1800, 0.04);
      this.playTone(82.41, 0.35, 'sawtooth', 0.18, 0.04);
      this.playTone(130.81, 0.3, 'square', 0.12, 0.06);
    }
  }

  playSelect() {
    this.ensureContext();
    this.resume();
    this.playTone(523.25, 0.08, 'sine', 0.12);
  }

  playWin() {
    this.ensureContext();
    this.resume();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.5, 'triangle', 0.28, i * 0.12);
      this.playTone(freq / 2, 0.5, 'sine', 0.12, i * 0.12);
    });
  }

  // Ambient generative background music — slow, calm, golden-hour vibe.
  private readonly scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
  private readonly bassNotes = [65.41, 73.42, 82.41, 98, 110, 130.81];

  startMusic() {
    this.ensureContext();
    this.resume();
    if (this.isMusicPlaying || !this.ctx || !this.musicGain) return;
    this.isMusicPlaying = true;
    this.musicStep = 0;
    const stepDuration = 1.6;
    const playStep = () => {
      if (!this.ctx || !this.musicGain || !this.isMusicPlaying) return;
      const now = this.ctx.currentTime;
      // Melody — gentle triangle/sine tones from the scale
      if (this.musicStep % 2 === 0 || Math.random() > 0.4) {
        const note = this.scale[Math.floor(Math.random() * this.scale.length)];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.3);
        gain.gain.linearRampToValueAtTime(0.1, now + stepDuration * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + stepDuration);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + stepDuration + 0.1);
      }
      // Bass — slow drone underpinning
      if (this.musicStep % 4 === 0) {
        const bass = this.bassNotes[Math.floor(Math.random() * this.bassNotes.length)];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = bass;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + stepDuration * 4);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + stepDuration * 4 + 0.1);
      }
      // Sparkle — occasional high harmonic shimmer
      if (this.musicStep % 8 === 6) {
        const sparkle = this.scale[Math.floor(Math.random() * this.scale.length)] * 2;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = sparkle;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 1.3);
      }
      this.musicStep += 1;
      this.musicTimer = window.setTimeout(playStep, stepDuration * 1000);
    };
    playStep();
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const sound = new SoundEngine();
