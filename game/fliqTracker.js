/**
 * fliqTracker.js — Financial Literacy Intelligence Quotient (FLIQ) tracker.
 * Records timestamped behavioral signals across 7 cognitive domains.
 * Computes weighted scores with recency bias and trend detection.
 *
 * The player never sees raw scores — they see the Explorer's Chronicle
 * which maps domains to narrative labels.
 */

/**
 * Phase 3 Canonical Intelligence Domains & Sub-Score Labels
 * Weights: 15% each, Social Intelligence 10% (per Phase 3 doc)
 * Labels: Phase 3 canonical sub-score names
 */
const DOMAINS = {
  pattern_recognition:   { weight: 0.15, label: 'Signal Sense',    desc: 'How well the player notices hidden relationships, cues, and route logic' },
  risk_awareness:        { weight: 0.15, label: 'Risk Read',       desc: 'How the player responds to uncertain choices and potentially costly opportunities' },
  resource_judgment:     { weight: 0.15, label: 'Spark Strategy',  desc: 'How the player allocates Spark, tools, and time under limited conditions' },
  decision_timing:       { weight: 0.15, label: 'Move Timing',     desc: 'How quickly and appropriately the player responds to opportunities or threats' },
  delayed_gratification: { weight: 0.15, label: 'Future Focus',    desc: 'Whether the player can wait or forgo immediate rewards for stronger outcomes later' },
  adaptation:            { weight: 0.15, label: 'Bounce Back',     desc: 'How the player responds to failure, setbacks, and changing conditions' },
  social_intelligence:   { weight: 0.10, label: 'Community Sense', desc: 'How the player behaves when cooperation, helping, or fairness choices are available' },
};

export class FLIQTracker {
  constructor() {
    // Each domain stores timestamped signal entries
    this.signals = {};
    for (const key of Object.keys(DOMAINS)) {
      this.signals[key] = []; // { value: 0-1, time: ms, context: string }
    }

    // Session metadata
    this._sessionStart = Date.now();
    this._totalSignals = 0;

    // Per-domain streak tracking (consecutive good or bad signals)
    this._streaks = {};
    for (const key of Object.keys(DOMAINS)) {
      this._streaks[key] = { good: 0, bad: 0 };
    }
  }

  /**
   * Record a behavioral signal with context.
   * @param {string} domain   One of the DOMAINS keys
   * @param {number} value    0 (poor) to 1 (excellent)
   * @param {string} [context] Optional description of what triggered this signal
   */
  record(domain, value, context = '') {
    if (!this.signals[domain]) return;
    const clamped = Math.max(0, Math.min(1, value));

    this.signals[domain].push({
      value:   clamped,
      time:    Date.now(),
      context,
    });
    this._totalSignals++;

    // Update streaks
    const streak = this._streaks[domain];
    if (clamped >= 0.6) {
      streak.good++;
      streak.bad = 0;
    } else if (clamped <= 0.4) {
      streak.bad++;
      streak.good = 0;
    }
  }

  /**
   * Get recency-weighted average for a domain (0-100).
   * Recent signals count more than old ones.
   */
  domainScore(domain) {
    const arr = this.signals[domain];
    if (!arr || arr.length === 0) return 0;

    // Use exponential recency weighting
    // More recent signals get higher weight
    const now = Date.now();
    let weightedSum = 0;
    let weightTotal = 0;

    for (const sig of arr) {
      const ageMs = now - sig.time;
      const ageMins = ageMs / 60000;
      // Half-life of 5 minutes — signals from 5min ago count half as much
      const weight = Math.pow(0.5, ageMins / 5);
      weightedSum += sig.value * weight;
      weightTotal += weight;
    }

    if (weightTotal === 0) return 0;
    return Math.round((weightedSum / weightTotal) * 100);
  }

  /**
   * Get the simple average (unweighted) for comparison.
   */
  domainScoreRaw(domain) {
    const arr = this.signals[domain];
    if (!arr || arr.length === 0) return 0;
    const avg = arr.reduce((a, b) => a + b.value, 0) / arr.length;
    return Math.round(avg * 100);
  }

  /**
   * Detect trend for a domain: 'improving', 'declining', or 'stable'.
   */
  domainTrend(domain) {
    const arr = this.signals[domain];
    if (!arr || arr.length < 4) return 'stable';

    // Compare first half average to second half average
    const mid = Math.floor(arr.length / 2);
    const firstHalf  = arr.slice(0, mid);
    const secondHalf = arr.slice(mid);

    const avgFirst  = firstHalf.reduce((s, v) => s + v.value, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, v) => s + v.value, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;
    if (diff > 0.15) return 'improving';
    if (diff < -0.15) return 'declining';
    return 'stable';
  }

  /** Get the weighted overall FLIQ score (0-100). */
  overallScore() {
    let total = 0;
    let activeWeight = 0;
    for (const [key, cfg] of Object.entries(DOMAINS)) {
      const signals = this.signals[key].length;
      if (signals > 0) {
        total += this.domainScore(key) * cfg.weight;
        activeWeight += cfg.weight;
      }
    }
    // Normalize by active domains only (don't penalize unexplored domains)
    if (activeWeight === 0) return 0;
    return Math.round(total / activeWeight);
  }

  /** Get session duration in seconds. */
  sessionDuration() {
    return (Date.now() - this._sessionStart) / 1000;
  }

  /** Get a full report for the Explorer's Chronicle. */
  getChronicle() {
    const report = [];
    for (const [key, cfg] of Object.entries(DOMAINS)) {
      const score   = this.domainScore(key);
      const signals = this.signals[key].length;
      const trend   = this.domainTrend(key);
      const streak  = this._streaks[key];

      let tier;
      if (score >= 80)      tier = 'Legendary';
      else if (score >= 60) tier = 'Skilled';
      else if (score >= 40) tier = 'Growing';
      else if (score >= 20) tier = 'Awakening';
      else                  tier = signals > 0 ? 'Novice' : 'Unexplored';

      // Trend icon for the Chronicle display
      let trendIcon = '';
      if (trend === 'improving') trendIcon = ' ↑';
      else if (trend === 'declining') trendIcon = ' ↓';

      report.push({
        domain:    key,
        label:     cfg.label,
        desc:      cfg.desc,
        score,
        tier,
        trendIcon,
        trend,
        signals,
        goodStreak: streak.good,
        badStreak:  streak.bad,
      });
    }

    const duration = this.sessionDuration();
    const minutes  = Math.floor(duration / 60);

    return {
      overall:      this.overallScore(),
      domains:      report,
      totalSignals: this._totalSignals,
      sessionTime:  `${minutes}m ${Math.floor(duration % 60)}s`,
      activeDomains: report.filter(d => d.signals > 0).length,
    };
  }

  /** Has the player done enough for a meaningful report? */
  hasEnoughData() {
    return this._totalSignals >= 5;
  }

  /** Get signal count for a specific domain. */
  signalCount(domain) {
    return this.signals[domain]?.length ?? 0;
  }

  /** Get total signal count across all domains. */
  totalSignalCount() {
    return this._totalSignals;
  }
}
