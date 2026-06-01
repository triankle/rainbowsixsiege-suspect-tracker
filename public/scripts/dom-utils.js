/**
 * DOM utilities for the R6 Suspect Check frontend.
 * Centralizes small DOM helpers to keep script.js focused on business logic.
 */

/**
 * Escapes HTML special characters to prevent XSS when injecting user input.
 */
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Shows the form error message with the given text.
 */
function showFormError(message) {
  const el = document.getElementById('form-error');
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
}

/**
 * Hides the form error message.
 */
function hideFormError() {
  const el = document.getElementById('form-error');
  if (el) el.classList.add('hidden');
}

/**
 * Returns the array of selected season numbers from the checkboxes.
 */
function getPlayedSeasons() {
  const checked = document.querySelectorAll('input[name="season"]:checked');
  const nums = Array.from(checked).map((el) => parseInt(el.value, 10));
  return nums.filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
}

/**
 * Builds the season checkboxes dynamically based on CURRENT_SEASON_NUM.
 */
function buildSeasonCheckboxes(currentSeasonNum) {
  const grid = document.getElementById('season-grid');
  if (!grid) return;

  for (let i = 1; i <= currentSeasonNum; i++) {
    const wrap = document.createElement('label');
    wrap.className = 'season-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'season';
    input.value = String(i);

    const text = document.createElement('span');
    text.textContent =
      i === currentSeasonNum ? `Season ${i} (current)` : `Season ${i}`;

    wrap.appendChild(input);
    wrap.appendChild(text);
    grid.appendChild(wrap);
  }
}

module.exports = {
  escapeHtml,
  showFormError,
  hideFormError,
  getPlayedSeasons,
  buildSeasonCheckboxes,
};
