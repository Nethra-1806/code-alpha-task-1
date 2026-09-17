/**
 * PulseFit - State Management & Local Storage Persistence
 */

import { formatDateKey } from './calculations.js';

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
  weight: 70, // in kg
  height: 175, // in cm
  age: 28,
  calorieTarget: 600, // active kcal
  exerciseTarget: 45, // active minutes
  stepTarget: 10000,
  waterTarget: 2500, // ml
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

    // Check if initial seeding is needed
    if (!localStorage.getItem(STORAGE_KEYS.HAS_SEEDED)) {
      this.seedSampleData();
    }
  }

  load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error loading ${key} from localStorage:`, e);
      return fallback;
    }
  }

  save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error(`Error saving ${key} to localStorage:`, e);
    }
  }

  // Profile operations
  getProfile() {
    return { ...this.profile };
  }

  updateProfile(updates) {
    this.profile = { ...this.profile, ...updates };
    this.save(STORAGE_KEYS.PROFILE, this.profile);
    return this.profile;
  }

  // Activity Operations
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

  // Hydration Operations
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

  // Step Operations
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

  setSteps(count, dateKey = formatDateKey(new Date())) {
    this.steps[dateKey] = Math.max(0, count);
    this.save(STORAGE_KEYS.STEPS, this.steps);
    return this.steps[dateKey];
  }

  // Badges & Gamification
  getUnlockedBadges() {
    return [...this.badges];
  }

  unlockBadge(badgeId) {
    if (!this.badges.includes(badgeId)) {
      this.badges.push(badgeId);
      this.save(STORAGE_KEYS.BADGES, this.badges);
      return true;
    }
    return false;
  }

  // Daily Aggregates for Rings & Dashboard
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
    // Estimated calories burned through walking steps (~0.04 kcal per step)
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
      distance: +(totalDistance + (steps * 0.00078)).toFixed(2), // approx 0.78m per step
      activitiesCount: dayActivities.length
    };
  }

  // Multi-day history for Analytics (e.g. 7 or 30 days)
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

  // Category breakdown for charts
  getCategoryBreakdown(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const relevantActivities = this.activities.filter(a => new Date(a.date) >= cutoff);
    const totals = {
      Cardio: 0,
      Strength: 0,
      HIIT: 0,
      Flexibility: 0,
      Other: 0
    };

    relevantActivities.forEach(act => {
      const type = act.type || 'other';
      if (['running', 'walking', 'cycling', 'swimming', 'jumprope'].includes(type)) {
        totals.Cardio += act.duration;
      } else if (['strength', 'calisthenics'].includes(type)) {
        totals.Strength += act.duration;
      } else if (type === 'hiit') {
        totals.HIIT += act.duration;
      } else if (type === 'yoga') {
        totals.Flexibility += act.duration;
      } else {
        totals.Other += act.duration;
      }
    });

    return totals;
  }

  // Export Data to JSON
  exportData() {
    const payload = {
      pulseFitVersion: '1.0',
      exportedAt: new Date().toISOString(),
      profile: this.profile,
      activities: this.activities,
      hydration: this.hydration,
      steps: this.steps,
      badges: this.badges
    };
    return JSON.stringify(payload, null, 2);
  }

  // Import Data from JSON
  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.profile) this.profile = parsed.profile;
      if (parsed.activities) this.activities = parsed.activities;
      if (parsed.hydration) this.hydration = parsed.hydration;
      if (parsed.steps) this.steps = parsed.steps;
      if (parsed.badges) this.badges = parsed.badges;

      this.save(STORAGE_KEYS.PROFILE, this.profile);
      this.save(STORAGE_KEYS.ACTIVITIES, this.activities);
      this.save(STORAGE_KEYS.HYDRATION, this.hydration);
      this.save(STORAGE_KEYS.STEPS, this.steps);
      this.save(STORAGE_KEYS.BADGES, this.badges);
      return true;
    } catch (e) {
      console.error('Failed to import JSON data:', e);
      return false;
    }
  }

  // Reset all data
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

  // Populate realistic 7-day data so the user has immediate insights
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
          notes: 'Great workout session!'
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

export const store = new FitnessStore();
