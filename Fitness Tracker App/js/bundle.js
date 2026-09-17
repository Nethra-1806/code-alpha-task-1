/**
 * PulseFit - Standalone Bundle
 * Allows PulseFit to run immediately both over HTTP and via direct double-click (file:// protocol)
 * without CORS restrictions in any browser.
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. Calculations & Constants
  // =========================================================================
  const ACTIVITY_METS = {
    running: { name: 'Running (Jogging 8 km/h)', met: 8.5, icon: 'zap', color: '#ff3366', category: 'Cardio' },
    walking: { name: 'Walking (Brisk 5 km/h)', met: 3.8, icon: 'footprints', color: '#10b981', category: 'Cardio' },
    cycling: { name: 'Cycling (Moderate 20 km/h)', met: 7.5, icon: 'bike', color: '#3b82f6', category: 'Cardio' },
    strength: { name: 'Strength / Weightlifting', met: 5.0, icon: 'dumbbell', color: '#f59e0b', category: 'Strength' },
    hiit: { name: 'HIIT / Circuit Training', met: 8.5, icon: 'flame', color: '#ec4899', category: 'HIIT' },
    yoga: { name: 'Yoga & Mobility', met: 3.0, icon: 'heart', color: '#8b5cf6', category: 'Flexibility' },
    swimming: { name: 'Swimming (Freestyle)', met: 8.0, icon: 'waves', color: '#06b6d4', category: 'Cardio' },
    jumprope: { name: 'Jump Rope', met: 10.0, icon: 'activity', color: '#f43f5e', category: 'Cardio' },
    calisthenics: { name: 'Calisthenics / Bodyweight', met: 5.5, icon: 'user', color: '#eab308', category: 'Strength' },
    custom: { name: 'Other Activity', met: 4.5, icon: 'award', color: '#6366f1', category: 'Other' }
  };

  const INTENSITY_MULTIPLIERS = {
    light: 0.85,
    moderate: 1.0,
    vigorous: 1.25,
    extreme: 1.5
  };

  function calculateCalories(activityType, durationMinutes, weightKg = 70, intensity = 'moderate') {
    const metData = ACTIVITY_METS[activityType] || ACTIVITY_METS.custom;
    const met = metData.met;
    const multiplier = INTENSITY_MULTIPLIERS[intensity] || 1.0;
    if (!durationMinutes || durationMinutes <= 0) return 0;
    return Math.round((met * 3.5 * weightKg / 200) * durationMinutes * multiplier);
  }

  function formatDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function calculateStreak(activities, dailySteps = {}) {
    const activeDates = new Set();
    activities.forEach(act => {
      if (act.date) activeDates.add(act.date.split('T')[0]);
    });
    Object.keys(dailySteps).forEach(date => {
      if (dailySteps[date] >= 3000) activeDates.add(date);
    });

    if (activeDates.size === 0) return { currentStreak: 0, bestStreak: 0 };

    const today = new Date();
    const todayKey = formatDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterday);

    let currentStreak = 0;
    let checkDate = new Date(today);

    if (!activeDates.has(todayKey) && !activeDates.has(yesterdayKey)) {
      currentStreak = 0;
    } else {
      if (!activeDates.has(todayKey)) checkDate = yesterday;
      while (true) {
        const key = formatDateKey(checkDate);
        if (activeDates.has(key)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const sortedDates = Array.from(activeDates).sort();
    let bestStreak = 0;
    let tempStreak = 0;
    let prevDate = null;

    for (const dateStr of sortedDates) {
      const currDate = new Date(dateStr);
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) tempStreak++;
        else if (diffDays > 1) tempStreak = 1;
      }
      if (tempStreak > bestStreak) bestStreak = tempStreak;
      prevDate = currDate;
    }

    return { currentStreak, bestStreak: Math.max(bestStreak, currentStreak) };
  }

  // =========================================================================
  // 2. Storage & Persistence
  // =========================================================================
  const STORAGE_KEYS = {
    PROFILE: 'pulsefit_profile',
    ACTIVITIES: 'pulsefit_activities',
    HYDRATION: 'pulsefit_hydration',
    STEPS: 'pulsefit_steps',
    BADGES: 'pulsefit_badges',
    HAS_SEEDED: 'pulsefit_seeded'
  };

  const DEFAULT_PROFILE = {
    name: 'Alex Rider',
    weight: 70,
    height: 175,
    age: 28,
    calorieTarget: 600,
    exerciseTarget: 45,
    stepTarget: 10000,
    waterTarget: 2500,
    theme: 'dark',
    soundEnabled: true
  };

  class FitnessStore {
    constructor() {
      this.profile = this.load(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
      this.activities = this.load(STORAGE_KEYS.ACTIVITIES, []);
      this.hydration = this.load(STORAGE_KEYS.HYDRATION, {});
      this.steps = this.load(STORAGE_KEYS.STEPS, {});
      this.badges = this.load(STORAGE_KEYS.BADGES, []);

      if (!localStorage.getItem(STORAGE_KEYS.HAS_SEEDED)) {
        this.seedSampleData();
      }
    }

    load(key, fallback) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
      } catch (e) {
        return fallback;
      }
    }

    save(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {}
    }

    getProfile() { return { ...this.profile }; }

    updateProfile(updates) {
      this.profile = { ...this.profile, ...updates };
      this.save(STORAGE_KEYS.PROFILE, this.profile);
      return this.profile;
    }

    getActivities(dateKey = null) {
      if (!dateKey) return [...this.activities].sort((a, b) => new Date(b.date) - new Date(a.date));
      return this.activities
        .filter(act => act.date.startsWith(dateKey))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    addActivity(activity) {
      const newActivity = {
        id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        date: activity.date || new Date().toISOString(),
        type: activity.type || 'running',
        name: activity.name || 'Workout',
        duration: Number(activity.duration) || 30,
        calories: Number(activity.calories) || 0,
        distance: activity.distance ? Number(activity.distance) : null,
        intensity: activity.intensity || 'moderate',
        notes: activity.notes || ''
      };
      this.activities.unshift(newActivity);
      this.save(STORAGE_KEYS.ACTIVITIES, this.activities);
      return newActivity;
    }

    deleteActivity(id) {
      this.activities = this.activities.filter(a => a.id !== id);
      this.save(STORAGE_KEYS.ACTIVITIES, this.activities);
    }

    getHydration(dateKey = formatDateKey(new Date())) {
      return this.hydration[dateKey] || 0;
    }

    addHydration(ml, dateKey = formatDateKey(new Date())) {
      const current = this.hydration[dateKey] || 0;
      const updated = Math.max(0, current + ml);
      this.hydration[dateKey] = updated;
      this.save(STORAGE_KEYS.HYDRATION, this.hydration);
      return updated;
    }

    setHydration(ml, dateKey = formatDateKey(new Date())) {
      this.hydration[dateKey] = Math.max(0, ml);
      this.save(STORAGE_KEYS.HYDRATION, this.hydration);
      return this.hydration[dateKey];
    }

    getSteps(dateKey = formatDateKey(new Date())) {
      return this.steps[dateKey] || 0;
    }

    addSteps(count, dateKey = formatDateKey(new Date())) {
      const current = this.steps[dateKey] || 0;
      const updated = Math.max(0, current + count);
      this.steps[dateKey] = updated;
      this.save(STORAGE_KEYS.STEPS, this.steps);
      return updated;
    }

    getUnlockedBadges() { return [...this.badges]; }

    unlockBadge(badgeId) {
      if (!this.badges.includes(badgeId)) {
        this.badges.push(badgeId);
        this.save(STORAGE_KEYS.BADGES, this.badges);
        return true;
      }
      return false;
    }

    getDailySummary(dateKey = formatDateKey(new Date())) {
      const dayActivities = this.activities.filter(a => a.date.startsWith(dateKey));
      let totalCalories = 0;
      let totalMinutes = 0;
      let totalDistance = 0;

      dayActivities.forEach(act => {
        totalCalories += act.calories || 0;
        totalMinutes += act.duration || 0;
        totalDistance += act.distance || 0;
      });

      const steps = this.getSteps(dateKey);
      const stepCalories = Math.round(steps * 0.04);
      const combinedCalories = totalCalories + stepCalories;
      const hydration = this.getHydration(dateKey);

      return {
        date: dateKey,
        calories: combinedCalories,
        workoutCalories: totalCalories,
        stepCalories,
        exerciseMinutes: totalMinutes,
        steps,
        hydration,
        distance: +(totalDistance + (steps * 0.00078)).toFixed(2),
        activitiesCount: dayActivities.length
      };
    }

    getHistory(days = 7) {
      const history = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = formatDateKey(d);
        const summary = this.getDailySummary(key);
        history.push({
          ...summary,
          dayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
          dateLabel: `${d.getMonth() + 1}/${d.getDate()}`
        });
      }
      return history;
    }

    getCategoryBreakdown(days = 7) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const relevant = this.activities.filter(a => new Date(a.date) >= cutoff);
      const totals = { Cardio: 0, Strength: 0, HIIT: 0, Flexibility: 0, Other: 0 };

      relevant.forEach(act => {
        const type = act.type || 'other';
        if (['running', 'walking', 'cycling', 'swimming', 'jumprope'].includes(type)) totals.Cardio += act.duration;
        else if (['strength', 'calisthenics'].includes(type)) totals.Strength += act.duration;
        else if (type === 'hiit') totals.HIIT += act.duration;
        else if (type === 'yoga') totals.Flexibility += act.duration;
        else totals.Other += act.duration;
      });
      return totals;
    }

    exportData() {
      return JSON.stringify({
        pulseFitVersion: '1.0',
        exportedAt: new Date().toISOString(),
        profile: this.profile,
        activities: this.activities,
        hydration: this.hydration,
        steps: this.steps,
        badges: this.badges
      }, null, 2);
    }

    importData(jsonString) {
      try {
        const p = JSON.parse(jsonString);
        if (p.profile) this.profile = p.profile;
        if (p.activities) this.activities = p.activities;
        if (p.hydration) this.hydration = p.hydration;
        if (p.steps) this.steps = p.steps;
        if (p.badges) this.badges = p.badges;

        this.save(STORAGE_KEYS.PROFILE, this.profile);
        this.save(STORAGE_KEYS.ACTIVITIES, this.activities);
        this.save(STORAGE_KEYS.HYDRATION, this.hydration);
        this.save(STORAGE_KEYS.STEPS, this.steps);
        this.save(STORAGE_KEYS.BADGES, this.badges);
        return true;
      } catch (e) {
        return false;
      }
    }

    resetData() {
      localStorage.clear();
      this.profile = { ...DEFAULT_PROFILE };
      this.activities = [];
      this.hydration = {};
      this.steps = {};
      this.badges = [];
      this.save(STORAGE_KEYS.PROFILE, this.profile);
      this.save(STORAGE_KEYS.ACTIVITIES, this.activities);
      this.save(STORAGE_KEYS.HYDRATION, this.hydration);
      this.save(STORAGE_KEYS.STEPS, this.steps);
      this.save(STORAGE_KEYS.BADGES, this.badges);
      localStorage.setItem(STORAGE_KEYS.HAS_SEEDED, 'true');
    }

    seedSampleData() {
      const now = new Date();
      const demoActivities = [];
      const demoSteps = {};
      const demoHydration = {};

      const pastDays = [
        { daysAgo: 6, steps: 8420, water: 2250, act: { type: 'running', name: 'Morning Jog in the Park', dur: 35, cal: 320, dist: 4.8 } },
        { daysAgo: 5, steps: 11200, water: 2750, act: { type: 'strength', name: 'Upper Body Hypertrophy', dur: 50, cal: 280 } },
        { daysAgo: 4, steps: 9350, water: 2500, act: { type: 'hiit', name: 'Tabata Burner', dur: 25, cal: 260 } },
        { daysAgo: 3, steps: 7800, water: 2000, act: { type: 'yoga', name: 'Vinyasa Flow Recovery', dur: 45, cal: 150 } },
        { daysAgo: 2, steps: 12450, water: 3000, act: { type: 'cycling', name: 'Sunset Road Ride', dur: 55, cal: 460, dist: 16.5 } },
        { daysAgo: 1, steps: 10100, water: 2600, act: { type: 'strength', name: 'Legs & Core Workout', dur: 45, cal: 290 } },
        { daysAgo: 0, steps: 6850, water: 1750, act: { type: 'running', name: 'Lunch Interval Sprints', dur: 28, cal: 285, dist: 3.9 } }
      ];

      pastDays.forEach(item => {
        const d = new Date(now);
        d.setDate(d.getDate() - item.daysAgo);
        const dateKey = formatDateKey(d);
        demoSteps[dateKey] = item.steps;
        demoHydration[dateKey] = item.water;

        if (item.act) {
          demoActivities.push({
            id: 'seed_' + Math.random().toString(36).substr(2, 7),
            date: d.toISOString(),
            type: item.act.type,
            name: item.act.name,
            duration: item.act.dur,
            calories: item.act.cal,
            distance: item.act.dist || null,
            intensity: 'vigorous',
            notes: 'Great session!'
          });
        }
      });

      this.activities = demoActivities;
      this.steps = demoSteps;
      this.hydration = demoHydration;
      this.badges = ['first_workout', 'streak_3', 'step_master_10k'];

      this.save(STORAGE_KEYS.ACTIVITIES, this.activities);
      this.save(STORAGE_KEYS.STEPS, this.steps);
      this.save(STORAGE_KEYS.HYDRATION, this.hydration);
      this.save(STORAGE_KEYS.BADGES, this.badges);
      localStorage.setItem(STORAGE_KEYS.HAS_SEEDED, 'true');
    }
  }

  const store = new FitnessStore();

  // =========================================================================
  // 3. Web Audio Synthesizer
  // =========================================================================
  class AudioSynthesizer {
    constructor() { this.ctx = null; }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
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
      } catch (e) {}
    }

    playCountdownBeep() { this.playTone(600, 'sine', 0.1, 0.15); }

    playWorkChime() {
      this.playTone(880, 'triangle', 0.15, 0.2);
      setTimeout(() => this.playTone(1200, 'triangle', 0.25, 0.25), 120);
    }

    playRestChime() { this.playTone(440, 'sine', 0.3, 0.2); }

    playVictory() {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.2), i * 140);
      });
    }
  }

  const audio = new AudioSynthesizer();

  // =========================================================================
  // 4. Workout Timer Class
  // =========================================================================
  class WorkoutTimer {
    constructor(onTick, onPhaseChange, onFinish) {
      this.onTick = onTick;
      this.onPhaseChange = onPhaseChange;
      this.onFinish = onFinish;
      this.mode = 'stopwatch';
      this.isRunning = false;
      this.timerId = null;
      this.stopwatchSeconds = 0;
      this.laps = [];
      this.prepTime = 5;
      this.workTime = 30;
      this.restTime = 15;
      this.totalRounds = 8;
      this.currentRound = 1;
      this.phase = 'prep';
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
          this.onTick({ mode: 'stopwatch', seconds: this.stopwatchSeconds });
        }, 1000);
      } else {
        this.timerId = setInterval(() => this.tickHIIT(), 1000);
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
      if (this.phaseSecondsLeft <= 3 && this.phaseSecondsLeft > 0) audio.playCountdownBeep();
      if (this.phaseSecondsLeft <= 0) this.switchHIITPhase();
      else {
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
          this.phase = 'finished';
          this.phaseSecondsLeft = 0;
          this.pause();
          audio.playVictory();
          if (this.onFinish) {
            const totalMins = Math.max(1, Math.round((this.prepTime + (this.workTime + this.restTime) * this.totalRounds) / 60));
            this.onFinish(totalMins);
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

      if (this.onPhaseChange) this.onPhaseChange(this.phase, this.currentRound);
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
      return { lapIndex: this.laps.length, time: lapTime };
    }
  }

  // =========================================================================
  // 5. Gamification & Badges
  // =========================================================================
  const BADGES = [
    { id: 'first_workout', name: 'First Step', icon: '🏃', description: 'Logged your very first workout session!', check: s => s.activities.length >= 1 },
    { id: 'streak_3', name: 'Momentum', icon: '🔥', description: 'Achieved a 3-day active fitness streak!', check: s => calculateStreak(s.activities, s.steps).currentStreak >= 3 },
    { id: 'streak_7', name: 'Unstoppable', icon: '⚡', description: 'Maintained an unbroken 7-day workout streak!', check: s => calculateStreak(s.activities, s.steps).currentStreak >= 7 },
    { id: 'step_master_10k', name: '10K Club', icon: '👟', description: 'Crushed 10,000 steps in a single day!', check: s => Object.values(s.steps).some(v => v >= 10000) },
    { id: 'calorie_crusher', name: 'Calorie Torch', icon: '🌋', description: 'Burned 600+ active calories in a single day!', check: s => s.getDailySummary().calories >= 600 },
    { id: 'hydration_hero', name: 'Hydro Master', icon: '💧', description: 'Drank at least 2,500ml of water in a day!', check: s => Object.values(s.hydration).some(h => h >= 2500) },
    { id: 'hiit_warrior', name: 'HIIT Beast', icon: '💥', description: 'Crushed a High-Intensity Interval Training workout!', check: s => s.activities.some(a => a.type === 'hiit') },
    { id: 'century_distance', name: 'Trailblazer', icon: '🗺️', description: 'Logged over 25 km of total workout distance!', check: s => s.activities.reduce((sum, a) => sum + (a.distance || 0), 0) >= 25 },
    { id: 'early_bird', name: 'Dawn Patrol', icon: '🌅', description: 'Completed a workout session before 8:00 AM!', check: s => s.activities.some(a => new Date(a.date).getHours() < 8) },
    { id: 'night_owl', name: 'Night Warrior', icon: '🌙', description: 'Completed a workout session after 8:00 PM!', check: s => s.activities.some(a => new Date(a.date).getHours() >= 20) }
  ];

  function evaluateBadges() {
    const newlyUnlocked = [];
    const currentlyUnlocked = store.getUnlockedBadges();
    BADGES.forEach(b => {
      if (!currentlyUnlocked.includes(b.id) && b.check(store)) {
        store.unlockBadge(b.id);
        newlyUnlocked.push(b);
      }
    });
    return newlyUnlocked;
  }

  function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const colors = ['#ff3366', '#00f2fe', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6'];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        w: Math.random() * 9 + 5,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 18,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        alpha: 1,
        gravity: 0.35
      });
    }

    let animationId;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = 0;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.vRot;
        p.alpha -= 0.012;
        if (p.alpha > 0) {
          active++;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });
      if (active > 0) animationId = requestAnimationFrame(render);
      else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(animationId);
      }
    };
    render();
  }

  function getSmartCoachInsight(summary, profile) {
    const calPercent = Math.round((summary.calories / profile.calorieTarget) * 100);
    const stepPercent = Math.round((summary.steps / profile.stepTarget) * 100);
    const waterPercent = Math.round((summary.hydration / profile.waterTarget) * 100);

    if (calPercent >= 100 && stepPercent >= 100 && waterPercent >= 100) {
      return {
        title: 'Tri-Ring Masterpiece! 🌟',
        quote: "Outstanding dedication! You've completely conquered your calories, steps, and hydration targets today. Rest up and recover well!"
      };
    }
    if (calPercent >= 100) {
      return {
        title: 'Calorie Ring Closed! 🔥',
        quote: `You've scorched ${summary.calories} kcal, smashing today's target! Keep drinking water to rehydrate your muscle fibers.`
      };
    }
    if (calPercent < 50) {
      const needed = profile.calorieTarget - summary.calories;
      return {
        title: 'Afternoon Energy Boost ⚡',
        quote: `You have ${needed} kcal left to reach your goal today. A quick 20-minute jog or HIIT session will close the ring!`
      };
    }
    if (waterPercent < 60) {
      return {
        title: 'Hydration Check 💧',
        quote: `Your body is at ${waterPercent}% of its hydration goal. Drink a glass of fresh water right now to keep metabolic performance peaked!`
      };
    }
    if (stepPercent < 70) {
      return {
        title: 'Step Up Your Pace 👟',
        quote: `You're sitting at ${summary.steps.toLocaleString()} steps. A scenic evening walk can easily get you into five figures!`
      };
    }
    return {
      title: 'Consistency Is King 👑',
      quote: '"Small daily disciplines compound into massive transformations." Keep this energy burning!'
    };
  }

  // =========================================================================
  // 6. Charts Integration
  // =========================================================================
  let calorieChartInstance = null;
  let stepChartInstance = null;
  let distributionChartInstance = null;

  function renderCharts(days = 7) {
    if (typeof Chart === 'undefined') return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#475569' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';

    const history = store.getHistory(days);
    const labels = history.map(h => days <= 7 ? `${h.dayLabel} (${h.dateLabel})` : h.dateLabel);
    const caloriesData = history.map(h => h.calories);
    const stepsData = history.map(h => h.steps);

    const profile = store.getProfile();
    const calorieGoal = profile.calorieTarget;
    const stepGoal = profile.stepTarget;

    const calCanvas = document.getElementById('calorie-chart');
    if (calCanvas) {
      if (calorieChartInstance) calorieChartInstance.destroy();
      const ctx = calCanvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, 'rgba(255, 51, 102, 0.85)');
      gradient.addColorStop(1, 'rgba(255, 51, 102, 0.1)');

      calorieChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Calories Burned (kcal)',
            data: caloriesData,
            backgroundColor: gradient,
            borderColor: '#ff3366',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#fff',
              bodyColor: '#ff758c',
              callbacks: {
                label: ctx => ` ${ctx.parsed.y} kcal (${Math.round((ctx.parsed.y / calorieGoal) * 100)}% of goal)`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } }, suggestedMax: Math.max(...caloriesData, calorieGoal) * 1.1 }
          }
        }
      });
    }

    const stepCanvas = document.getElementById('step-chart');
    if (stepCanvas) {
      if (stepChartInstance) stepChartInstance.destroy();
      const ctx = stepCanvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

      stepChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Steps',
            data: stepsData,
            backgroundColor: gradient,
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#fff',
              bodyColor: '#34d399',
              callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString()} steps` }
            }
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } }, suggestedMax: Math.max(...stepsData, stepGoal) * 1.1 }
          }
        }
      });
    }

    const distCanvas = document.getElementById('distribution-chart');
    if (distCanvas) {
      if (distributionChartInstance) distributionChartInstance.destroy();
      const breakdown = store.getCategoryBreakdown(days);
      const catLabels = Object.keys(breakdown);
      const catValues = Object.values(breakdown);
      const hasData = catValues.some(v => v > 0);
      const colors = ['#00f2fe', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

      distributionChartInstance = new Chart(distCanvas, {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{
            data: hasData ? catValues : [1],
            backgroundColor: hasData ? colors : ['rgba(255,255,255,0.1)'],
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, font: { size: 12 }, padding: 12, usePointStyle: true }
            },
            tooltip: {
              enabled: hasData,
              callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} mins` }
            }
          }
        }
      });
    }
  }

  // =========================================================================
  // 7. PulseFitApp Coordinator
  // =========================================================================
  class PulseFitApp {
    constructor() {
      this.currentTab = 'dashboard';
      this.analyticsDays = 7;
      this.timer = null;
      this.selectedActivityType = 'running';
    }

    init() {
      this.applyTheme(store.getProfile().theme || 'dark');
      this.setupNavigation();
      this.setupTimer();
      this.setupActivityForm();
      this.setupHydrationQuickActions();
      this.setupProfileSettings();
      this.setupDataManagement();

      this.renderAll();
      if (window.lucide) window.lucide.createIcons();
    }

    applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) {
        themeBtn.innerHTML = theme === 'light' 
          ? '<i data-lucide="moon"></i>' 
          : (theme === 'cyber' ? '<i data-lucide="zap"></i>' : '<i data-lucide="sun"></i>');
      }
      if (window.lucide) window.lucide.createIcons();
      if (this.currentTab === 'analytics') renderCharts(this.analyticsDays);
    }

    toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : (current === 'light' ? 'cyber' : 'dark');
      store.updateProfile({ theme: nextTheme });
      this.applyTheme(nextTheme);
      this.showToast('Theme Changed', `Switched to ${nextTheme.toUpperCase()} theme`);
    }

    setupNavigation() {
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => this.switchTab(tab.getAttribute('data-tab')));
      });

      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

      const soundBtn = document.getElementById('sound-toggle-btn');
      if (soundBtn) {
        soundBtn.addEventListener('click', () => {
          const cur = store.getProfile().soundEnabled;
          store.updateProfile({ soundEnabled: !cur });
          this.updateSoundBtn();
          this.showToast('Audio Cues', !cur ? 'Sound effects enabled' : 'Sound effects muted');
        });
        this.updateSoundBtn();
      }

      const streakPill = document.getElementById('streak-pill');
      if (streakPill) streakPill.addEventListener('click', () => this.switchTab('achievements'));

      const quickLogBtn = document.getElementById('quick-log-btn');
      if (quickLogBtn) quickLogBtn.addEventListener('click', () => this.openActivityModal());
    }

    updateSoundBtn() {
      const btn = document.getElementById('sound-toggle-btn');
      if (!btn) return;
      btn.innerHTML = store.getProfile().soundEnabled ? '<i data-lucide="volume-2"></i>' : '<i data-lucide="volume-x"></i>';
      if (window.lucide) window.lucide.createIcons();
    }

    switchTab(tabId) {
      this.currentTab = tabId;
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tabId));
      document.querySelectorAll('.view-section').forEach(v => v.classList.toggle('active', v.id === `view-${tabId}`));

      if (tabId === 'analytics') setTimeout(() => renderCharts(this.analyticsDays), 50);
      else if (tabId === 'dashboard') this.renderDashboard();
      else if (tabId === 'achievements') this.renderAchievements();

      if (window.lucide) window.lucide.createIcons();
    }

    renderAll() {
      this.renderDashboard();
      this.renderAchievements();
      this.renderStreak();
      this.renderProfileForm();
    }

    renderStreak() {
      const streak = calculateStreak(store.activities, store.steps);
      const el = document.getElementById('streak-count');
      if (el) el.textContent = streak.currentStreak;
    }

    renderDashboard() {
      const summary = store.getDailySummary();
      const profile = store.getProfile();

      const calEl = document.getElementById('dash-calories');
      const minEl = document.getElementById('dash-minutes');
      const stepsEl = document.getElementById('dash-steps');
      const waterEl = document.getElementById('dash-water');
      const distEl = document.getElementById('dash-dist');

      if (calEl) calEl.textContent = summary.calories.toLocaleString();
      if (minEl) minEl.textContent = summary.exerciseMinutes;
      if (stepsEl) stepsEl.textContent = summary.steps.toLocaleString();
      if (waterEl) waterEl.textContent = (summary.hydration / 1000).toFixed(2);
      if (distEl) distEl.textContent = summary.distance.toFixed(1);

      const calPct = Math.min(100, Math.round((summary.calories / profile.calorieTarget) * 100));
      const minPct = Math.min(100, Math.round((summary.exerciseMinutes / profile.exerciseTarget) * 100));
      const stepPct = Math.min(100, Math.round((summary.steps / profile.stepTarget) * 100));
      const waterPct = Math.min(100, Math.round((summary.hydration / profile.waterTarget) * 100));

      this.updateBar('bar-calories', calPct);
      this.updateBar('bar-minutes', minPct);
      this.updateBar('bar-steps', stepPct);
      this.updateBar('bar-water', waterPct);

      this.updateRings(calPct, minPct, stepPct);

      const coach = getSmartCoachInsight(summary, profile);
      const cTitle = document.getElementById('coach-title');
      const cQuote = document.getElementById('coach-quote');
      if (cTitle) cTitle.textContent = coach.title;
      if (cQuote) cQuote.textContent = coach.quote;

      this.renderTodayActivities();
    }

    updateBar(id, pct) {
      const el = document.getElementById(id);
      if (el) el.style.width = `${pct}%`;
    }

    updateRings(calPct, minPct, stepPct) {
      const rCal = document.getElementById('ring-calories');
      const rMin = document.getElementById('ring-minutes');
      const rStep = document.getElementById('ring-steps');
      const cPct = document.getElementById('rings-center-pct');

      if (rCal) {
        const c = 2 * Math.PI * 98;
        rCal.style.strokeDasharray = `${c}`;
        rCal.style.strokeDashoffset = `${c - (c * Math.min(100, calPct)) / 100}`;
      }
      if (rMin) {
        const c = 2 * Math.PI * 78;
        rMin.style.strokeDasharray = `${c}`;
        rMin.style.strokeDashoffset = `${c - (c * Math.min(100, minPct)) / 100}`;
      }
      if (rStep) {
        const c = 2 * Math.PI * 58;
        rStep.style.strokeDasharray = `${c}`;
        rStep.style.strokeDashoffset = `${c - (c * Math.min(100, stepPct)) / 100}`;
      }
      if (cPct) {
        cPct.textContent = `${Math.round((calPct + minPct + stepPct) / 3)}%`;
      }
    }

    renderTodayActivities() {
      const todayKey = formatDateKey(new Date());
      const activities = store.getActivities(todayKey);
      const list = document.getElementById('today-activities-list');
      if (!list) return;

      if (activities.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🧘</div>
            <p>No workouts logged yet today.</p>
            <button class="btn btn-secondary btn-sm" id="empty-log-btn" style="margin-top: 0.75rem;">+ Log First Activity</button>
          </div>
        `;
        const btn = document.getElementById('empty-log-btn');
        if (btn) btn.addEventListener('click', () => this.openActivityModal());
        return;
      }

      list.innerHTML = activities.map(act => {
        const meta = ACTIVITY_METS[act.type] || ACTIVITY_METS.custom;
        return `
          <div class="activity-item">
            <div class="activity-left">
              <div class="activity-icon-badge" style="background: ${meta.color}20; color: ${meta.color};">
                <i data-lucide="${meta.icon}"></i>
              </div>
              <div class="activity-info">
                <h4>${act.name}</h4>
                <p>${act.duration} mins • ${act.intensity.toUpperCase()}${act.distance ? ` • ${act.distance} km` : ''}</p>
              </div>
            </div>
            <div style="display: flex; align-items: center;">
              <div class="activity-stats">
                <div class="activity-cal">+${act.calories} kcal</div>
                <div class="activity-time">${new Date(act.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <button class="activity-delete-btn" data-id="${act.id}" title="Delete Activity">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.activity-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          store.deleteActivity(btn.getAttribute('data-id'));
          this.renderDashboard();
          this.renderStreak();
          this.showToast('Activity Removed', 'Workout deleted from history');
        });
      });

      if (window.lucide) window.lucide.createIcons();
    }

    renderAchievements() {
      const container = document.getElementById('badges-container');
      if (!container) return;

      const unlocked = store.getUnlockedBadges();
      const streak = calculateStreak(store.activities, store.steps);

      const bStreak = document.getElementById('achieve-best-streak');
      const cStreak = document.getElementById('achieve-curr-streak');
      const tUnlock = document.getElementById('achieve-total-unlocked');

      if (bStreak) bStreak.textContent = streak.bestStreak;
      if (cStreak) cStreak.textContent = streak.currentStreak;
      if (tUnlock) tUnlock.textContent = `${unlocked.length}/${BADGES.length}`;

      container.innerHTML = BADGES.map(b => {
        const isU = unlocked.includes(b.id);
        return `
          <div class="badge-card ${isU ? 'unlocked' : 'locked'}">
            <div class="badge-icon">${b.icon}</div>
            <div class="badge-name">${b.name}</div>
            <div class="badge-desc">${b.description}</div>
            <span class="badge-status ${isU ? 'unlocked' : 'locked'}">${isU ? 'Unlocked ✓' : 'Locked'}</span>
          </div>
        `;
      }).join('');
    }

    setupActivityForm() {
      const modal = document.getElementById('activity-modal');
      const closeBtn = document.getElementById('modal-close-btn');
      const cancelBtn = document.getElementById('modal-cancel-btn');
      const form = document.getElementById('activity-form');
      const chips = document.querySelectorAll('.preset-chip');

      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chips.forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          this.selectedActivityType = chip.getAttribute('data-type');
          const titleInput = document.getElementById('act-name');
          if (titleInput && (!titleInput.value || titleInput.getAttribute('data-touched') !== 'true')) {
            const meta = ACTIVITY_METS[this.selectedActivityType];
            titleInput.value = meta ? meta.name : 'Workout';
          }
          this.updateCaloriePreview();
        });
      });

      ['act-duration', 'act-intensity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => this.updateCaloriePreview());
      });

      const actName = document.getElementById('act-name');
      if (actName) actName.addEventListener('input', () => actName.setAttribute('data-touched', 'true'));

      const closeModal = () => modal.classList.remove('active');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
      if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

      if (form) {
        form.addEventListener('submit', e => {
          e.preventDefault();
          const duration = Number(document.getElementById('act-duration').value) || 30;
          const intensity = document.getElementById('act-intensity').value;
          const name = document.getElementById('act-name').value || 'Workout';
          const distance = document.getElementById('act-distance').value;
          const manualCal = document.getElementById('act-calories').value;
          const profile = store.getProfile();

          const estimated = calculateCalories(this.selectedActivityType, duration, profile.weight, intensity);
          const finalCal = manualCal ? Number(manualCal) : estimated;

          store.addActivity({
            type: this.selectedActivityType,
            name,
            duration,
            calories: finalCal,
            distance: distance ? Number(distance) : null,
            intensity,
            date: new Date().toISOString()
          });

          closeModal();
          form.reset();
          document.getElementById('act-name').removeAttribute('data-touched');

          this.renderAll();
          this.showToast('Workout Logged!', `Burned ~${finalCal} kcal in ${duration} mins 🔥`);

          const newB = evaluateBadges();
          if (newB.length > 0) {
            fireConfetti();
            audio.playVictory();
            newB.forEach(b => this.showToast(`🏆 Badge Unlocked: ${b.name}`, b.description));
            this.renderAchievements();
          }
        });
      }

      const addStepBtn = document.getElementById('quick-add-steps-btn');
      if (addStepBtn) {
        addStepBtn.addEventListener('click', () => {
          const input = prompt('Enter steps to add to today:', '2000');
          if (input && !isNaN(input)) {
            const added = parseInt(input, 10);
            if (added > 0) {
              store.addSteps(added);
              this.renderDashboard();
              this.renderStreak();
              this.showToast('Steps Updated', `+${added.toLocaleString()} steps added`);
              const nb = evaluateBadges();
              if (nb.length > 0) {
                fireConfetti();
                this.renderAchievements();
              }
            }
          }
        });
      }
    }

    updateCaloriePreview() {
      const durEl = document.getElementById('act-duration');
      const intEl = document.getElementById('act-intensity');
      const prevEl = document.getElementById('cal-preview-val');
      const profile = store.getProfile();
      const duration = durEl ? Number(durEl.value) || 30 : 30;
      const intensity = intEl ? intEl.value : 'moderate';
      const cal = calculateCalories(this.selectedActivityType, duration, profile.weight, intensity);
      if (prevEl) prevEl.textContent = `~${cal} kcal`;
    }

    openActivityModal(prefill = {}) {
      const modal = document.getElementById('activity-modal');
      if (!modal) return;
      if (prefill.type) {
        this.selectedActivityType = prefill.type;
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.toggle('selected', c.getAttribute('data-type') === prefill.type));
      }
      if (prefill.duration) {
        const d = document.getElementById('act-duration');
        if (d) d.value = prefill.duration;
      }
      if (prefill.name) {
        const n = document.getElementById('act-name');
        if (n) {
          n.value = prefill.name;
          n.setAttribute('data-touched', 'true');
        }
      }
      this.updateCaloriePreview();
      modal.classList.add('active');
    }

    setupHydrationQuickActions() {
      const a250 = document.getElementById('water-add-250');
      const a500 = document.getElementById('water-add-500');
      const reset = document.getElementById('water-reset');

      if (a250) {
        a250.addEventListener('click', () => {
          store.addHydration(250);
          this.renderDashboard();
          this.showToast('Hydration Logged', '+250ml water added 💧');
          const nb = evaluateBadges();
          if (nb.length > 0) { fireConfetti(); this.renderAchievements(); }
        });
      }
      if (a500) {
        a500.addEventListener('click', () => {
          store.addHydration(500);
          this.renderDashboard();
          this.showToast('Hydration Logged', '+500ml water added 💧');
          const nb = evaluateBadges();
          if (nb.length > 0) { fireConfetti(); this.renderAchievements(); }
        });
      }
      if (reset) {
        reset.addEventListener('click', () => {
          store.setHydration(0);
          this.renderDashboard();
          this.showToast('Water Reset', 'Daily water reset to 0ml');
        });
      }
    }

    setupTimer() {
      const displayEl = document.getElementById('timer-display');
      const phaseEl = document.getElementById('timer-phase');
      const roundEl = document.getElementById('timer-round-info');
      const startPauseBtn = document.getElementById('timer-btn-toggle');
      const resetBtn = document.getElementById('timer-btn-reset');
      const lapBtn = document.getElementById('timer-btn-lap');
      const lapsList = document.getElementById('timer-laps-list');
      const logBtn = document.getElementById('timer-log-workout-btn');

      this.timer = new WorkoutTimer(
        state => {
          const mins = String(Math.floor(state.seconds / 60)).padStart(2, '0');
          const secs = String(state.seconds % 60).padStart(2, '0');
          if (displayEl) displayEl.textContent = `${mins}:${secs}`;
          if (state.mode === 'stopwatch') {
            if (phaseEl) phaseEl.textContent = 'STOPWATCH';
            if (roundEl) roundEl.textContent = 'Active Elapsed Time';
          } else {
            if (phaseEl) {
              phaseEl.textContent = state.phase.toUpperCase();
              phaseEl.className = `timer-phase-badge phase-${state.phase}`;
            }
            if (roundEl) roundEl.textContent = `Round ${state.round} of ${state.totalRounds}`;
          }
        },
        (phase) => {
          if (phaseEl) {
            phaseEl.textContent = phase.toUpperCase();
            phaseEl.className = `timer-phase-badge phase-${phase}`;
          }
        },
        totalMins => {
          this.showToast('HIIT Complete! 🏆', `Great workout! You completed ${totalMins} active minutes.`);
          fireConfetti();
          if (startPauseBtn) startPauseBtn.innerHTML = '<i data-lucide="play"></i>';
          if (logBtn) {
            logBtn.style.display = 'inline-flex';
            logBtn.onclick = () => {
              this.openActivityModal({ type: 'hiit', duration: totalMins, name: 'HIIT Tabata Session' });
            };
          }
        }
      );

      document.querySelectorAll('.mode-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          const mode = pill.getAttribute('data-mode');
          this.timer.setMode(mode);

          const hiitPanel = document.getElementById('hiit-config-panel');
          if (hiitPanel) hiitPanel.style.display = mode === 'hiit' ? 'block' : 'none';
          if (lapBtn) lapBtn.style.display = mode === 'stopwatch' ? 'flex' : 'none';
          if (lapsList) lapsList.innerHTML = '';
          if (startPauseBtn) startPauseBtn.innerHTML = '<i data-lucide="play"></i>';
          if (logBtn) logBtn.style.display = 'none';
          if (window.lucide) window.lucide.createIcons();
        });
      });

      if (startPauseBtn) {
        startPauseBtn.addEventListener('click', () => {
          if (this.timer.isRunning) {
            this.timer.pause();
            startPauseBtn.innerHTML = '<i data-lucide="play"></i>';
            startPauseBtn.className = 'timer-btn-round timer-btn-primary';
            if (this.timer.mode === 'stopwatch' && this.timer.stopwatchSeconds >= 60) {
              if (logBtn) {
                logBtn.style.display = 'inline-flex';
                logBtn.onclick = () => {
                  const m = Math.max(1, Math.round(this.timer.stopwatchSeconds / 60));
                  this.openActivityModal({ type: 'running', duration: m, name: 'Tracked Workout' });
                };
              }
            }
          } else {
            this.timer.start();
            startPauseBtn.innerHTML = '<i data-lucide="pause"></i>';
            startPauseBtn.className = 'timer-btn-round timer-btn-danger';
          }
          if (window.lucide) window.lucide.createIcons();
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.timer.reset();
          if (startPauseBtn) {
            startPauseBtn.innerHTML = '<i data-lucide="play"></i>';
            startPauseBtn.className = 'timer-btn-round timer-btn-primary';
          }
          if (logBtn) logBtn.style.display = 'none';
          if (lapsList) lapsList.innerHTML = '';
          if (window.lucide) window.lucide.createIcons();
        });
      }

      if (lapBtn) {
        lapBtn.addEventListener('click', () => {
          const lap = this.timer.recordLap();
          if (lap && lapsList) {
            const m = String(Math.floor(lap.time / 60)).padStart(2, '0');
            const s = String(lap.time % 60).padStart(2, '0');
            const div = document.createElement('div');
            div.className = 'flex-between';
            div.style.padding = '0.4rem 0.6rem';
            div.style.borderBottom = '1px solid var(--border-subtle)';
            div.innerHTML = `<span>Lap ${lap.lapIndex}</span><span style="font-weight:700;">${m}:${s}</span>`;
            lapsList.prepend(div);
          }
        });
      }

      ['hiit-prep', 'hiit-work', 'hiit-rest', 'hiit-rounds'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) {
          inp.addEventListener('change', () => {
            const p = document.getElementById('hiit-prep').value;
            const w = document.getElementById('hiit-work').value;
            const r = document.getElementById('hiit-rest').value;
            const rnd = document.getElementById('hiit-rounds').value;
            this.timer.configureHIIT(p, w, r, rnd);
          });
        }
      });

      document.querySelectorAll('.period-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.analyticsDays = parseInt(btn.getAttribute('data-days'), 10);
          renderCharts(this.analyticsDays);
        });
      });
    }

    setupProfileSettings() {
      const form = document.getElementById('profile-form');
      if (form) {
        form.addEventListener('submit', e => {
          e.preventDefault();
          store.updateProfile({
            name: document.getElementById('prof-name').value,
            weight: Number(document.getElementById('prof-weight').value) || 70,
            height: Number(document.getElementById('prof-height').value) || 175,
            calorieTarget: Number(document.getElementById('prof-cal-target').value) || 600,
            exerciseTarget: Number(document.getElementById('prof-min-target').value) || 45,
            stepTarget: Number(document.getElementById('prof-step-target').value) || 10000,
            waterTarget: Number(document.getElementById('prof-water-target').value) || 2500
          });
          this.renderDashboard();
          this.showToast('Profile Saved', 'Personal targets updated');
        });
      }
    }

    renderProfileForm() {
      const p = store.getProfile();
      const map = {
        'prof-name': p.name,
        'prof-weight': p.weight,
        'prof-height': p.height,
        'prof-cal-target': p.calorieTarget,
        'prof-min-target': p.exerciseTarget,
        'prof-step-target': p.stepTarget,
        'prof-water-target': p.waterTarget
      };
      Object.keys(map).forEach(k => {
        const el = document.getElementById(k);
        if (el) el.value = map[k];
      });
    }

    setupDataManagement() {
      const exp = document.getElementById('export-data-btn');
      if (exp) {
        exp.addEventListener('click', () => {
          const json = store.exportData();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `pulsefit-backup-${formatDateKey(new Date())}.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.showToast('Export Complete', 'Backup file downloaded');
        });
      }

      const impBtn = document.getElementById('import-data-btn');
      const impInp = document.getElementById('import-file-input');
      if (impBtn && impInp) {
        impBtn.addEventListener('click', () => impInp.click());
        impInp.addEventListener('change', e => {
          const f = e.target.files[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = ev => {
            if (store.importData(ev.target.result)) {
              this.renderAll();
              this.showToast('Data Restored', 'Your records have been imported');
            } else {
              this.showToast('Import Failed', 'Invalid JSON backup format');
            }
          };
          r.readAsText(f);
        });
      }

      const seedBtn = document.getElementById('seed-sample-btn');
      if (seedBtn) {
        seedBtn.addEventListener('click', () => {
          if (confirm('Load 7 days of demo workouts and metrics?')) {
            store.seedSampleData();
            this.renderAll();
            if (this.currentTab === 'analytics') renderCharts(this.analyticsDays);
            this.showToast('Demo Data Loaded', 'Sample logs and history populated');
          }
        });
      }

      const resetBtn = document.getElementById('reset-data-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (confirm('Clear all logs and start fresh?')) {
            store.resetData();
            this.renderAll();
            if (this.currentTab === 'analytics') renderCharts(this.analyticsDays);
            this.showToast('Data Reset', 'All activity logs cleared');
          }
        });
      }
    }

    showToast(title, msg) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `
        <div class="toast-icon">⚡</div>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-msg">${msg}</div>
        </div>
      `;
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    window.pulseFit = new PulseFitApp();
    window.pulseFit.init();
  });

})();
