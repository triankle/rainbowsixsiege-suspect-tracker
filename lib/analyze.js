/**
 * R6 Suspect Check — ranked-only heuristics engine.
 * Extracted from public/script.js for testability and server-side reuse.
 */

const CURRENT_SEASON_NUM = 18;
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

function matchConfidence(ranked) {
  if (ranked < 100) {
    return {
      label: 'low',
      cheatMult: 0.72,
      smurfMult: 1.18,
      unreliableBoost: 14,
    };
  }
  if (ranked <= 300) {
    return { label: 'medium', cheatMult: 1, smurfMult: 1, unreliableBoost: 0 };
  }
  return { label: 'high', cheatMult: 1.06, smurfMult: 0.94, unreliableBoost: 0 };
}

function kdBaseCheat(kd) {
  if (kd < 1.0) return 0;
  if (kd < 1.4) return 10;
  if (kd < 1.8) return 34;
  if (kd < 2.2) return 58;
  return 84;
}

function rankKdCheatMultiplier(rankStep) {
  if (rankStep >= RANK_ORDER.champion) return 1.22;
  if (rankStep >= RANK_ORDER.diamond) return 1.18;
  if (rankStep >= RANK_ORDER.emerald) return 1.12;
  if (rankStep >= RANK_ORDER.platinum) return 1.05;
  if (rankStep >= RANK_ORDER.gold) return 0.88;
  if (rankStep >= RANK_ORDER.silver) return 0.82;
  if (rankStep > 0) return 0.78;
  return 0.9;
}

function rankKdSmurfBoost(kd, rankStep) {
  if (kd < 1.35 || rankStep <= 0) return 0;
  if (rankStep <= RANK_ORDER.gold) {
    return Math.min(38, (kd - 1.35) * 48);
  }
  if (rankStep === RANK_ORDER.platinum && kd >= 1.5 && kd < 2.0) {
    return Math.min(18, (kd - 1.45) * 28);
  }
  return 0;
}

function winrateCheatContribution(winrate, hasWinrate) {
  if (!hasWinrate) return 0;
  if (winrate < 45) return 0;
  if (winrate <= 55) return 0;
  if (winrate <= 60) return 10;
  if (winrate <= 65) return 26;
  if (winrate <= 75) return 44;
  return 64;
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

function analyzeProfile(input) {
  const reasons = [];
  let cheatRaw = 0;
  let smurfRaw = 0;

  const {
    kd,
    winrate,
    ranked,
    level,
    rankStep,
    rankKey,
    playedSeasons,
  } = input;

  const hasWinrate = winrate !== undefined && !Number.isNaN(winrate);
  const conf = matchConfidence(ranked);
  const rankLabel = rankKey || 'not set';

  reasons.push({
    text: `Confidence: ${conf.label} (${ranked} ranked matches — ${ranked < 100 ? 'sample unreliable for strong conclusions' : ranked <= 300 ? 'medium statistical weight' : 'high statistical weight'}).`,
    type: '',
  });

  // K/D (tier + rank context)
  const kdCheatBase = kdBaseCheat(kd);
  const rankMult = rankKdCheatMultiplier(rankStep);
  let kdCheat = kdCheatBase * rankMult;
  const smurfFromKdRank = rankKdSmurfBoost(kd, rankStep);
  smurfRaw += smurfFromKdRank;

  if (rankStep >= RANK_ORDER.emerald && kd >= 1.4 && kd < 1.8) {
    reasons.push({
      text: `K/D ${kd} in ${rankLabel} lobbies: very strong for rank — shifts toward cheat-style suspicion more than in low ranks.`,
      type: 'negative',
    });
  } else if (
    rankStep > 0 &&
    rankStep <= RANK_ORDER.gold &&
    kd >= 1.4 &&
    kd < 1.85
  ) {
    reasons.push({
      text: `K/D ${kd} in ${rankLabel}: often reads as smurf or very strong player; less cheat-likely than the same K/D in Emerald+.`,
      type: 'negative',
    });
  }

  cheatRaw += kdCheat;

  reasons.push({
    text: `K/D ${kd} → base cheat weight ${Math.round(kdCheatBase)}, rank multiplier ×${rankMult.toFixed(2)} (${rankLabel}) → ${Math.round(kdCheat)} toward cheat axis.`,
    type: kdCheat >= 35 ? 'negative' : 'positive',
  });

  if (smurfFromKdRank > 0) {
    reasons.push({
      text: `Rank context adds +${Math.round(smurfFromKdRank)} smurf-style (strong stats in lower lobby / plat gate).`,
      type: 'negative',
    });
  }

  // Win rate
  const wrCheat = winrateCheatContribution(winrate, hasWinrate);
  cheatRaw += wrCheat;
  if (wrCheat > 0) {
    reasons.push({
      text: `Win rate ${hasWinrate ? `${winrate}%` : 'n/a'} → +${wrCheat} toward cheat (${winrate > 75 ? 'extremely suspicious band' : winrate > 65 ? 'suspicious' : 'elevated'}).`,
      type: 'negative',
    });
  }
  if (hasWinrate && winrate >= 45 && winrate <= 55 && ranked >= 150) {
    cheatRaw -= 8;
    reasons.push({
      text: `Win rate ${winrate}% in normal band (45–55%) with enough games — lowers cheat noise.`,
      type: 'positive',
    });
  }

  if (conf.unreliableBoost > 0) {
    smurfRaw += conf.unreliableBoost;
    reasons.push({
      text: `Few matches: +${conf.unreliableBoost} smurf-style (boost / alt / unreliable sample). Cheat/smurf axes scaled by confidence after all rules.`,
      type: 'negative',
    });
  }

  // Account level
  if (level < 80 && (kd >= 1.5 || (hasWinrate && winrate > 60))) {
    smurfRaw += 24;
    reasons.push({
      text: `Level ${level} with strong combat stats → strong smurf / alt signal (prompt: <80 + strong stats).`,
      type: 'negative',
    });
  }
  if (level < 120 && kd >= 1.8) {
    cheatRaw += 12;
    smurfRaw += 14;
    reasons.push({
      text: `Level ${level} with very high K/D (${kd}) → suspicious; split between smurf and cheat risk.`,
      type: 'negative',
    });
  }
  if (level > 150) {
    smurfRaw -= 14;
    cheatRaw -= 10;
    reasons.push({
      text: `Level ${level} → more credible main (reduces smurf/cheat noise).`,
      type: 'positive',
    });
  }

  // Seasons played
  const nSeasons = playedSeasons.length;
  if (nSeasons <= 2) {
    smurfRaw += 20;
    reasons.push({
      text: `Only ${nSeasons} ranked season(s) ticked → smurf indicator (1–2 seasons).`,
      type: 'negative',
    });
  } else if (nSeasons >= 3 && nSeasons <= 5) {
    reasons.push({
      text: `${nSeasons} seasons → normal "active account" band.`,
      type: 'positive',
    });
  } else if (nSeasons > 6) {
    smurfRaw -= 14;
    cheatRaw -= 6;
    reasons.push({
      text: `${nSeasons} seasons → established account (reduces smurf prior).`,
      type: 'positive',
    });
  }

  // Season pattern extras
  if (onlyCurrentSeasonPlayed(playedSeasons)) {
    cheatRaw += 22;
    smurfRaw += 18;
    reasons.push({
      text: 'Only current season ranked — new account / boost / volatile pattern.',
      type: 'negative',
    });
  }

  const bigGap = largestSeasonGap(playedSeasons);
  if (bigGap >= SMURF_GAP_SEASONS) {
    smurfRaw += Math.min(36, 10 + bigGap * 2.5);
    reasons.push({
      text: `Large season gap (${bigGap} skipped) — sporadic alt pattern.`,
      type: 'negative',
    });
  }

  if (nSeasons >= 6 && bigGap < SMURF_GAP_SEASONS) {
    smurfRaw -= 12;
    cheatRaw -= 6;
    reasons.push({
      text: 'Many seasons without long breaks — looks like a main.',
      type: 'positive',
    });
  }

  // Consistency
  if (ranked > 300 && kd >= 1.8) {
    cheatRaw += 16;
    reasons.push({
      text: 'High K/D sustained over 300+ ranked matches → cheat suspicion increases (consistency rule).',
      type: 'negative',
    });
  }
  if (level < 100 && kd >= 1.5) {
    smurfRaw += 16;
    reasons.push({
      text: 'High K/D with account level under 100 → smurf suspicion increases (consistency rule).',
      type: 'negative',
    });
  }

  cheatRaw *= conf.cheatMult;
  smurfRaw *= conf.smurfMult;

  let cheatScore = Math.max(0, Math.min(100, Math.round(cheatRaw)));
  let smurfScore = Math.max(0, Math.min(100, Math.round(smurfRaw)));

  const baseMax = Math.max(cheatScore, smurfScore);
  let finalScore = baseMax;
  if (conf.label === 'low') {
    finalScore = Math.min(100, Math.round(baseMax * 0.86));
  } else if (conf.label === 'high' && ranked > 300 && kd >= 1.75) {
    finalScore = Math.min(100, Math.round(baseMax * 1.04));
  }

  let classification = 'mixed — manual review';
  if (finalScore < 38 && cheatScore < 36 && smurfScore < 38) {
    classification = 'legit';
  } else if (smurfScore >= cheatScore + 14 && smurfScore >= 42) {
    classification = 'smurf';
  } else if (cheatScore >= smurfScore + 14 && cheatScore >= 42) {
    classification = 'possible cheater';
  } else if (finalScore >= 72) {
    classification =
      cheatScore >= smurfScore ? 'possible cheater' : 'smurf';
  } else if (finalScore >= 55 && (cheatScore >= 50 || smurfScore >= 50)) {
    classification =
      cheatScore > smurfScore ? 'possible cheater' : 'smurf';
  }

  const analysis = `Classification: ${classification}. Confidence ${conf.label}. Final suspicion ${finalScore}/100 (50≈suspicious, 75+ very suspicious, 90+ highly abnormal). Cheat axis ${cheatScore}, smurf axis ${smurfScore}.`;

  reasons.push({
    text: analysis,
    type:
      classification === 'legit'
        ? 'positive'
        : classification.includes('cheater')
          ? 'negative'
          : 'negative',
  });

  let verdict = 'uncertain';
  let verdictLabel = 'Inconclusive';
  let verdictClass = 'uncertain';

  if (classification === 'legit') {
    verdict = 'clean';
    verdictLabel = 'Legit — within normal competitive ranges';
    verdictClass = 'clean';
  } else if (classification === 'smurf') {
    verdict = 'smurf';
    verdictLabel = 'Smurf / alt — pattern fits secondary account';
    verdictClass = 'smurf';
  } else if (classification === 'possible cheater') {
    verdict = 'suspect';
    verdictLabel = 'Possible cheater — stats warrant scrutiny (not proof)';
    verdictClass = 'suspect';
  } else if (finalScore >= 50) {
    verdict = 'uncertain';
    verdictLabel = `Elevated suspicion (${finalScore}/100) — mixed smurf/cheat signals`;
    verdictClass = 'uncertain';
  } else {
    verdictLabel = 'Mixed / low confidence — manual review';
    verdictClass = 'uncertain';
  }

  return {
    verdict,
    verdictLabel,
    verdictClass,
    cheatScore,
    smurfScore,
    finalScore,
    confidence: conf.label,
    classification,
    analysis,
    reasons,
  };
}

module.exports = {
  CURRENT_SEASON_NUM,
  SMURF_GAP_SEASONS,
  RANK_ORDER,
  matchConfidence,
  kdBaseCheat,
  rankKdCheatMultiplier,
  rankKdSmurfBoost,
  winrateCheatContribution,
  largestSeasonGap,
  onlyCurrentSeasonPlayed,
  analyzeProfile,
};
