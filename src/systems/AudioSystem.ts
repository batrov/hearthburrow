/** Procedural audio engine using Web Audio API synthesis (no asset files). */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private _masterVolume: number = 1;
  private _sfxVolume: number = 0.6;

  get masterVolume(): number { return this._masterVolume; }
  get sfxVolume(): number { return this._sfxVolume; }

  /** Set master volume (0-1). */
  setMasterVolume(v: number): void {
    this._masterVolume = v;
    if (this.masterGain) this.masterGain.gain.setValueAtTime(v, this.ctx!.currentTime);
  }

  /** Set SFX volume (0-1). */
  setSfxVolume(v: number): void {
    this._sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.setValueAtTime(v, this.ctx!.currentTime);
  }

  /** Initialize Web Audio context and gain nodes. Call once on boot. */
  init(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this._masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this._sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    } catch {
      this.ctx = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playNote(type: OscillatorType, freq: number, freqEnd: number, vol: number, dur: number, delay: number = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur);
  }

  /** Short percussive square wave — pitch scales with tile durability. */
  playMineHit(durability: number = 3): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const pitch = Math.max(80, 160 + durability * 35);
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  /** Low thud for wall hit — lower and heavier than ore mining. */
  playWallHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  /** Low rumble for wall break — deeper than wall hit. */
  playWallBreak(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 0.6);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    source.start(ctx.currentTime);
  }

  /** Ascending sine chime for generic item pickup. */
  playItemPickup(durability?: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = durability != null ? Math.max(120, 200 + durability * 70) : 523;
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.setValueAtTime(base * 1.25, ctx.currentTime + 0.06);
    osc.frequency.setValueAtTime(base * 1.5, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  /** Sine sweep up (descend) or down (ascend). */
  playStairs(ascending: boolean = true): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (ascending) {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3);
    }
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  }

  /** Short noise burst for footsteps. */
  playStep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.04;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    source.connect(gain);
    gain.connect(this.sfxGain!);
    source.start(ctx.currentTime);
  }

  /** Sharp mid-frequency hit. */
  playCombatHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  /** Pokémon-style super effective hit — bright double-snap with rising zing. */
  playCombatCrit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // ── Helper: one "smack" layer ─────────────────────────────────────────────
    const makeSmack = (startTime: number, freqStart: number, freqEnd: number, gainPeak: number) => {
      // Square wave with fast pitch rise (Game Boy pulse character)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freqStart, startTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + 0.05);
      gain.gain.setValueAtTime(gainPeak, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.07);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.08);

      // Click transient — very short noise burst for the attack "crack"
      const clickSize = Math.floor(ctx.sampleRate * 0.008);
      const clickBuf = ctx.createBuffer(1, clickSize, ctx.sampleRate);
      const clickData = clickBuf.getChannelData(0);
      for (let i = 0; i < clickSize; i++) {
        clickData[i] = (Math.random() * 2 - 1) * (1 - i / clickSize);
      }
      const click = ctx.createBufferSource();
      click.buffer = clickBuf;
      const clickGain = ctx.createGain();
      const clickHp = ctx.createBiquadFilter();
      clickHp.type = 'highpass';
      clickHp.frequency.value = 2000;
      clickGain.gain.setValueAtTime(0.3, startTime);
      click.connect(clickHp);
      clickHp.connect(clickGain);
      clickGain.connect(this.sfxGain!);
      click.start(startTime);
    };

    // ── Hit 1: first smack (lower, punchier) ──────────────────────────────────
    makeSmack(t, 320, 900, 0.28);

    // ── Hit 2: second smack (higher, brighter — the "super effective" zing) ──
    // Offset by ~80ms to create the classic Pokémon da-DUM double hit
    makeSmack(t + 0.08, 520, 1600, 0.35);

    // ── Zing tail: bright sine shimmer on the second hit ──────────────────────
    // The tiny metallic "eeee" ring that lingers after the second smack
    const zing = ctx.createOscillator();
    const zingGain = ctx.createGain();
    zing.type = 'sine';
    zing.frequency.setValueAtTime(2200, t + 0.08);
    zing.frequency.exponentialRampToValueAtTime(3200, t + 0.18);
    zingGain.gain.setValueAtTime(0.12, t + 0.08);
    zingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    zing.connect(zingGain);
    zingGain.connect(this.sfxGain!);
    zing.start(t + 0.08);
    zing.stop(t + 0.23);
  }

  /** Triple-smack super crit — like playCombatCrit but with a third harder hit and higher zing. */
  playCombatSuperCrit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const makeSmack = (startTime: number, freqStart: number, freqEnd: number, gainPeak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freqStart, startTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + 0.05);
      gain.gain.setValueAtTime(gainPeak, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.07);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.08);

      const clickSize = Math.floor(ctx.sampleRate * 0.008);
      const clickBuf = ctx.createBuffer(1, clickSize, ctx.sampleRate);
      const clickData = clickBuf.getChannelData(0);
      for (let i = 0; i < clickSize; i++) {
        clickData[i] = (Math.random() * 2 - 1) * (1 - i / clickSize);
      }
      const click = ctx.createBufferSource();
      click.buffer = clickBuf;
      const clickGain = ctx.createGain();
      const clickHp = ctx.createBiquadFilter();
      clickHp.type = 'highpass';
      clickHp.frequency.value = 2000;
      clickGain.gain.setValueAtTime(0.3, startTime);
      click.connect(clickHp);
      clickHp.connect(clickGain);
      clickGain.connect(this.sfxGain!);
      click.start(startTime);
    };

    // Hit 1 (punchy)
    makeSmack(t, 320, 900, 0.28);
    // Hit 2 (brighter)
    makeSmack(t + 0.08, 520, 1600, 0.35);
    // Hit 3 (hardest, highest)
    makeSmack(t + 0.16, 720, 2400, 0.40);

    // Zing tail — higher and longer than regular crit
    const zing = ctx.createOscillator();
    const zingGain = ctx.createGain();
    zing.type = 'sine';
    zing.frequency.setValueAtTime(3000, t + 0.16);
    zing.frequency.exponentialRampToValueAtTime(4000, t + 0.30);
    zingGain.gain.setValueAtTime(0.15, t + 0.16);
    zingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    zing.connect(zingGain);
    zingGain.connect(this.sfxGain!);
    zing.start(t + 0.16);
    zing.stop(t + 0.36);
  }

  /** Low buzz for missed strikes. */
  playCombatMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  /** Ascending arpeggio on combat victory. */
  playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  /** Majestic 3-second boss victory fanfare. */
  playBossVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Phase 1 (0-0.6s): low ominous chord — C2+E2+G2 triangle pad
    [131, 165, 196].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.linearRampToValueAtTime(0.001, t + 3.0);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 3.0);
    });

    // Phase 2 (0.6-1.2s): F2+A2+C3 swell (hope building)
    [175, 220, 262].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + 0.6);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.6);
      gain.gain.linearRampToValueAtTime(0.001, t + 2.0);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 2.0);
    });

    // Phase 3 (1.2-1.8s): G2+B2+D3 rising tension
    [196, 247, 294].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + 1.2);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.10, t + 1.2);
      gain.gain.linearRampToValueAtTime(0.001, t + 2.4);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 2.4);
    });

    // Phase 4 (1.8-2.2s): fast ascending arpeggio C3→E3→G3→C4
    [262, 330, 392, 523].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const noteT = t + 1.8 + i * 0.1;
      osc.frequency.setValueAtTime(freq, noteT);
      gain.gain.setValueAtTime(0.12, noteT);
      gain.gain.exponentialRampToValueAtTime(0.001, noteT + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(noteT);
      osc.stop(noteT + 0.35);
    });

    // Phase 5 (2.2-3.0s): full C major sustained chord with shimmer
    [262, 330, 392, 523].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + 2.2);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 2.2);
      gain.gain.linearRampToValueAtTime(0.001, t + 3.0);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 3.0);
    });

    // Shimmer: high triangle harmonics on top
    [1047, 1319, 1568].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + 2.2);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 2.2);
      gain.gain.linearRampToValueAtTime(0.001, t + 3.0);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 3.0);
    });
  }

  playError(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  /** Low noise burst for mining bomb detonation. */
  playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    source.start(ctx.currentTime);
  }

  playPotion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    [300, 500, 700].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  playCombatStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  playExtraction(type: 'safe' | 'emergency'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (type === 'safe') {
      const notes = [261.63, 329.63, 392, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.15;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } else {
      const notes = [196, 155.56, 130.81, 98];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = ctx.currentTime + i * 0.12;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    }
  }

  /** Descending tone for stamina exhaustion. */
  playExhaustion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  }

  playPlatePress(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  playPuzzleComplete(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [659, 784, 880, 1047, 1319];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /** Rhythmic hammer clanks — 8 strikes over ~5s for building construction. */
  playConstruction(): void {
    for (let i = 0; i < 8; i++) {
      this.playNote('square', 250, 180, 0.08, 0.1, i * 0.6);
    }
  }

  /** Triumphant rising arpeggio for building completion. */
  playBuildComplete(): void {
    this.playNote('sine', 523, 523, 0.1, 0.3, 0);
    this.playNote('sine', 659, 659, 0.1, 0.3, 0.15);
    this.playNote('sine', 784, 784, 0.1, 0.3, 0.3);
    this.playNote('sine', 1047, 1047, 0.12, 0.5, 0.45);
    this.playNote('triangle', 523, 523, 0.05, 0.6, 0.45);
    this.playNote('triangle', 659, 659, 0.05, 0.6, 0.45);
    this.playNote('triangle', 784, 784, 0.05, 0.6, 0.45);
  }

  /** Triumphant expanding fanfare for player level-up. */
  playLevelUp(): void {
    this.playNote('triangle', 523, 523, 0.08, 0.3, 0);
    this.playNote('triangle', 659, 659, 0.08, 0.3, 0.1);
    this.playNote('triangle', 784, 784, 0.08, 0.3, 0.2);
    this.playNote('sine', 1047, 1047, 0.12, 0.6, 0.3);
    this.playNote('sine', 784, 784, 0.04, 0.6, 0.3);
    this.playNote('sine', 523, 523, 0.04, 0.6, 0.3);
  }

  playResourcePickup(resourceId: string): void {
    switch (resourceId) {
      case 'stone':
        this.playNote('sine', 700, 250, 0.14, 0.1);
        this.playNote('sine', 1100, 800, 0.07, 0.06, 0.01);
        break;
      case 'bronze_ore': this.playNote('square', 400, 800, 0.05, 0.08); break;
      case 'silver_ore': this.playNote('square', 600, 1000, 0.05, 0.07); break;
      case 'gold_ore':
        this.playNote('sine', 880, 1320, 0.06, 0.15);
        this.playNote('sine', 1320, 1320, 0.04, 0.1, 0.05);
        break;
      case 'crystal':
        [660, 880, 1100].forEach((freq, i) => this.playNote('sine', freq, freq, 0.07, 0.12, i * 0.04));
        break;
      case 'monster_drop':
        this.playNote('triangle', 220, 220, 0.08, 0.25, 0);
        this.playNote('sine', 294, 294, 0.06, 0.2, 0.06);
        this.playNote('sine', 349, 349, 0.06, 0.2, 0.12);
        this.playNote('sine', 440, 440, 0.08, 0.35, 0.18);
        break;
      default: this.playNote('triangle', 300, 100, 0.05, 0.1); break;
    }
  }

  /** Gentle bubbling water sound for stamina fountain restoration. */
  playFountain(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Water bubble — bandpass noise burst
    const bufferSize = ctx.sampleRate * 0.45;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 0.3);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.45);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    noise.start(ctx.currentTime);

    // Magical shimmer — ascending sine chord
    [660, 880, 1100, 1320].forEach((freq, i) => {
      this.playNote('sine', freq, freq, 0.06, 0.25, i * 0.08 + 0.05);
    });
  }

  /** Bright descending arpeggio for carrot currency pickup. */
  playCarrotPickup(): void {
    this.playNote('sine', 880, 880, 0.08, 0.06, 0);
    this.playNote('sine', 660, 660, 0.08, 0.06, 0.05);
    this.playNote('sine', 440, 440, 0.10, 0.10, 0.10);
  }

  /** Rumble + chime for discovering the hidden secret passage. */
  playSecretDiscovery(): void {
    this.playNote('sawtooth', 80, 40, 0.12, 0.3, 0);
    this.playNote('sawtooth', 60, 30, 0.08, 0.4, 0.1);
    this.playNote('sine', 300, 900, 0.1, 0.4, 0.15);
    this.playNote('sine', 900, 1200, 0.07, 0.3, 0.35);
    this.playNote('sine', 1400, 1400, 0.06, 0.4, 0.45);
  }

  /** Short rising ping for regen boots stamina tick. */
  playRegen(): void {
    this.playNote('sine', 660, 880, 0.12, 0.15, 0);
  }

  /** Ascending casino-style chime for roulette wins. */
  playBingo(): void {
    this.playNote('sine', 523, 523, 0.1, 0.08, 0);
    this.playNote('sine', 659, 659, 0.1, 0.08, 0.08);
    this.playNote('sine', 784, 784, 0.1, 0.08, 0.16);
    this.playNote('sine', 1047, 1047, 0.12, 0.25, 0.24);
    this.playNote('triangle', 523, 523, 0.04, 0.4, 0.24);
    this.playNote('triangle', 659, 659, 0.04, 0.4, 0.24);
    this.playNote('triangle', 784, 784, 0.04, 0.4, 0.24);
  }
}

export const audio = new AudioSystem();
