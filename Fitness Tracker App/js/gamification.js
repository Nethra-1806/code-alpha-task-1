/**
 * PulseFit - Gamification, Streaks, Achievements & Confetti Engine
 */

import { store } from './store.js';
import { calculateStreak, formatDateKey } from './calculations.js';

export const BADGES = [
  {
    id: 'first_workout',
    name: 'First Step',
    icon: '🏃',
    description: 'Logged your very first workout session!',
    check: (store) => store.activities.length >= 1
  },
  {
    id: 'streak_3',
    name: 'Momentum',
    icon: '🔥',
    description: 'Achieved a 3-day active fitness streak!',
    check: (store) => calculateStreak(store.activities, store.steps).currentStreak >= 3
  },
  {
    id: 'streak_7',
    name: 'Unstoppable',
    icon: '⚡',
    description: 'Maintained an unbroken 7-day workout streak!',
    check: (store) => calculateStreak(store.activities, store.steps).currentStreak >= 7
  },
  {
    id: 'step_master_10k',
    name: '10K Club',
    icon: '👟',
    description: 'Crushed 10,000 steps in a single day!',
    check: (store) => Object.values(store.steps).some(s => s >= 10000)
  },
  {
    id: 'calorie_crusher',
    name: 'Calorie Torch',
    icon: '🌋',
    description: 'Burned 600+ active calories in a single day!',
    check: (store) => {
      const today = store.getDailySummary();
      return today.calories >= 600;
    }
  },
  {
    id: 'hydration_hero',
    name: 'Hydro Master',
    icon: '💧',
    description: 'Drank at least 2,500ml of water in a day!',
    check: (store) => Object.values(store.hydration).some(h => h >= 2500)
  },
  {
    id: 'hiit_warrior',
    name: 'HIIT Beast',
    icon: '💥',
    description: 'Crushed a High-Intensity Interval Training workout!',
    check: (store) => store.activities.some(a => a.type === 'hiit')
  },
  {
    id: 'century_distance',
    name: 'Trailblazer',
    icon: '🗺️',
    description: 'Logged over 25 km of total workout distance!',
    check: (store) => {
      const totalDist = store.activities.reduce((sum, a) => sum + (a.distance || 0), 0);
      return totalDist >= 25;
    }
  },
  {
    id: 'early_bird',
    name: 'Dawn Patrol',
    icon: '🌅',
    description: 'Completed a workout session before 8:00 AM!',
    check: (store) => store.activities.some(a => {
      const d = new Date(a.date);
      return d.getHours() < 8;
    })
  },
  {
    id: 'night_owl',
    name: 'Night Warrior',
    icon: '🌙',
    description: 'Completed a workout session after 8:00 PM!',
    check: (store) => store.activities.some(a => {
      const d = new Date(a.date);
      return d.getHours() >= 20;
    })
  }
];

/**
 * Check and unlock any eligible badges.
 * Returns array of newly unlocked badge objects.
 */
export function evaluateBadges() {
  const newlyUnlocked = [];
  const currentlyUnlocked = store.getUnlockedBadges();

  BADGES.forEach(badge => {
    if (!currentlyUnlocked.includes(badge.id)) {
      if (badge.check(store)) {
        store.unlockBadge(badge.id);
        newlyUnlocked.push(badge);
      }
    }
  });

  return newlyUnlocked;
}

/**
 * Celebratory Canvas Confetti Burst
 */
export function fireConfetti() {
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
    let activeParticles = 0;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vRot;
      p.alpha -= 0.012;

      if (p.alpha > 0) {
        activeParticles++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    });

    if (activeParticles > 0) {
      animationId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationId);
    }
  };

  render();
}

/**
 * Generate smart contextual AI fitness tips and coaching insights
 * @param {Object} summary 
 * @param {Object} profile 
 * @returns {{ title: string, quote: string }}
 */
export function getSmartCoachInsight(summary, profile) {
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
    const calNeeded = profile.calorieTarget - summary.calories;
    return {
      title: 'Afternoon Energy Boost ⚡',
      quote: `You have ${calNeeded} kcal left to reach your goal today. A quick 20-minute jog or HIIT session will close the ring!`
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
