/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private isMusicPlaying = false;
  private musicTimeout: any = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);
  }

  // Stop everything on cleanup
  stopAll() {
    if (this.musicTimeout) clearTimeout(this.musicTimeout);
    this.isMusicPlaying = false;
  }

  // Play a simple "ding" sound
  playCollect() {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.1);
    
    g.gain.setValueAtTime(0.5, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    
    osc.connect(g);
    g.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Play a simple explosion sound
  playExplosion() {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);
    
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(1, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    
    noise.start();
  }

  // Play jump sound
  playJump() {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    
    g.gain.setValueAtTime(0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(g);
    g.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Looping 8-bit BGM
  playMusic() {
    if (!this.ctx || !this.masterGain || this.isMusicPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isMusicPlaying = true;
    
    const tempo = 120;
    const quarterNote = 60 / tempo;
    
    const melody = [
      60, 64, 67, 72, 60, 64, 67, 72,
      62, 65, 69, 74, 62, 65, 69, 74,
      59, 62, 67, 71, 59, 62, 67, 71,
      60, 64, 67, 72, 60, 64, 67, 72
    ];

    const playNote = (midi: number, time: number) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), time);
      g.gain.setValueAtTime(0.05, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + quarterNote * 0.8);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + quarterNote * 0.8);
    };

    const loop = () => {
      if (!this.isMusicPlaying || !this.ctx) return;
      let time = this.ctx.currentTime + 0.1;
      for (let i = 0; i < melody.length; i++) {
        playNote(melody[i], time);
        time += quarterNote / 2;
      }
      this.musicTimeout = setTimeout(loop, melody.length * (60 / tempo / 2) * 1000);
    };

    loop();
  }
}

export const audio = new GameAudio();
