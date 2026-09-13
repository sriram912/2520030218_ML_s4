/* ==========================================================================
   CineMatch AI - Interactive Charts & Metric Hover Dynamics
   Chart.js Configurations & Tooltip Handlers
   ========================================================================== */

let svdVsNcfChart = null;
let lossChart = null;
let maeChart = null;

// Global metrics cache
let cachedMetrics = null;

async function initMetricsAndCharts() {
  try {
    const res = await fetch('/api/metrics');
    const json = await res.json();
    if (!json.success) return;
    
    cachedMetrics = json.data;
    renderSvdVsNcfChart(cachedMetrics.model_comparison);
    renderLossChart(cachedMetrics.training_curves);
    renderMaeChart(cachedMetrics.training_curves);
    initConfusionMatrixInteractions(cachedMetrics.confusion_matrix);
  } catch (err) {
    console.error("Failed to load metrics data for charts:", err);
  }
}

// 1. SVD vs NCF Bar Chart with Custom Tooltips
function renderSvdVsNcfChart(comparisonData) {
  const ctx = document.getElementById('svdVsNcfCanvas');
  if (!ctx) return;

  const labels = comparisonData.map(d => d.metric);
  const svdValues = comparisonData.map(d => d.svd);
  const ncfValues = comparisonData.map(d => d.ncf);

  svdVsNcfChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'SVD (Matrix Factorization)',
          data: svdValues,
          backgroundColor: 'rgba(239, 68, 68, 0.75)',
          borderColor: '#ef4444',
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.6
        },
        {
          label: 'NCF (Deep Neural Net - NeuMF)',
          data: ncfValues,
          backgroundColor: 'rgba(56, 189, 248, 0.85)',
          borderColor: '#38bdf8',
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#9ca3af',
            font: { family: 'Inter', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 23, 38, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          borderColor: 'rgba(56, 189, 248, 0.3)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          callbacks: {
            afterTitle: function(context) {
              const item = comparisonData[context[0].dataIndex];
              return item ? item.full_name : '';
            },
            label: function(context) {
              return ` ${context.dataset.label}: ${context.parsed.y.toFixed(4)}`;
            },
            afterBody: function(context) {
              const item = comparisonData[context[0].dataIndex];
              if (item) {
                return `\nΔ Improvement: -${item.improvement_pct}% error reduction with NCF\n${item.description}`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: 600 } }
        },
        y: {
          min: 0.5,
          max: 1.0,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter' } },
          title: { display: true, text: 'Error Value (Lower is Better)', color: '#6b7280' }
        }
      }
    }
  });
}

// 2. Training vs Validation Loss Curve
function renderLossChart(curves) {
  const ctx = document.getElementById('lossCanvas');
  if (!ctx) return;

  const labels = curves.epochs.map(e => `Epoch ${e}`);

  lossChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Training Loss',
          data: curves.training_loss,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointBackgroundColor: '#38bdf8',
          pointRadius: 5,
          pointHoverRadius: 8
        },
        {
          label: 'Validation Loss',
          data: curves.validation_loss,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointBackgroundColor: '#f59e0b',
          pointRadius: 5,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      onHover: (event, activeElements) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          updateEpochInspector(index, curves);
        }
      },
      plugins: {
        legend: {
          labels: { color: '#9ca3af', font: { family: 'Inter' } }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 23, 38, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          borderColor: 'rgba(56, 189, 248, 0.3)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            afterBody: function(items) {
              const epoch = items[0].dataIndex;
              if (epoch === 1) {
                return '\n★ Optimal Early Stopping Point: Global minimum validation loss 0.8177';
              } else if (epoch > 1) {
                return '\n⚠️ Generalization gap starts widening (training loss drops faster than val loss)';
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' },
          title: { display: true, text: 'Loss (MSE)', color: '#6b7280' }
        }
      }
    }
  });
}

// 3. Training vs Validation MAE Curve
function renderMaeChart(curves) {
  const ctx = document.getElementById('maeCanvas');
  if (!ctx) return;

  const labels = curves.epochs.map(e => `Epoch ${e}`);

  maeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Training MAE',
          data: curves.training_mae,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointBackgroundColor: '#34d399',
          pointRadius: 5,
          pointHoverRadius: 8
        },
        {
          label: 'Validation MAE',
          data: curves.validation_mae,
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(251, 191, 36, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointBackgroundColor: '#fbbf24',
          pointRadius: 5,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      onHover: (event, activeElements) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          updateEpochInspector(index, curves);
        }
      },
      plugins: {
        legend: {
          labels: { color: '#9ca3af', font: { family: 'Inter' } }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 23, 38, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          borderColor: 'rgba(52, 211, 153, 0.3)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            afterBody: function(items) {
              const epoch = items[0].dataIndex;
              if (epoch === 1) {
                return '\n★ Best Validation MAE: 0.6912 stars absolute deviation';
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' },
          title: { display: true, text: 'Mean Absolute Error (Stars)', color: '#6b7280' }
        }
      }
    }
  });
}

// Live Epoch Inspector Bar Update on Hover
function updateEpochInspector(epochIndex, curves) {
  const epochEl = document.getElementById('inspectorEpoch');
  const trainLossEl = document.getElementById('inspectorTrainLoss');
  const valLossEl = document.getElementById('inspectorValLoss');
  const trainMaeEl = document.getElementById('inspectorTrainMae');
  const valMaeEl = document.getElementById('inspectorValMae');
  const statusEl = document.getElementById('inspectorStatus');

  if (!epochEl) return;

  epochEl.textContent = `Epoch ${epochIndex}`;
  trainLossEl.textContent = curves.training_loss[epochIndex].toFixed(4);
  valLossEl.textContent = curves.validation_loss[epochIndex].toFixed(4);
  trainMaeEl.textContent = curves.training_mae[epochIndex].toFixed(4);
  valMaeEl.textContent = curves.validation_mae[epochIndex].toFixed(4);

  if (epochIndex === 1) {
    statusEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">★ Best Generalization Model Checkpoint (Val Loss: 0.8177)</span>`;
  } else if (epochIndex === 0) {
    statusEl.innerHTML = `<span style="color: #9ca3af;">Initial convergence pass</span>`;
  } else {
    statusEl.innerHTML = `<span style="color: #f59e0b;">Subtle training specialization (val error stabilized)</span>`;
  }
}

// 4. Interactive Confusion Matrix Cell Hovering & Inspector
function initConfusionMatrixInteractions(cmData) {
  const cells = document.querySelectorAll('.cm-grid-cell, .cm-cell');
  const inspectorTag = document.getElementById('cmInspectorTag');
  const inspectorTitle = document.getElementById('cmInspectorTitle');
  const inspectorMeaning = document.getElementById('cmInspectorMeaning');
  const inspectorCount = document.getElementById('cmInspectorCount');
  const inspectorDist = document.getElementById('cmInspectorDist');
  const inspectorImpact = document.getElementById('cmInspectorImpact');

  cells.forEach(cell => {
    const key = cell.getAttribute('data-cell-key');
    const info = cmData.cell_details[key];

    const activate = () => {
      cells.forEach(c => c.classList.remove('active'));
      cell.classList.add('active');

      if (info && inspectorTag) {
        inspectorTag.textContent = info.name;
        inspectorTitle.textContent = `${info.name}: ${info.count.toLocaleString()} samples`;
        inspectorMeaning.textContent = info.meaning;
        inspectorCount.textContent = `${info.count.toLocaleString()} (${info.percentage} of dataset)`;
        inspectorDist.textContent = info.class_percentage;
        
        if (key === '1_1') {
          inspectorImpact.innerHTML = `<span style="color: #10b981; font-weight: 700;">High Discovery Success:</span> Model successfully uncovers 73.30% of films the user loves.`;
        } else if (key === '0_0') {
          inspectorImpact.innerHTML = `<span style="color: #10b981; font-weight: 700;">Effective Filtering:</span> 66.45% of poorly rated items are completely avoided.`;
        } else if (key === '0_1') {
          inspectorImpact.innerHTML = `<span style="color: #f59e0b; font-weight: 700;">Benign Exploration:</span> Serendipitous recommendations rated moderately (<4.0 ★).`;
        } else {
          inspectorImpact.innerHTML = `<span style="color: #f43f5e; font-weight: 700;">Conservative Filter:</span> A high-affinity film rated ≥4.0 that wasn't prioritized.`;
        }
      }
    };

    cell.addEventListener('mouseenter', activate);
    cell.addEventListener('click', activate);
  });
}

// Lightbox Modal for Original High-Res Plots
function openPlotModal(filename, title) {
  const modal = document.getElementById('plotModal');
  const modalImg = document.getElementById('modalPlotImage');
  const modalTitle = document.getElementById('modalPlotTitle');

  if (modal && modalImg) {
    modalImg.src = `/plots/${filename}`;
    modalTitle.textContent = title;
    modal.classList.add('active');
  }
}

function closePlotModal() {
  const modal = document.getElementById('plotModal');
  if (modal) modal.classList.remove('active');
}

// Export initialization
document.addEventListener('DOMContentLoaded', initMetricsAndCharts);
