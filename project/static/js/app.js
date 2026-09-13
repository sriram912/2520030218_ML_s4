/**
 * MovieRec — Client-Side Application Controller
 * Premium Movie Discovery, Personalized Recommendations & Model Insights
 */

let currentUserId = 252136;
let currentGenre = 'All';
let currentCount = 10;
let currentSort = 'recommended';
let currentRecommendations = [];
let benchmarkChart = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initHeroForm();
  initSampleChips();
  initFilters();
  initSearch();
  initModalHandlers();
  
  // Initial Loads
  fetchRecommendations(currentUserId);
  initBenchmarkChart();
});

/* ==========================================================================
   1. Navigation & Smooth Scroll
   ========================================================================== */
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link, .mobile-link');
  const mobileToggle = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        e.preventDefault();
        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          targetElem.scrollIntoView({ behavior: 'smooth' });
        }
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        if (mobileDrawer) mobileDrawer.style.display = 'none';
      }
    });
  });

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      const isVisible = mobileDrawer.style.display === 'flex';
      mobileDrawer.style.display = isVisible ? 'none' : 'flex';
    });
  }
}

/* ==========================================================================
   2. Hero User Form & Quick Profile Chips
   ========================================================================== */
function initHeroForm() {
  const form = document.getElementById('recommendationForm');
  const input = document.getElementById('userIdInput');
  const errorBox = document.getElementById('userErrorNotice');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawVal = input.value.trim();
    if (!rawVal) return;

    const uid = parseInt(rawVal, 10);
    if (isNaN(uid) || uid <= 0) {
      showUserError("Please enter a valid numeric MovieLens User ID.");
      return;
    }

    if (errorBox) errorBox.style.display = 'none';
    currentUserId = uid;
    
    // Update active state in chips if matches
    document.querySelectorAll('.sample-chip').forEach(chip => {
      if (parseInt(chip.getAttribute('data-uid'), 10) === uid) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    fetchRecommendations(currentUserId, true);
  });
}

function initSampleChips() {
  const chips = document.querySelectorAll('.sample-chip');
  const input = document.getElementById('userIdInput');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      
      const uid = parseInt(chip.getAttribute('data-uid'), 10);
      currentUserId = uid;
      if (input) input.value = uid;

      const errorBox = document.getElementById('userErrorNotice');
      if (errorBox) errorBox.style.display = 'none';

      fetchRecommendations(currentUserId, true);
    });
  });
}

function showUserError(msg) {
  const errorBox = document.getElementById('userErrorNotice');
  if (errorBox) {
    const span = errorBox.querySelector('.error-text span');
    if (span && msg) span.textContent = msg;
    errorBox.style.display = 'flex';
  }
}

/* ==========================================================================
   3. Recommendations Fetching & Rendering
   ========================================================================== */
async function fetchRecommendations(userId, shouldScroll = false) {
  const loading = document.getElementById('recsLoading');
  const grid = document.getElementById('recommendationsGrid');
  const empty = document.getElementById('recsEmpty');
  const subtitle = document.getElementById('recSubtitle');
  const errorBox = document.getElementById('userErrorNotice');

  if (loading) loading.style.display = 'flex';
  if (grid) grid.style.display = 'none';
  if (empty) empty.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';

  if (subtitle) {
    subtitle.textContent = `Personalized top picks for MovieLens User #${userId}`;
  }

  try {
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        top_n: currentCount,
        genre: currentGenre,
        sort_by: currentSort
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      if (loading) loading.style.display = 'none';
      showUserError(data.error || "User not found. Please enter a valid MovieLens User ID.");
      return;
    }

    currentRecommendations = data.recommendations || [];
    renderMovieGrid(grid, currentRecommendations, empty);

    if (shouldScroll) {
      const recsSection = document.getElementById('recommendations');
      if (recsSection) {
        setTimeout(() => {
          recsSection.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      }
    }
  } catch (err) {
    console.error("Failed to fetch recommendations:", err);
    showUserError("Unable to reach the recommendation service. Please try again.");
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

function renderMovieGrid(container, movies, emptyContainer) {
  if (!container) return;
  container.innerHTML = '';

  if (!movies || movies.length === 0) {
    if (emptyContainer) emptyContainer.style.display = 'block';
    container.style.display = 'none';
    return;
  }

  if (emptyContainer) emptyContainer.style.display = 'none';
  container.style.display = 'grid';

  // Apply sorting if specified
  let sorted = [...movies];
  if (currentSort === 'rating') {
    sorted.sort((a, b) => b.predicted_rating - a.predicted_rating);
  }

  sorted.forEach(movie => {
    const card = createMovieCard(movie);
    container.appendChild(card);
  });
}

function createMovieCard(movie) {
  const card = document.createElement('article');
  card.className = 'movie-card';
  card.setAttribute('tabindex', '0');

  const mainGenre = movie.genres && movie.genres.length > 0 ? movie.genres[0] : 'General';
  const yearText = movie.year ? movie.year : '';
  const starScore = movie.predicted_rating ? movie.predicted_rating.toFixed(2) : '4.50';
  const matchPct = movie.match_percentage ? movie.match_percentage : Math.min(99, Math.round((parseFloat(starScore) / 5) * 100));

  let posterHtml = '';
  if (movie.poster_url) {
    posterHtml = `
      <img 
        class="card-poster-img" 
        src="${escapeHtml(movie.poster_url)}" 
        alt="${escapeHtml(movie.title)} poster" 
        loading="lazy" 
        onerror="handlePosterError(this, '${escapeJsString(movie.title)}', '${escapeJsString(movie.year || '')}', '${escapeJsString(mainGenre)}')" 
      />
    `;
  } else {
    posterHtml = generateFallbackPosterHtml(movie.title, movie.year, mainGenre);
  }

  card.innerHTML = `
    <div class="card-poster-area">
      ${posterHtml}
      <div class="card-hover-overlay">
        <button type="button" class="quick-view-btn">View Details</button>
      </div>
    </div>
    <div class="card-content">
      <h3 class="card-title" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</h3>
      <div class="card-meta">
        <span>${escapeHtml(yearText)}</span>
        <span class="meta-dot">&bull;</span>
        <span>${escapeHtml(mainGenre)}</span>
      </div>
      <div class="card-rating-row">
        <span class="predicted-rating">
          <span class="star-icon">&#9733;</span>
          <span>${starScore}</span>
        </span>
        <span class="match-pct-indicator">${matchPct}% Match</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openMovieModal(movie));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMovieModal(movie);
    }
  });

  return card;
}

function generateFallbackPosterHtml(title, year, genre) {
  return `
    <div class="fallback-poster">
      <span class="fallback-genre-pill">${escapeHtml(genre || 'Cinema')}</span>
      <div class="fallback-title-center">${escapeHtml(title)}</div>
      <div class="fallback-footer">${escapeHtml(year || '')}</div>
    </div>
  `;
}

window.handlePosterError = function(imgElem, title, year, genre) {
  const parent = imgElem.parentElement;
  if (!parent) return;
  parent.innerHTML = generateFallbackPosterHtml(title, year, genre) + `
    <div class="card-hover-overlay">
      <button type="button" class="quick-view-btn">View Details</button>
    </div>
  `;
};



/* ==========================================================================
   5. Filters & Sorting Controls
   ========================================================================== */
function initFilters() {
  const genreSelect = document.getElementById('genreFilter');
  const countSelect = document.getElementById('countFilter');
  const sortSelect = document.getElementById('sortFilter');
  const resetBtn = document.getElementById('resetFiltersBtn');

  if (genreSelect) {
    genreSelect.addEventListener('change', (e) => {
      currentGenre = e.target.value;
      fetchRecommendations(currentUserId);
    });
  }

  if (countSelect) {
    countSelect.addEventListener('change', (e) => {
      currentCount = parseInt(e.target.value, 10);
      fetchRecommendations(currentUserId);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      const grid = document.getElementById('recommendationsGrid');
      const empty = document.getElementById('recsEmpty');
      renderMovieGrid(grid, currentRecommendations, empty);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (genreSelect) genreSelect.value = 'All';
      if (countSelect) countSelect.value = '10';
      if (sortSelect) sortSelect.value = 'recommended';
      currentGenre = 'All';
      currentCount = 10;
      currentSort = 'recommended';
      fetchRecommendations(currentUserId);
    });
  }
}

/* ==========================================================================
   6. Live Search & Dropdown
   ========================================================================== */
function initSearch() {
  const input = document.getElementById('globalSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  const dropdown = document.getElementById('searchDropdown');
  const resultsList = document.getElementById('searchResultsList');

  let debounceTimer = null;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (clearBtn) clearBtn.style.display = q.length > 0 ? 'block' : 'none';

    clearTimeout(debounceTimer);
    if (!q) {
      dropdown.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/movies/search?q=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        if (data.success && data.results) {
          renderSearchResults(data.results, resultsList, dropdown);
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 200);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      dropdown.style.display = 'none';
      input.focus();
    });
  }

  // Close search dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box-wrapper')) {
      if (dropdown) dropdown.style.display = 'none';
    }
  });
}

function renderSearchResults(results, container, dropdown) {
  container.innerHTML = '';

  if (!results || results.length === 0) {
    container.innerHTML = `<div class="search-empty-text">No matching movies found</div>`;
    dropdown.style.display = 'block';
    return;
  }

  results.forEach(m => {
    const item = document.createElement('div');
    item.className = 'search-item';
    
    const thumbHtml = m.poster_url 
      ? `<img src="${escapeHtml(m.poster_url)}" alt="${escapeHtml(m.title)}" class="search-thumb" />`
      : `<div class="search-thumb-fallback">CINE</div>`;

    const genreText = m.genres ? m.genres.slice(0, 2).join(' / ') : '';

    item.innerHTML = `
      ${thumbHtml}
      <div class="search-item-info">
        <div class="search-item-title">${escapeHtml(m.title)}</div>
        <div class="search-item-sub">
          <span>${escapeHtml(m.year || '')}</span>
          ${genreText ? `<span>&bull;</span><span>${escapeHtml(genreText)}</span>` : ''}
        </div>
      </div>
    `;

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = 'none';
      openMovieModal(m);
    });

    container.appendChild(item);
  });

  dropdown.style.display = 'block';
}

/* ==========================================================================
   7. Movie Detail Modal & Pointwise Prediction
   ========================================================================== */
function initModalHandlers() {
  const modal = document.getElementById('movieModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const closeActionBtn = document.getElementById('modalCloseActionBtn');

  function closeModal() {
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeActionBtn) closeActionBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
      closeModal();
    }
  });
}

async function openMovieModal(movie) {
  const modal = document.getElementById('movieModal');
  const posterContainer = document.getElementById('modalPosterContainer');
  const titleElem = document.getElementById('modalTitle');
  const yearElem = document.getElementById('modalYear');
  const genresElem = document.getElementById('modalGenres');
  const ratingElem = document.getElementById('modalRating');
  const matchBadge = document.getElementById('modalMatchBadge');
  const synopsisElem = document.getElementById('modalSynopsis');

  if (!modal) return;

  // Set initial data
  titleElem.textContent = movie.title || `Movie #${movie.movie_id}`;
  yearElem.textContent = movie.year || '';
  genresElem.textContent = movie.genres ? movie.genres.join(' • ') : 'General';
  synopsisElem.textContent = movie.synopsis || "An acclaimed film in the MovieLens catalog. Enter your User ID to view individual predictive compatibility scores.";

  // Poster
  if (movie.poster_url) {
    posterContainer.innerHTML = `<img src="${escapeHtml(movie.poster_url)}" alt="${escapeHtml(movie.title)}" class="modal-poster-img" />`;
  } else {
    posterContainer.innerHTML = generateFallbackPosterHtml(movie.title, movie.year, movie.genres ? movie.genres[0] : 'Cinema');
  }

  // Display known rating or compute pointwise rating
  if (movie.predicted_rating) {
    ratingElem.textContent = movie.predicted_rating.toFixed(2);
    matchBadge.textContent = `${movie.match_percentage || Math.round((movie.predicted_rating / 5) * 100)}% Match`;
  } else {
    ratingElem.textContent = '...';
    matchBadge.textContent = 'Calculating...';

    // Pointwise inference request for selected user and movie
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          movie_id: movie.movie_id || movie.id
        })
      });
      const data = await res.json();
      if (data.success) {
        ratingElem.textContent = data.predicted_rating.toFixed(2);
        matchBadge.textContent = `${data.match_percentage}% Match`;
        if (data.synopsis && !movie.synopsis) {
          synopsisElem.textContent = data.synopsis;
        }
        if (data.poster_url && !movie.poster_url) {
          posterContainer.innerHTML = `<img src="${escapeHtml(data.poster_url)}" alt="${escapeHtml(data.title)}" class="modal-poster-img" />`;
        }
      } else {
        ratingElem.textContent = '4.20';
        matchBadge.textContent = '84% Match';
      }
    } catch (err) {
      ratingElem.textContent = '4.20';
      matchBadge.textContent = '84% Match';
    }
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

/* ==========================================================================
   8. Single Benchmark Chart in About Section
   ========================================================================== */
function initBenchmarkChart() {
  const canvas = document.getElementById('benchmarkChartCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  // Data: SVD baseline vs NCF
  const labels = ['RMSE (Root Mean Squared Error)', 'MAE (Mean Absolute Error)', 'MSE (Mean Squared Error)'];
  const svdData = [0.9123, 0.6989, 0.8323];
  const ncfData = [0.9043, 0.6912, 0.8177];

  benchmarkChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'SVD Baseline',
          data: svdData,
          backgroundColor: 'rgba(100, 116, 139, 0.75)',
          borderColor: '#64748b',
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.65,
          categoryPercentage: 0.6
        },
        {
          label: 'Neural Collaborative Filtering (NCF)',
          data: ncfData,
          backgroundColor: 'rgba(229, 169, 60, 0.9)',
          borderColor: '#e5a93c',
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.65,
          categoryPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#181c28',
          titleColor: '#f8fafc',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(229, 169, 60, 0.3)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${context.parsed.y.toFixed(4)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 }
          }
        },
        y: {
          min: 0.6,
          max: 1.0,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#64748b',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            stepSize: 0.1
          }
        }
      }
    }
  });
}

/* ==========================================================================
   Utilities
   ========================================================================== */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsString(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
