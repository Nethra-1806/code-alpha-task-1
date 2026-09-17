/**
 * PulseFit - Workout & Interval Timer with Web Audio API Sound Generator
 */

import { store } from './store.js';

class AudioSynthesizer {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq = 440, type = 'sine', duration = 0.15, gain = 0.15) {
    if (!store.getProfile().soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playCountdownBeep() {
    this.playTone(600, 'sine', 0.1, 0.15);
  }

  playWorkChime() {
    // High energetic double beep
    this.playTone(880, 'triangle', 0.15, 0.2);
    setTimeout(() => this.playTone(1200, 'triangle', 0.25, 0.25), 120);
  }

  playRestChime() {
    // Calming lower chord
    this.playTone(440, 'sine', 0.3, 0.2);
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.2), i * 140);
    });
  }
}

export const audio = new AudioSynthesizer();

export class WorkoutTimer {
  constructor(onTick, onPhaseChange, onFinish) {
    this.onTick = onTick;
    this.onPhaseChange = onPhaseChange;
    this.onFinish = onFinish;

    this.mode = 'stopwatch'; // 'stopwatch' | 'hiit'
    this.isRunning = false;
    this.timerId = null;

    // Stopwatch state
    this.stopwatchSeconds = 0;
    this.laps = [];

    // HIIT state
    this.prepTime = 5;
    this.workTime = 30;
    this.restTime = 15;
    this.totalRounds = 8;

    this.currentRound = 1;
    this.phase = 'prep'; // 'prep' | 'work' | 'rest' | 'finished'
    this.phaseSecondsLeft = 5;
  }

  setMode(mode) {
    this.reset();
    this.mode = mode;
  }

  start() {
    audio.init();
    if (this.isRunning) return;
    this.isRunning = true;

    if (this.mode === 'stopwatch') {
      this.timerId = setInterval(() => {
        this.stopwatchSeconds++;
        this.onTick({
          mode: 'stopwatch',
          seconds: this.stopwatchSeconds
        });
      }, 1000);
    } else {
      // HIIT mode
      this.timerId = setInterval(() => {
        this.tickHIIT();
      }, 1000);
    }
  }

  pause() {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  reset() {
    this.pause();
    this.stopwatchSeconds = 0;
    this.laps = [];

    this.currentRound = 1;
    this.phase = 'prep';
    this.phaseSecondsLeft = this.prepTime;

    if (this.onTick) {
      this.onTick({
        mode: this.mode,
        seconds: this.mode === 'stopwatch' ? 0 : this.phaseSecondsLeft,
        round: this.currentRound,
        totalRounds: this.totalRounds,
        phase: this.phase
      });
    }
  }

  configureHIIT(prep, work, rest, rounds) {
    this.prepTime = Number(prep) || 5;
    this.workTime = Number(work) || 30;
    this.restTime = Number(rest) || 15;
    this.totalRounds = Number(rounds) || 8;
    this.reset();
  }

  tickHIIT() {
    this.phaseSecondsLeft--;

    // Countdown audio cues in last 3 seconds
    if (this.phaseSecondsLeft <= 3 && this.phaseSecondsLeft > 0) {
      audio.playCountdownBeep();
    }

    if (this.phaseSecondsLeft <= 0) {
      this.switchHIITPhase();
    } else {
      this.onTick({
        mode: 'hiit',
        seconds: this.phaseSecondsLeft,
        round: this.currentRound,
        totalRounds: this.totalRounds,
        phase: this.phase
      });
    }
  }

  switchHIITPhase() {
    if (this.phase === 'prep') {
      this.phase = 'work';
      this.phaseSecondsLeft = this.workTime;
      audio.playWorkChime();
    } else if (this.phase === 'work') {
      if (this.currentRound >= this.totalRounds) {
        // Workout Complete!
        this.phase = 'finished';
        this.phaseSecondsLeft = 0;
        this.pause();
        audio.playVictory();
        if (this.onFinish) {
          const totalDurationMins = Math.max(1, Math.round((this.prepTime + (this.workTime + this.restTime) * this.totalRounds) / 60));
          this.onFinish(totalDurationMins);
        }
        return;
      } else {
        this.phase = 'rest';
        this.phaseSecondsLeft = this.restTime;
        audio.playRestChime();
      }
    } else if (this.phase === 'rest') {
      this.currentRound++;
      this.phase = 'work';
      this.phaseSecondsLeft = this.workTime;
      audio.playWorkChime();
    }

    if (this.onPhaseChange) {
      this.onPhaseChange(this.phase, this.currentRound);
    }

    this.onTick({
      mode: 'hiit',
      seconds: this.phaseSecondsLeft,
      round: this.currentRound,
      totalRounds: this.totalRounds,
      phase: this.phase
    });
  }

  recordLap() {
    if (this.mode !== 'stopwatch' || !this.isRunning) return null;
    const lapTime = this.stopwatchSeconds;
    this.laps.push(lapTime);
    return {
      lapIndex: this.laps.length,
      time: lapTime
    };
  }
}
