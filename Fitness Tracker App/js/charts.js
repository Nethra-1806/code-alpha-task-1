/**
 * PulseFit - Charts & Visualizations using Chart.js
 */

import { store } from './store.js';

let calorieChartInstance = null;
let stepChartInstance = null;
let distributionChartInstance = null;

export function renderCharts(days = 7) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js library not loaded yet');
    return;
  }

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

  // 1. Calorie Burn Chart
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
        labels: labels,
        datasets: [
          {
            label: 'Calories Burned (kcal)',
            data: caloriesData,
            backgroundColor: gradient,
            borderColor: '#ff3366',
            borderWidth: 1.5,
            borderRadius: 6,
            borderSkipped: false
          }
        ]
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
            borderColor: 'rgba(255, 51, 102, 0.3)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => ` ${context.parsed.y} kcal (${Math.round((context.parsed.y / calorieGoal) * 100)}% of goal)`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } },
            suggestedMax: Math.max(...caloriesData, calorieGoal) * 1.1
          }
        }
      }
    });
  }

  // 2. Steps Trend Chart
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
        labels: labels,
        datasets: [
          {
            label: 'Steps',
            data: stepsData,
            backgroundColor: gradient,
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderRadius: 6,
            borderSkipped: false
          }
        ]
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
            borderColor: 'rgba(16, 185, 129, 0.3)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => ` ${context.parsed.y.toLocaleString()} steps`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } },
            suggestedMax: Math.max(...stepsData, stepGoal) * 1.1
          }
        }
      }
    });
  }

  // 3. Category Distribution Donut Chart
  const distCanvas = document.getElementById('distribution-chart');
  if (distCanvas) {
    if (distributionChartInstance) distributionChartInstance.destroy();

    const breakdown = store.getCategoryBreakdown(days);
    const categoryLabels = Object.keys(breakdown);
    const categoryValues = Object.values(breakdown);
    const hasData = categoryValues.some(v => v > 0);

    const colors = ['#00f2fe', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

    distributionChartInstance = new Chart(distCanvas, {
      type: 'doughnut',
      data: {
        labels: categoryLabels,
        datasets: [{
          data: hasData ? categoryValues : [1],
          backgroundColor: hasData ? colors : ['rgba(255,255,255,0.1)'],
          borderColor: 'transparent',
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
            labels: {
              color: textColor,
              font: { size: 12 },
              padding: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            enabled: hasData,
            callbacks: {
              label: (context) => ` ${context.label}: ${context.parsed} mins`
            }
          }
        }
      }
    });
  }
}
