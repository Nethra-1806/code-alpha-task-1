/**
 * PulseFit - Calculations & Formulas Module
 * Handles MET-based calorie estimation, BMI, and statistical aggregations.
 */

// Compendium of Physical Activities MET values (Metabolic Equivalent of Task)
export const ACTIVITY_METS = {
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

// Intensity multipliers
export const INTENSITY_MULTIPLIERS = {
  light: 0.85,
  moderate: 1.0,
  vigorous: 1.25,
  extreme: 1.5
};

/**
 * Standard MET calorie estimation formula:
 * Calories = (MET * 3.5 * weightKg / 200) * durationMinutes * intensityMultiplier
 * @param {string} activityType 
 * @param {number} durationMinutes 
 * @param {number} weightKg 
 * @param {string} intensity 
 * @returns {number} Estimated calories burned
 */
export function calculateCalories(activityType, durationMinutes, weightKg = 70, intensity = 'moderate') {
  const metData = ACTIVITY_METS[activityType] || ACTIVITY_METS.custom;
  const met = metData.met;
  const multiplier = INTENSITY_MULTIPLIERS[intensity] || 1.0;
  
  if (!durationMinutes || durationMinutes <= 0) return 0;
  
  // Standard exercise physiology formula
  const calories = (met * 3.5 * weightKg / 200) * durationMinutes * multiplier;
  return Math.round(calories);
}

/**
 * Calculate BMI (Body Mass Index)
 * @param {number} weightKg 
 * @param {number} heightCm 
 * @returns {{ bmi: number, category: string }}
 */
export function calculateBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || heightCm <= 0) return { bmi: 0, category: 'N/A' };
  const heightM = heightCm / 100;
  const bmi = +(weightKg / (heightM * heightM)).toFixed(1);
  
  let category = 'Normal';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi >= 25 && bmi < 30) category = 'Overweight';
  else if (bmi >= 30) category = 'Obese';
  
  return { bmi, category };
}

/**
 * Formats a Date object to YYYY-MM-DD
 * @param {Date} date 
 * @returns {string}
 */
export function formatDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format minutes into readable format (e.g. 1h 15m)
 * @param {number} minutes 
 * @returns {string}
 */
export function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Calculate streak based on daily activity history
 * An active day requires at least one workout OR meeting 50% of calorie goal
 * @param {Array} activities 
 * @param {Object} dailySteps 
 * @returns {{ currentStreak: number, bestStreak: number }}
 */
export function calculateStreak(activities, dailySteps = {}) {
  // Aggregate active days
  const activeDates = new Set();
  
  activities.forEach(act => {
    if (act.date) {
      activeDates.add(act.date.split('T')[0]);
    }
  });

  Object.keys(dailySteps).forEach(date => {
    if (dailySteps[date] >= 3000) {
      activeDates.add(date);
    }
  });

  if (activeDates.size === 0) return { currentStreak: 0, bestStreak: 0 };

  const today = new Date();
  const todayKey = formatDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  let currentStreak = 0;
  let checkDate = new Date(today);

  // If user hasn't logged today yet, streak might still be intact from yesterday
  if (!activeDates.has(todayKey) && !activeDates.has(yesterdayKey)) {
    currentStreak = 0;
  } else {
    // Start counting back from today or yesterday
    if (!activeDates.has(todayKey)) {
      checkDate = yesterday;
    }
    
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

  // Calculate best all-time streak
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
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }
    if (tempStreak > bestStreak) bestStreak = tempStreak;
    prevDate = currDate;
  }

  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak)
  };
}
