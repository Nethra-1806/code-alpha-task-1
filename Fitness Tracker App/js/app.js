/**
 * PulseFit - Main Application Coordinator
 */

import { store } from './store.js';
import { ACTIVITY_METS, calculateCalories, calculateStreak, formatDateKey, formatMinutes } from './calculations.js';
import { WorkoutTimer, audio } from './timer.js';
import { BADGES, evaluateBadges, fireConfetti, getSmartCoachInsight } from './gamification.js';
import { renderCharts } from './charts.js';

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

    // Initial render
    this.renderAll();

    // Lucide icons render
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // =========================================================================
  // View & Theme Management
  // =========================================================================

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'light' 
        ? '<i data-lucide="moon"></i>' 
        : (theme === 'cyber' ? '<i data-lucide="zap"></i>' : '<i data-lucide="sun"></i>');
    }
    if (window.lucide) window.lucide.createIcons();
    if (this.currentTab === 'analytics') {
      renderCharts(this.analyticsDays);
    }
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : (current === 'light' ? 'cyber' : 'dark');
    store.updateProfile({ theme: nextTheme });
    this.applyTheme(nextTheme);
    this.showToast('Theme Changed', `Switched to ${nextTheme.toUpperCase()} theme`);
  }

  setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        this.switchTab(target);
      });
    });

    // Theme toggle button
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Sound toggle button
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const current = store.getProfile().soundEnabled;
        store.updateProfile({ soundEnabled: !current });
        this.updateSoundBtn();
        this.showToast('Audio Cues', !current ? 'Sound effects enabled' : 'Sound effects muted');
      });
      this.updateSoundBtn();
    }

    // Streak pill click
    const streakPill = document.getElementById('streak-pill');
    if (streakPill) {
      streakPill.addEventListener('click', () => {
        this.switchTab('achievements');
      });
    }

    // Quick log button in header
    const quickLogBtn = document.getElementById('quick-log-btn');
    if (quickLogBtn) {
      quickLogBtn.addEventListener('click', () => this.openActivityModal());
    }
  }

  updateSoundBtn() {
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (!soundBtn) return;
    const enabled = store.getProfile().soundEnabled;
    soundBtn.innerHTML = enabled 
      ? '<i data-lucide="volume-2"></i>' 
      : '<i data-lucide="volume-x"></i>';
    if (window.lucide) window.lucide.createIcons();
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.view-section').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    if (tabId === 'analytics') {
      setTimeout(() => renderCharts(this.analyticsDays), 50);
    } else if (tabId === 'dashboard') {
      this.renderDashboard();
    } else if (tabId === 'achievements') {
      this.renderAchievements();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // Render Engine (Dashboard, Rings, Badges, Feed)
  // =========================================================================

  renderAll() {
    this.renderDashboard();
    this.renderAchievements();
    this.renderStreak();
    this.renderProfileForm();
  }

  renderStreak() {
    const streakData = calculateStreak(store.activities, store.steps);
    const streakCountEl = document.getElementById('streak-count');
    if (streakCountEl) {
      streakCountEl.textContent = streakData.currentStreak;
    }
  }

  renderDashboard() {
    const summary = store.getDailySummary();
    const profile = store.getProfile();

    // 1. Metric values
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

    // Metric targets & progress bars
    const calPct = Math.min(100, Math.round((summary.calories / profile.calorieTarget) * 100));
    const minPct = Math.min(100, Math.round((summary.exerciseMinutes / profile.exerciseTarget) * 100));
    const stepPct = Math.min(100, Math.round((summary.steps / profile.stepTarget) * 100));
    const waterPct = Math.min(100, Math.round((summary.hydration / profile.waterTarget) * 100));

    this.updateBar('bar-calories', calPct);
    this.updateBar('bar-minutes', minPct);
    this.updateBar('bar-steps', stepPct);
    this.updateBar('bar-water', waterPct);

    // 2. Animated Concentric SVG Rings
    this.updateRings(calPct, minPct, stepPct);

    // 3. AI Coach Banner
    const coach = getSmartCoachInsight(summary, profile);
    const coachTitle = document.getElementById('coach-title');
    const coachQuote = document.getElementById('coach-quote');
    if (coachTitle) coachTitle.textContent = coach.title;
    if (coachQuote) coachQuote.textContent = coach.quote;

    // 4. Today's Activities Feed
    this.renderTodayActivities();
  }

  updateBar(barId, percent) {
    const el = document.getElementById(barId);
    if (el) el.style.width = `${percent}%`;
  }

  updateRings(calPct, minPct, stepPct) {
    const ringCal = document.getElementById('ring-calories');
    const ringMin = document.getElementById('ring-minutes');
    const ringSteps = document.getElementById('ring-steps');
    const centerPct = document.getElementById('rings-center-pct');

    // Circumference = 2 * PI * r
    // Outer: r=98 => ~615.75
    // Middle: r=78 => ~490.09
    // Inner: r=58 => ~364.42
    if (ringCal) {
      const c = 2 * Math.PI * 98;
      ringCal.style.strokeDasharray = `${c}`;
      ringCal.style.strokeDashoffset = `${c - (c * Math.min(100, calPct)) / 100}`;
    }
    if (ringMin) {
      const c = 2 * Math.PI * 78;
      ringMin.style.strokeDasharray = `${c}`;
      ringMin.style.strokeDashoffset = `${c - (c * Math.min(100, minPct)) / 100}`;
    }
    if (ringSteps) {
      const c = 2 * Math.PI * 58;
      ringSteps.style.strokeDasharray = `${c}`;
      ringSteps.style.strokeDashoffset = `${c - (c * Math.min(100, stepPct)) / 100}`;
    }

    if (centerPct) {
      const avg = Math.round((calPct + minPct + stepPct) / 3);
      centerPct.textContent = `${avg}%`;
    }
  }

  renderTodayActivities() {
    const todayKey = formatDateKey(new Date());
    const activities = store.getActivities(todayKey);
    const listContainer = document.getElementById('today-activities-list');
    if (!listContainer) return;

    if (activities.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🧘</div>
          <p>No workouts logged yet today.</p>
          <button class="btn btn-secondary btn-sm" id="empty-log-btn" style="margin-top: 0.75rem;">
            + Log First Activity
          </button>
        </div>
      `;
      const emptyBtn = document.getElementById('empty-log-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => this.openActivityModal());
      return;
    }

    listContainer.innerHTML = activities.map(act => {
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

    // Attach delete handlers
    listContainer.querySelectorAll('.activity-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        store.deleteActivity(id);
        this.renderDashboard();
        this.renderStreak();
        this.showToast('Activity Removed', 'Workout deleted from history');
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderAchievements() {
    const badgesContainer = document.getElementById('badges-container');
    if (!badgesContainer) return;

    const unlockedIds = store.getUnlockedBadges();
    const streakData = calculateStreak(store.activities, store.steps);

    const bestStreakEl = document.getElementById('achieve-best-streak');
    const currentStreakEl = document.getElementById('achieve-curr-streak');
    const totalUnlockedEl = document.getElementById('achieve-total-unlocked');

    if (bestStreakEl) bestStreakEl.textContent = streakData.bestStreak;
    if (currentStreakEl) currentStreakEl.textContent = streakData.currentStreak;
    if (totalUnlockedEl) totalUnlockedEl.textContent = `${unlockedIds.length}/${BADGES.length}`;

    badgesContainer.innerHTML = BADGES.map(badge => {
      const isUnlocked = unlockedIds.includes(badge.id);
      return `
        <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="badge-icon">${badge.icon}</div>
          <div class="badge-name">${badge.name}</div>
          <div class="badge-desc">${badge.description}</div>
          <span class="badge-status ${isUnlocked ? 'unlocked' : 'locked'}">
            ${isUnlocked ? 'Unlocked ✓' : 'Locked'}
          </span>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // Activity Logging & MET Calculator Modal
  // =========================================================================

  setupActivityForm() {
    const modal = document.getElementById('activity-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const form = document.getElementById('activity-form');
    const chips = document.querySelectorAll('.preset-chip');

    // Preset chips click
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

    // Inputs change => recalculate preview
    ['act-duration', 'act-intensity'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.updateCaloriePreview());
    });

    const actNameInput = document.getElementById('act-name');
    if (actNameInput) {
      actNameInput.addEventListener('input', () => actNameInput.setAttribute('data-touched', 'true'));
    }

    // Modal toggles
    const closeModal = () => modal.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Form submit
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const duration = Number(document.getElementById('act-duration').value) || 30;
        const intensity = document.getElementById('act-intensity').value;
        const name = document.getElementById('act-name').value || 'Workout';
        const distance = document.getElementById('act-distance').value;
        const manualCalories = document.getElementById('act-calories').value;
        const profile = store.getProfile();

        const estimatedCal = calculateCalories(this.selectedActivityType, duration, profile.weight, intensity);
        const finalCalories = manualCalories ? Number(manualCalories) : estimatedCal;

        store.addActivity({
          type: this.selectedActivityType,
          name,
          duration,
          calories: finalCalories,
          distance: distance ? Number(distance) : null,
          intensity,
          date: new Date().toISOString()
        });

        closeModal();
        form.reset();
        document.getElementById('act-name').removeAttribute('data-touched');

        this.renderAll();
        this.showToast('Workout Logged!', `Burned ~${finalCalories} kcal in ${duration} mins 🔥`);

        // Check for newly unlocked badges
        const newBadges = evaluateBadges();
        if (newBadges.length > 0) {
          fireConfetti();
          audio.playVictory();
          newBadges.forEach(b => {
            this.showToast(`🏆 Badge Unlocked: ${b.name}`, b.description);
          });
          this.renderAchievements();
        }
      });
    }

    // Manual step adder modal / quick add
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
            const newBadges = evaluateBadges();
            if (newBadges.length > 0) {
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
    const previewEl = document.getElementById('cal-preview-val');
    const profile = store.getProfile();

    const duration = durEl ? Number(durEl.value) || 30 : 30;
    const intensity = intEl ? intEl.value : 'moderate';
    const cal = calculateCalories(this.selectedActivityType, duration, profile.weight, intensity);

    if (previewEl) {
      previewEl.textContent = `~${cal} kcal`;
    }
  }

  openActivityModal(prefill = {}) {
    const modal = document.getElementById('activity-modal');
    if (!modal) return;

    if (prefill.type) {
      this.selectedActivityType = prefill.type;
      document.querySelectorAll('.preset-chip').forEach(c => {
        c.classList.toggle('selected', c.getAttribute('data-type') === prefill.type);
      });
    }
    if (prefill.duration) {
      const durInput = document.getElementById('act-duration');
      if (durInput) durInput.value = prefill.duration;
    }
    if (prefill.name) {
      const nameInput = document.getElementById('act-name');
      if (nameInput) {
        nameInput.value = prefill.name;
        nameInput.setAttribute('data-touched', 'true');
      }
    }

    this.updateCaloriePreview();
    modal.classList.add('active');
  }

  // =========================================================================
  // Hydration Quick Actions
  // =========================================================================

  setupHydrationQuickActions() {
    const add250 = document.getElementById('water-add-250');
    const add500 = document.getElementById('water-add-500');
    const reset = document.getElementById('water-reset');

    if (add250) {
      add250.addEventListener('click', () => {
        store.addHydration(250);
        this.renderDashboard();
        this.showToast('Hydration Logged', '+250ml water added 💧');
        const newBadges = evaluateBadges();
        if (newBadges.length > 0) {
          fireConfetti();
          this.renderAchievements();
        }
      });
    }

    if (add500) {
      add500.addEventListener('click', () => {
        store.addHydration(500);
        this.renderDashboard();
        this.showToast('Hydration Logged', '+500ml water added 💧');
        const newBadges = evaluateBadges();
        if (newBadges.length > 0) {
          fireConfetti();
          this.renderAchievements();
        }
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

  // =========================================================================
  // Workout Stopwatch & HIIT Tabata Timer
  // =========================================================================

  setupTimer() {
    const displayEl = document.getElementById('timer-display');
    const phaseEl = document.getElementById('timer-phase');
    const roundEl = document.getElementById('timer-round-info');
    const startPauseBtn = document.getElementById('timer-btn-toggle');
    const resetBtn = document.getElementById('timer-btn-reset');
    const lapBtn = document.getElementById('timer-btn-lap');
    const lapsList = document.getElementById('timer-laps-list');
    const logWorkoutBtn = document.getElementById('timer-log-workout-btn');

    this.timer = new WorkoutTimer(
      // On tick
      (state) => {
        if (state.mode === 'stopwatch') {
          const mins = String(Math.floor(state.seconds / 60)).padStart(2, '0');
          const secs = String(state.seconds % 60).padStart(2, '0');
          if (displayEl) displayEl.textContent = `${mins}:${secs}`;
          if (phaseEl) phaseEl.textContent = 'STOPWATCH';
          if (roundEl) roundEl.textContent = `Active Elapsed Time`;
        } else {
          // HIIT mode
          const mins = String(Math.floor(state.seconds / 60)).padStart(2, '0');
          const secs = String(state.seconds % 60).padStart(2, '0');
          if (displayEl) displayEl.textContent = `${mins}:${secs}`;
          if (phaseEl) {
            phaseEl.textContent = state.phase.toUpperCase();
            phaseEl.className = `timer-phase-badge phase-${state.phase}`;
          }
          if (roundEl) {
            roundEl.textContent = `Round ${state.round} of ${state.totalRounds}`;
          }
        }
      },
      // On phase change
      (phase, round) => {
        if (phaseEl) {
          phaseEl.textContent = phase.toUpperCase();
          phaseEl.className = `timer-phase-badge phase-${phase}`;
        }
      },
      // On HIIT finish
      (totalMinutes) => {
        this.showToast('HIIT Complete! 🏆', `Great workout! You completed ${totalMinutes} active minutes.`);
        fireConfetti();
        if (startPauseBtn) startPauseBtn.innerHTML = '<i data-lucide="play"></i>';
        if (logWorkoutBtn) {
          logWorkoutBtn.style.display = 'inline-flex';
          logWorkoutBtn.onclick = () => {
            this.openActivityModal({
              type: 'hiit',
              duration: totalMinutes,
              name: 'HIIT Tabata Session'
            });
          };
        }
      }
    );

    // Mode switch pills
    document.querySelectorAll('.mode-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const mode = pill.getAttribute('data-mode');
        this.timer.setMode(mode);

        const hiitConfigEl = document.getElementById('hiit-config-panel');
        if (hiitConfigEl) {
          hiitConfigEl.style.display = mode === 'hiit' ? 'block' : 'none';
        }
        if (lapBtn) lapBtn.style.display = mode === 'stopwatch' ? 'flex' : 'none';
        if (lapsList) lapsList.innerHTML = '';
        if (startPauseBtn) startPauseBtn.innerHTML = '<i data-lucide="play"></i>';
        if (logWorkoutBtn) logWorkoutBtn.style.display = 'none';
        if (window.lucide) window.lucide.createIcons();
      });
    });

    // Start / Pause
    if (startPauseBtn) {
      startPauseBtn.addEventListener('click', () => {
        if (this.timer.isRunning) {
          this.timer.pause();
          startPauseBtn.innerHTML = '<i data-lucide="play"></i>';
          startPauseBtn.className = 'timer-btn-round timer-btn-primary';
          if (this.timer.mode === 'stopwatch' && this.timer.stopwatchSeconds >= 60) {
            if (logWorkoutBtn) {
              logWorkoutBtn.style.display = 'inline-flex';
              logWorkoutBtn.onclick = () => {
                const mins = Math.max(1, Math.round(this.timer.stopwatchSeconds / 60));
                this.openActivityModal({
                  type: 'running',
                  duration: mins,
                  name: 'Tracked Workout'
                });
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

    // Reset
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.timer.reset();
        if (startPauseBtn) {
          startPauseBtn.innerHTML = '<i data-lucide="play"></i>';
          startPauseBtn.className = 'timer-btn-round timer-btn-primary';
        }
        if (logWorkoutBtn) logWorkoutBtn.style.display = 'none';
        if (lapsList) lapsList.innerHTML = '';
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // Lap recording
    if (lapBtn) {
      lapBtn.addEventListener('click', () => {
        const lap = this.timer.recordLap();
        if (lap && lapsList) {
          const mins = String(Math.floor(lap.time / 60)).padStart(2, '0');
          const secs = String(lap.time % 60).padStart(2, '0');
          const item = document.createElement('div');
          item.className = 'flex-between';
          item.style.padding = '0.4rem 0.6rem';
          item.style.borderBottom = '1px solid var(--border-subtle)';
          item.innerHTML = `<span>Lap ${lap.lapIndex}</span><span style="font-weight:700;">${mins}:${secs}</span>`;
          lapsList.prepend(item);
        }
      });
    }

    // HIIT Config inputs
    ['hiit-prep', 'hiit-work', 'hiit-rest', 'hiit-rounds'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => {
          const prep = document.getElementById('hiit-prep').value;
          const work = document.getElementById('hiit-work').value;
          const rest = document.getElementById('hiit-rest').value;
          const rounds = document.getElementById('hiit-rounds').value;
          this.timer.configureHIIT(prep, work, rest, rounds);
        });
      }
    });

    // Analytics period buttons
    document.querySelectorAll('.period-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.analyticsDays = parseInt(btn.getAttribute('data-days'), 10);
        renderCharts(this.analyticsDays);
      });
    });
  }

  // =========================================================================
  // Profile Settings & Data Management
  // =========================================================================

  setupProfileSettings() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('prof-name').value;
        const weight = Number(document.getElementById('prof-weight').value) || 70;
        const height = Number(document.getElementById('prof-height').value) || 175;
        const calTarget = Number(document.getElementById('prof-cal-target').value) || 600;
        const minTarget = Number(document.getElementById('prof-min-target').value) || 45;
        const stepTarget = Number(document.getElementById('prof-step-target').value) || 10000;
        const waterTarget = Number(document.getElementById('prof-water-target').value) || 2500;

        store.updateProfile({
          name,
          weight,
          height,
          calorieTarget: calTarget,
          exerciseTarget: minTarget,
          stepTarget,
          waterTarget
        });

        this.renderDashboard();
        this.showToast('Profile Saved', 'Your targets and physical metrics are updated');
      });
    }
  }

  renderProfileForm() {
    const profile = store.getProfile();
    const map = {
      'prof-name': profile.name,
      'prof-weight': profile.weight,
      'prof-height': profile.height,
      'prof-cal-target': profile.calorieTarget,
      'prof-min-target': profile.exerciseTarget,
      'prof-step-target': profile.stepTarget,
      'prof-water-target': profile.waterTarget
    };

    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = map[id];
    });
  }

  setupDataManagement() {
    // Export JSON
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = store.exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulsefit-backup-${formatDateKey(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Export Complete', 'Backup file downloaded successfully');
      });
    }

    // Import JSON
    const importInput = document.getElementById('import-file-input');
    const importBtn = document.getElementById('import-data-btn');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const success = store.importData(event.target.result);
          if (success) {
            this.renderAll();
            this.showToast('Data Restored', 'Your records have been imported');
          } else {
            this.showToast('Import Failed', 'Invalid JSON backup format');
          }
        };
        reader.readAsText(file);
      });
    }

    // Seed Sample Data
    const seedBtn = document.getElementById('seed-sample-btn');
    if (seedBtn) {
      seedBtn.addEventListener('click', () => {
        if (confirm('Load 7 days of demo activities and statistics?')) {
          store.seedSampleData();
          this.renderAll();
          if (this.currentTab === 'analytics') renderCharts(this.analyticsDays);
          this.showToast('Demo Data Loaded', 'Dashboard and charts populated with sample logs');
        }
      });
    }

    // Reset Data
    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all fitness logs? This cannot be undone.')) {
          store.resetData();
          this.renderAll();
          if (this.currentTab === 'analytics') renderCharts(this.analyticsDays);
          this.showToast('Data Reset', 'All activity logs cleared');
        }
      });
    }
  }

  // Toast Notification Generator
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

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.pulseFit = new PulseFitApp();
  window.pulseFit.init();
});
