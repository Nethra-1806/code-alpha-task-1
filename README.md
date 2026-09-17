# ⚡ PulseFit - Creative Fitness Tracking Web Application

PulseFit is a modern, responsive, and creative fitness tracker designed to track your daily workouts, steps, active calories burned, exercise time, and hydration with visual delight and gamification.

---

## ✨ Key Features

1. **Concentric Apple-Style Activity Rings**:
   - **Move Ring (Rose Red)**: Active calories burned vs daily goal.
   - **Exercise Ring (Cyan)**: Active workout minutes vs target.
   - **Steps Ring (Emerald Green)**: Step count progress.
   - Smooth animated stroke-dashoffset transitions with live percentage completion.

2. **Manual & Smart Activity Logging**:
   - 10 Preset Activities: Running, Walking, Cycling, Strength Training, HIIT, Yoga, Swimming, Jump Rope, Calisthenics, and Custom.
   - **MET-Based Calorie Estimation**: Real-time calorie burn preview calculated dynamically based on activity type, MET value (Compendium of Physical Activities), duration, intensity (Light, Moderate, Vigorous, Extreme), and your body weight.
   - Option to manually override calories.

3. **Workout Stopwatch & HIIT Tabata Timer**:
   - **Stopwatch**: Elapsed time tracking with lap recorder.
   - **HIIT Interval Timer**: Configurable Preparation, Work interval, Rest interval, and Rounds.
   - **Web Audio API Sound Synthesizer**: Custom countdown beeps, work start chimes, and rest tones synthesized in real-time (no external audio files required).
   - "Log Completed Workout" direct shortcut when interval training completes.

4. **Analytics & Progress Dashboard**:
   - 7-day, 14-day, and 30-day interactive charts powered by Chart.js.
   - Active Energy burn trends with goal indicators.
   - Daily Step progression bar charts.
   - Workout Category Split (Donut Chart: Cardio vs Strength vs HIIT vs Flexibility).

5. **Gamification & Motivation**:
   - **Daily Active Streak Counter** with animated fire badge 🔥.
   - **10 Unlockable Milestone Badges** (*First Step*, *Momentum*, *Unstoppable 7-Day*, *10K Club*, *Calorie Torch*, *Hydro Master*, *HIIT Beast*, *Trailblazer*, *Dawn Patrol*, *Night Warrior*).
   - Confetti burst particle celebration upon unlocking achievements or hitting goals.
   - **Smart AI Coach**: Context-aware daily fitness tips and motivational feedback.

6. **Hydration & Step Quick Loggers**:
   - Quick +250ml and +500ml water buttons with daily hydration progress bar.
   - Quick +Add Steps button.

7. **Theming & Data Portability**:
   - Three theme modes: **Dark Obsidian (Default)**, **Clean Light**, and **Cyber-Lime**.
   - Sound effects toggle (Mute / Sound).
   - Local persistence via `localStorage`.
   - Complete data export to JSON backup and restore from JSON file.
   - One-click "Load 7-Day Demo Logs" button to explore populated charts immediately.

---

## 🚀 How to Run

PulseFit is completely self-contained and has **zero build dependencies**:

### Option 1: Direct Double Click (Simplest)
Simply double-click `index.html` in your file explorer. It will open directly in Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari!

### Option 2: Run via Any Local HTTP Server (Optional)
If you prefer running through a local web server:
- With Python:
  ```bash
  python -m http.server 8000
  ```
  Then open [http://localhost:8000](http://localhost:8000).
- With Node.js:
  ```bash
  npx serve .
  ```

---

## 📁 File Structure

```
Fitness Tracker App/
├── index.html            # Main application shell with responsive tabs and modals
├── README.md             # Documentation and usage guide
├── css/
│   ├── style.css         # Design system, theme variables, glassmorphism, responsive styles
│   └── components.css    # Rings, metric cards, timers, badges, and modals
└── js/
    ├── bundle.js         # Self-contained runtime bundle for instant browser execution
    ├── app.js            # Modular coordinator script
    ├── store.js          # Persistent state management, CRUD, JSON export/import
    ├── calculations.js   # MET calorie formulas, BMI, and streak algorithms
    ├── timer.js          # Stopwatch and HIIT timer with Web Audio API sound synthesis
    ├── gamification.js   # Milestone badges, confetti physics, and AI coach logic
    └── charts.js         # Chart.js visualization configs
```
