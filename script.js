/**
 * R6 Suspect Check — ranked-only heuristics for “cheat-like” vs “smurf-like” profiles.
 * Bump this when a new ranked season starts (highest index = current).
 */
const CURRENT_SEASON_NUM = 18;

const MIN_LEVEL_FOR_RANKED = 50;
/** Below this many ranked games, we barely trust K/D (sample too small). */
const RANKED_LOW_SAMPLE = 15;
/** From here upward, high K/D starts to count in full. */
const RANKED_SOLID_SAMPLE = 55;
/** Gap between two played season numbers → “skipped” seasons; >= this suggests smurf breaks. */
const SMURF_GAP_SEASONS = 4;

const RANK_ORDER = {
  copper: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  platinum: 5,
  emerald: 6,
  diamond: 7,
  champion: 8,
};

const form = document.getElementById('stats-form');
const resultSection = document.getElementById('result-section');
const resultContent = document.getElementById('result-content');
const formError = document.getElementById('form-error');

function buildSeasonCheckboxes() {
  const grid = document.getElementById('season-grid');
  if (!grid) return;

  for (let i = 1; i <= CURRENT_SEASON_NUM; i++) {
    const wrap = document.createElement('label');
    wrap.className = 'season-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'season';
    input.value = String(i);

    const text = document.createElement('span');
    text.textContent =
      i === CURRENT_SEASON_NUM ? `Season ${i} (current)` : `Season ${i}`;

    wrap.appendChild(input);
    wrap.appendChild(text);
    grid.appendChild(wrap);
  }
}

function getPlayedSeasons() {
  const checked = document.querySelectorAll('input[name="season"]:checked');
  const nums = Array.from(checked).map((el) => parseInt(el.value, 10));
  return nums.filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
}

/**
 * How much we trust K/D vs ranked games: 0 = ignore, 1 = full weight.
 */
function rankedTrust(rankedGames) {
  if (rankedGames < RANKED_LOW_SAMPLE) return 0;
  if (rankedGames >= RANKED_SOLID_SAMPLE) return 1;
  return (rankedGames - RANKED_LOW_SAMPLE) / (RANKED_SOLID_SAMPLE - RANKED_LOW_SAMPLE);
}

function largestSeasonGap(sortedSeasons) {
  if (sortedSeasons.length < 2) return 0;
  let maxGap = 0;
  for (let i = 0; i < sortedSeasons.length - 1; i++) {
    const skipped = sortedSeasons[i + 1] - sortedSeasons[i] - 1;
    if (skipped > maxGap) maxGap = skipped;
  }
  return maxGap;
}

function onlyCurrentSeasonPlayed(sortedSeasons) {
  return (
    sortedSeasons.length === 1 && sortedSeasons[0] === CURRENT_SEASON_NUM
  );
}

/**
 * Cheap account level: very low level + high rank pushes smurf idea.
 */
function levelLooksCheapForRank(level, rankStep) {
  if (level <= 0 || rankStep <= 0) return false;
  if (rankStep >= RANK_ORDER.platinum && level < 70) return true;
  if (rankStep >= RANK_ORDER.diamond && level < 120) return true;
  return false;
}

function analyzeProfile(input) {
  const reasons = [];
  let cheatScore = 0;
  let smurfScore = 0;

  const {
    kd,
    winrate,
    ranked,
    level,
    rankStep,
    rankKey,
    playedSeasons,
  } = input;

  const trust = rankedTrust(ranked);
  const hasWinrate = winrate !== undefined && !Number.isNaN(winrate);

  // --- Season pattern (smurf vs one-season blow-up) ---
  if (onlyCurrentSeasonPlayed(playedSeasons)) {
    cheatScore += 28;
    smurfScore += 22;
    reasons.push({
      text: 'Ranked only in the current season — common for new accounts or boosted streaks.',
      type: 'negative',
    });
  }

  const bigGap = largestSeasonGap(playedSeasons);
  if (bigGap >= SMURF_GAP_SEASONS) {
    smurfScore += Math.min(40, 12 + bigGap * 3);
    reasons.push({
      text: `Large gap between ranked seasons (up to ${bigGap} season(s) skipped) — fits a secondary account that comes back sporadically.`,
      type: 'negative',
    });
  }

  if (playedSeasons.length >= 6 && bigGap < SMURF_GAP_SEASONS) {
    smurfScore -= 18;
    cheatScore -= 8;
    reasons.push({
      text: 'Several seasons played without huge breaks — looks like a long-term main account.',
      type: 'positive',
    });
  }

  // --- K/D: only bites after enough ranked games ---
  if (trust > 0) {
    if (kd >= 2.0) {
      const add = 42 * trust;
      cheatScore += add;
      reasons.push({
        text: `High K/D (${kd}) with ${ranked}+ ranked games — unusual at scale.`,
        type: 'negative',
      });
    } else if (kd >= 1.75) {
      cheatScore += 28 * trust;
      reasons.push({
        text: `Strong K/D (${kd}) with a solid ranked sample (${ranked} games).`,
        type: 'negative',
      });
    } else if (kd >= 1.55) {
      cheatScore += 14 * trust;
      reasons.push({
        text: `Above-average K/D (${kd}) with enough games to mean something.`,
        type: 'negative',
      });
    }
  } else if (kd >= 1.75 && ranked > 0) {
    reasons.push({
      text: `Not many ranked games yet (${ranked}) — K/D alone is weak evidence.`,
      type: 'positive',
    });
  }

  // --- Win rate ---
  if (hasWinrate && ranked >= 60) {
    if (winrate >= 78) {
      cheatScore += 24;
      reasons.push({
        text: `Very high ranked win rate (${winrate}%) over ${ranked} games.`,
        type: 'negative',
      });
    } else if (winrate >= 72) {
      cheatScore += 14;
      reasons.push({
        text: `High ranked win rate (${winrate}%).`,
        type: 'negative',
      });
    }
  }

  if (hasWinrate && winrate >= 52 && winrate <= 60 && ranked >= 200) {
    cheatScore -= 12;
    reasons.push({
      text: `Win rate (${winrate}%) looks normal for a grind account.`,
      type: 'positive',
    });
  }

  // --- Rank + level (smurf shape) ---
  if (rankStep > 0) {
    if (rankStep >= RANK_ORDER.diamond && cheatScore > 20) {
      cheatScore += 10;
      reasons.push({
        text: `High rank (${rankKey}) on top of already strong combat stats.`,
        type: 'negative',
      });
    }
    if (levelLooksCheapForRank(level, rankStep)) {
      smurfScore += 25;
      reasons.push({
        text: `High rank for account level ${level} — often a smurf or alt.`,
        type: 'negative',
      });
    }
    if (
      rankStep >= RANK_ORDER.platinum &&
      ranked < 60 &&
      playedSeasons.length <= 2
    ) {
      smurfScore += 18;
      reasons.push({
        text: 'Good rank with few ranked games and little season history.',
        type: 'negative',
      });
    }
  }

  if (level >= 120 && ranked >= 200) {
    smurfScore -= 15;
    reasons.push({
      text: `High account level (${level}) and many ranked games — less “fresh smurf”.`,
      type: 'positive',
    });
  }

  // --- Calm K/D bucket (clean anchor) ---
  if (kd >= 1.15 && kd <= 1.45 && ranked >= 200) {
    cheatScore -= 22;
    reasons.push({
      text: `K/D (${kd}) is ordinary with hundreds of ranked games.`,
      type: 'positive',
    });
  }

  cheatScore = Math.max(0, Math.min(100, cheatScore));
  smurfScore = Math.max(0, Math.min(100, smurfScore));

  let verdict = 'uncertain';
  let verdictLabel = 'Inconclusive';
  let verdictClass = 'uncertain';

  if (cheatScore >= 58 && cheatScore >= smurfScore + 8) {
    verdict = 'suspect';
    verdictLabel = 'Strong cheat-style signal (stats + context)';
    verdictClass = 'suspect';
  } else if (cheatScore >= 45) {
    verdict = 'suspect';
    verdictLabel = 'Suspicious stats — worth a closer look';
    verdictClass = 'suspect';
  } else if (smurfScore >= 52 && smurfScore >= cheatScore - 5) {
    verdict = 'smurf';
    verdictLabel = 'Likely smurf / alt pattern';
    verdictClass = 'smurf';
  } else if (cheatScore < 30 && smurfScore < 35) {
    verdict = 'clean';
    verdictLabel = 'Looks like a normal long-term profile';
    verdictClass = 'clean';
  } else {
    verdictLabel = 'Mixed signals — weak conclusion';
  }

  return {
    verdict,
    verdictLabel,
    verdictClass,
    cheatScore,
    smurfScore,
    reasons,
  };
}

function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove('hidden');
}

function hideFormError() {
  formError.textContent = '';
  formError.classList.add('hidden');
}

function displayResult(analysis) {
  const { verdictLabel, verdictClass, cheatScore, smurfScore, reasons } =
    analysis;

  resultContent.innerHTML = `
    <div class="verdict ${verdictClass}">${verdictLabel}</div>
    <p><strong>Cheat-style score:</strong> ${Math.round(cheatScore)}%</p>
    <div class="score-bar"><div class="score-fill suspect" style="width: ${Math.round(cheatScore)}%"></div></div>
    <p><strong>Smurf-style score:</strong> ${Math.round(smurfScore)}%</p>
    <div class="score-bar"><div class="score-fill smurf" style="width: ${Math.round(smurfScore)}%"></div></div>
    ${
      reasons.length
        ? `<ul class="reasons">${reasons.map((r) => `<li class="${r.type || ''}">${r.text}</li>`).join('')}</ul>`
        : ''
    }
  `;
}

form.addEventListener('submit', function (e) {
  e.preventDefault();
  hideFormError();

  const level = parseInt(document.getElementById('level').value, 10);
  if (!Number.isFinite(level) || level < MIN_LEVEL_FOR_RANKED) {
    showFormError(
      `Ranked is only available from level ${MIN_LEVEL_FOR_RANKED} in-game. Add a level of ${MIN_LEVEL_FOR_RANKED} or higher, or this ranked profile is not usable here.`
    );
    resultSection.classList.add('hidden');
    return;
  }

  const playedSeasons = getPlayedSeasons();
  if (playedSeasons.length === 0) {
    showFormError('Tick at least one ranked season this account has played.');
    resultSection.classList.add('hidden');
    return;
  }

  const kd = parseFloat(document.getElementById('kd').value) || 0;
  const winrateRaw = document.getElementById('winrate').value;
  const winrate =
    winrateRaw === '' ? NaN : parseFloat(winrateRaw);
  const ranked = parseInt(document.getElementById('ranked').value, 10) || 0;
  const rankKey = document.getElementById('rank').value;
  const rankStep = rankKey ? RANK_ORDER[rankKey] || 0 : 0;

  const analysis = analyzeProfile({
    kd,
    winrate,
    ranked,
    level,
    rankStep,
    rankKey,
    playedSeasons,
  });

  displayResult(analysis);
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

buildSeasonCheckboxes();
