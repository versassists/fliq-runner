/**
 * behaviorTracker.js — Phase 3 Passive behavioral signal emitter.
 * Runs every frame, silently observes player behavior,
 * and periodically emits FLIQ signals without any player interaction.
 *
 * Phase 3 Signal Families tracked:
 *   Movement & Route — route_choice_type, exploration_depth, off-path curiosity, backtrack_count
 *   Decision — decision_delay_seconds, optional_event_acceptance_rate, safe/risky choice rate
 *   Spark — spark_spent_rate, spark_saved_rate, spark_waste_events, strategic_activation
 *   Puzzle — puzzle_attempt_count, retry_after_failure, time_to_solution, pattern_detection_speed
 *   NPC/Community — npc_help_rate, mission_priority_shift, fairness, collaboration, generosity
 *   Recovery — failure_reentry_time, quit_after_failure, adaptive_strategy_shift, persistence
 */

export class BehaviorTracker {
  constructor(fliq, player) {
    this.fliq   = fliq;
    this.player = player;

    // ── Movement & Route Signals ──
    this._visitedCells    = new Set();
    this._cellSize        = 5;
    this._lastExploreEmit = 0;
    this._zonesVisited    = new Set();
    this._backtrackCount  = 0;
    this._lastCells       = [];          // recent cell history for backtrack detection
    this._offPathTime     = 0;           // time spent away from main roads
    this._onPathTime      = 0;           // time on main roads
    this._routeEfficiency = [];          // mission route efficiency records

    // ── Spark / Resource Signals ──
    this._sparkHistory      = [];
    this._lastSparkSnapshot = 0;
    this._peakSpark         = 0;
    this._sparkSpentTotal   = 0;         // total Spark spent in session
    this._sparkEarnedTotal  = 0;         // total Spark earned in session
    this._sparkWasteEvents  = 0;         // times Spark was spent with no benefit
    this._strategicUseEvents = 0;        // times Spark was used strategically
    this._lastTrackedSpark  = 0;

    // ── Movement tracking ──
    this._lastPos         = { x: 0, z: 0 };
    this._totalDistance   = 0;
    this._idleTime        = 0;
    this._activeTime      = 0;

    // ── Zone revisit / Decision tracking ──
    this._zoneInteractions = {};
    this._pendingDecision  = null;
    this._optionalEventsOffered = 0;     // count of optional events shown
    this._optionalEventsAccepted = 0;    // count accepted
    this._safeChoices      = 0;
    this._riskyChoices     = 0;
    this._abandonedChoices = 0;          // times player walked away from a decision

    // ── Puzzle Signals ──
    this._puzzleAttempts   = {};         // puzzleId → { attempts, firstTime, solvedTime, hintUsed }
    this._patternDetectionTimes = [];    // times to detect patterns

    // ── NPC / Community Signals ──
    this._npcHelpCount     = 0;
    this._npcIgnoreCount   = 0;
    this._fairnessDecisions = [];        // { fair: bool, context }
    this._generosityEvents = 0;
    this._collaborationEvents = 0;

    // ── Recovery / Persistence Signals ──
    this._failureCount     = 0;
    this._failureReentryTimes = [];      // seconds between failure and retry
    this._lastFailureTime  = 0;
    this._quitAfterFailure = 0;          // times player left zone after failing
    this._strategyShifts   = 0;          // times player changed approach after failure

    // ── Emission intervals (seconds) ──
    this._emitInterval     = 15;
    this._lastEmitTime     = 0;
    this._elapsed          = 0;
  }

  /**
   * Call from the game loop every frame.
   * @param {number} dt  Delta time in seconds
   */
  update(dt) {
    this._elapsed += dt;
    const pos = this.player.group.position;

    // ── Track movement ──
    const dx = pos.x - this._lastPos.x;
    const dz = pos.z - this._lastPos.z;
    const moved = Math.sqrt(dx * dx + dz * dz);

    if (moved > 0.1) {
      this._totalDistance += moved;
      this._activeTime += dt;
    } else {
      this._idleTime += dt;
    }
    this._lastPos.x = pos.x;
    this._lastPos.z = pos.z;

    // ── Track exploration grid ──
    const cellX = Math.floor(pos.x / this._cellSize);
    const cellZ = Math.floor(pos.z / this._cellSize);
    const cellKey = `${cellX},${cellZ}`;
    this._visitedCells.add(cellKey);

    // ── Backtrack detection (revisiting recent cells) ──
    if (this._lastCells.length > 0 && this._lastCells[this._lastCells.length - 1] !== cellKey) {
      if (this._lastCells.includes(cellKey)) {
        this._backtrackCount++;
      }
      this._lastCells.push(cellKey);
      if (this._lastCells.length > 10) this._lastCells.shift();
    } else if (this._lastCells.length === 0) {
      this._lastCells.push(cellKey);
    }

    // ── Off-path curiosity tracking (away from main roads) ──
    const onRoad = Math.abs(pos.x) < 6 || Math.abs(pos.z) < 6;
    if (onRoad) this._onPathTime += dt;
    else this._offPathTime += dt;

    // ── Spark change tracking ──
    const currentSpark = this.player.spark;
    if (this._lastTrackedSpark > 0 && currentSpark !== this._lastTrackedSpark) {
      const diff = currentSpark - this._lastTrackedSpark;
      if (diff > 0) this._sparkEarnedTotal += diff;
      else this._sparkSpentTotal += Math.abs(diff);
    }
    this._lastTrackedSpark = currentSpark;

    // ── Track Spark snapshots (every 3 seconds) ──
    if (this._elapsed - this._lastSparkSnapshot > 3) {
      this._sparkHistory.push({ spark: this.player.spark, time: this._elapsed });
      this._peakSpark = Math.max(this._peakSpark, this.player.spark);
      this._lastSparkSnapshot = this._elapsed;

      // Keep only last 60 snapshots (3 minutes of history)
      if (this._sparkHistory.length > 60) this._sparkHistory.shift();
    }

    // ── Emit passive signals periodically ──
    if (this._elapsed - this._lastEmitTime > this._emitInterval) {
      this._emitPassiveSignals();
      this._lastEmitTime = this._elapsed;
    }
  }

  /**
   * Called by InteractionManager when player enters a zone.
   */
  onZoneEnter(zoneId) {
    this._zonesVisited.add(zoneId);
  }

  /**
   * Called by InteractionManager when player starts a decision (UI opens).
   */
  startDecisionTimer(zoneId, type) {
    this._pendingDecision = {
      startTime: Date.now(),
      zone: zoneId,
      type,
    };
  }

  /**
   * Called when player completes a decision. Returns elapsed ms.
   * Also emits a decision_timing signal based on appropriate speed.
   */
  endDecisionTimer() {
    if (!this._pendingDecision) return 0;
    const elapsed = Date.now() - this._pendingDecision.startTime;
    const type = this._pendingDecision.type;
    this._pendingDecision = null;

    // Decision timing scoring:
    // Too fast (<1s) = impulsive = 0.3
    // Sweet spot (2-8s) = thoughtful = 0.8-1.0
    // Slow (8-15s) = hesitant = 0.5
    // Very slow (>15s) = paralyzed = 0.2
    let timingScore;
    const secs = elapsed / 1000;
    if (secs < 1)       timingScore = 0.3;
    else if (secs < 2)  timingScore = 0.6;
    else if (secs <= 8) timingScore = 0.8 + (1.0 - 0.8) * Math.min(1, (secs - 2) / 4);
    else if (secs <= 15) timingScore = 0.5;
    else                 timingScore = 0.2;

    this.fliq.record('decision_timing', timingScore, `${type}: ${secs.toFixed(1)}s`);
    return elapsed;
  }

  /**
   * Record a zone interaction result for adaptation tracking.
   */
  recordZoneResult(zoneId, success) {
    if (!this._zoneInteractions[zoneId]) {
      this._zoneInteractions[zoneId] = { count: 0, lastTime: 0, results: [] };
    }
    const zi = this._zoneInteractions[zoneId];
    zi.count++;
    zi.lastTime = this._elapsed;
    zi.results.push(success);

    // Emit adaptation signal based on improvement pattern
    if (zi.results.length >= 2) {
      const recent = zi.results.slice(-3);
      const prev   = zi.results.slice(-6, -3);

      if (prev.length > 0) {
        const recentRate = recent.filter(Boolean).length / recent.length;
        const prevRate   = prev.filter(Boolean).length / prev.length;

        if (recentRate > prevRate) {
          // Improving — high adaptation score
          this.fliq.record('adaptation', 0.8, `${zoneId}: improving`);
        } else if (recentRate < prevRate) {
          // Declining — low adaptation
          this.fliq.record('adaptation', 0.3, `${zoneId}: declining`);
        } else {
          this.fliq.record('adaptation', 0.5, `${zoneId}: stable`);
        }
      }
    }

    // Emit pattern recognition for revisits (learning from experience)
    if (zi.count > 1) {
      const lastTwo = zi.results.slice(-2);
      if (lastTwo.length === 2 && !lastTwo[0] && lastTwo[1]) {
        // Failed then succeeded — learned the pattern
        this.fliq.record('pattern_recognition', 0.75, `${zoneId}: retry success`);
      }
    }
  }

  /**
   * Get Spark velocity (rate of change over recent history).
   * Positive = earning, negative = spending fast.
   */
  getSparkVelocity() {
    if (this._sparkHistory.length < 2) return 0;
    const recent = this._sparkHistory.slice(-5);
    const first  = recent[0];
    const last   = recent[recent.length - 1];
    const dt     = last.time - first.time;
    if (dt === 0) return 0;
    return (last.spark - first.spark) / dt;
  }

  /** Emit passive behavioral signals based on observed patterns. */
  _emitPassiveSignals() {
    // ── Pattern Recognition: Exploration depth ──
    const cellCount = this._visitedCells.size;
    const exploreScore = Math.min(1, cellCount / 30);
    if (cellCount > 3) {
      this.fliq.record('pattern_recognition', exploreScore * 0.6 + 0.2,
        `exploration_depth: ${cellCount} cells`);
    }

    // ── Pattern Recognition: Off-path curiosity ──
    const totalPathTime = this._onPathTime + this._offPathTime;
    if (totalPathTime > 20) {
      const offPathRatio = this._offPathTime / totalPathTime;
      if (offPathRatio > 0.4) {
        this.fliq.record('pattern_recognition', 0.75, `off_path_curiosity: ${(offPathRatio * 100).toFixed(0)}%`);
      }
    }

    // ── Risk Awareness: Backtrack behavior ──
    if (this._backtrackCount > 0 && this._elapsed > 30) {
      // Some backtracking = exploring cautiously (good)
      // Excessive = lost/confused
      const btScore = this._backtrackCount < 5 ? 0.7 : this._backtrackCount < 15 ? 0.5 : 0.3;
      this.fliq.record('risk_awareness', btScore, `backtrack_count: ${this._backtrackCount}`);
    }

    // ── Resource Judgment: Spark management ──
    const velocity = this.getSparkVelocity();
    const currentSpark = this.player.spark;

    if (this._sparkHistory.length >= 4) {
      if (currentSpark > 15 && velocity > 0.3) {
        this.fliq.record('resource_judgment', 0.4, 'spark_saved_rate: hoarding');
      } else if (currentSpark === 0 && this._peakSpark > 10) {
        this.fliq.record('resource_judgment', 0.3, 'spark_spent_rate: depleted');
      } else if (currentSpark > 3 && Math.abs(velocity) < 0.5) {
        this.fliq.record('resource_judgment', 0.7, 'spark_spend_context: balanced');
      }
    }

    // ── Resource Judgment: Spark efficiency ratio ──
    if (this._sparkSpentTotal > 0 && this._sparkEarnedTotal > 0) {
      const ratio = this._sparkEarnedTotal / (this._sparkSpentTotal + this._sparkEarnedTotal);
      this.fliq.record('resource_judgment', 0.3 + ratio * 0.5, `spark_efficiency: ${(ratio * 100).toFixed(0)}%`);
    }

    // ── Decision Timing: Activity balance ──
    const totalTime = this._activeTime + this._idleTime;
    if (totalTime > 20) {
      const activeRatio = this._activeTime / totalTime;
      if (activeRatio < 0.2) {
        this.fliq.record('decision_timing', 0.3, 'decision_delay: mostly idle');
      } else if (activeRatio > 0.4 && activeRatio < 0.85) {
        this.fliq.record('decision_timing', 0.65, 'decision_delay: balanced pace');
      }
    }

    // ── Decision Timing: Optional event acceptance rate ──
    if (this._optionalEventsOffered > 2) {
      const acceptRate = this._optionalEventsAccepted / this._optionalEventsOffered;
      this.fliq.record('decision_timing', 0.4 + acceptRate * 0.4,
        `optional_event_acceptance: ${(acceptRate * 100).toFixed(0)}%`);
    }

    // ── Social Intelligence: Zone diversity ──
    const zonesVisited = this._zonesVisited.size;
    if (this._elapsed > 30) {
      if (zonesVisited >= 3) {
        this.fliq.record('social_intelligence', 0.6, `collaboration: visited ${zonesVisited} zones`);
      } else if (zonesVisited <= 1 && this._elapsed > 60) {
        this.fliq.record('adaptation', 0.3, 'persistence: not exploring');
      }
    }

    // ── Social Intelligence: NPC help rate ──
    const totalNPC = this._npcHelpCount + this._npcIgnoreCount;
    if (totalNPC >= 2) {
      const helpRate = this._npcHelpCount / totalNPC;
      this.fliq.record('social_intelligence', 0.3 + helpRate * 0.5,
        `npc_help_rate: ${(helpRate * 100).toFixed(0)}%`);
    }

    // ── Adaptation: Recovery patterns ──
    if (this._failureCount > 0) {
      const avgReentry = this._failureReentryTimes.length > 0
        ? this._failureReentryTimes.reduce((a, b) => a + b, 0) / this._failureReentryTimes.length
        : 999;
      const persistenceScore = avgReentry < 10 ? 0.85 : avgReentry < 30 ? 0.6 : 0.35;
      this.fliq.record('adaptation', persistenceScore,
        `failure_reentry_avg: ${avgReentry.toFixed(0)}s, shifts: ${this._strategyShifts}`);
    }

    // ── Delayed Gratification: Safe vs risky choice balance ──
    const totalChoices = this._safeChoices + this._riskyChoices;
    if (totalChoices >= 3) {
      const safeRate = this._safeChoices / totalChoices;
      // Balanced = best, all safe or all risky = less ideal
      const balance = 1 - Math.abs(safeRate - 0.5) * 2;
      this.fliq.record('delayed_gratification', 0.3 + balance * 0.5,
        `safe_choice_rate: ${(safeRate * 100).toFixed(0)}%`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Phase 3 Signal Recording Methods
  // Called by interaction.js and missions.js
  // ═══════════════════════════════════════════════════════════════

  /** Record player choosing a risky vs safe option */
  recordRiskChoice(risky, context = '') {
    if (risky) {
      this._riskyChoices++;
      this.fliq.record('risk_awareness', 0.6, `risky_choice: ${context}`);
    } else {
      this._safeChoices++;
      this.fliq.record('risk_awareness', 0.7, `safe_choice: ${context}`);
    }
  }

  /** Record player accepting or declining an optional event */
  recordOptionalEvent(accepted, context = '') {
    this._optionalEventsOffered++;
    if (accepted) {
      this._optionalEventsAccepted++;
      this.fliq.record('pattern_recognition', 0.7, `optional_accepted: ${context}`);
    }
  }

  /** Record player abandoning a decision (walking away) */
  recordAbandonedChoice(zoneId) {
    this._abandonedChoices++;
    this.fliq.record('decision_timing', 0.25, `abandoned_choice: ${zoneId}`);
  }

  /** Record a puzzle attempt */
  recordPuzzleAttempt(puzzleId, solved, timeSeconds, hintUsed = false) {
    if (!this._puzzleAttempts[puzzleId]) {
      this._puzzleAttempts[puzzleId] = { attempts: 0, firstTime: this._elapsed, solvedTime: null, hintsUsed: 0 };
    }
    const pa = this._puzzleAttempts[puzzleId];
    pa.attempts++;
    if (hintUsed) pa.hintsUsed++;
    if (solved) pa.solvedTime = this._elapsed;

    // Retry after failure = adaptation signal
    if (pa.attempts > 1 && solved) {
      this.fliq.record('adaptation', 0.8, `puzzle_retry_success: ${puzzleId} after ${pa.attempts} tries`);
    }
    if (pa.attempts > 1 && !solved) {
      this.fliq.record('adaptation', 0.6, `puzzle_retry: ${puzzleId} attempt ${pa.attempts}`);
    }

    // Pattern detection speed
    if (solved && timeSeconds) {
      this._patternDetectionTimes.push(timeSeconds);
      const speed = timeSeconds < 5 ? 0.9 : timeSeconds < 15 ? 0.7 : timeSeconds < 30 ? 0.5 : 0.3;
      this.fliq.record('pattern_recognition', speed, `pattern_speed: ${timeSeconds.toFixed(1)}s`);
    }

    // Hint dependence
    if (hintUsed) {
      this.fliq.record('pattern_recognition', 0.35, `hint_used: ${puzzleId}`);
    }
  }

  /** Record NPC help action */
  recordNPCHelp(npcId, context = '') {
    this._npcHelpCount++;
    this.fliq.record('social_intelligence', 0.8, `npc_help: ${npcId} ${context}`);
  }

  /** Record ignoring an NPC in need */
  recordNPCIgnored(npcId) {
    this._npcIgnoreCount++;
    // Don't penalize heavily — just note the choice
    this.fliq.record('social_intelligence', 0.4, `npc_ignored: ${npcId}`);
  }

  /** Record a generosity event (giving Spark to help others) */
  recordGenerosity(amount, context = '') {
    this._generosityEvents++;
    this.fliq.record('social_intelligence', 0.85, `generosity: ${amount} Spark, ${context}`);
    this.fliq.record('delayed_gratification', 0.7, `gave_up_spark: ${amount}`);
  }

  /** Record a fairness decision */
  recordFairnessDecision(fair, context = '') {
    this._fairnessDecisions.push({ fair, context });
    this.fliq.record('social_intelligence', fair ? 0.8 : 0.35, `fairness: ${context}`);
  }

  /** Record a failure event */
  recordFailure(zoneId) {
    this._failureCount++;
    this._lastFailureTime = this._elapsed;
  }

  /** Record re-entry after failure (persistence signal) */
  recordFailureReentry(zoneId) {
    if (this._lastFailureTime > 0) {
      const reentryTime = this._elapsed - this._lastFailureTime;
      this._failureReentryTimes.push(reentryTime);
      // Quick re-entry = persistence
      const score = reentryTime < 10 ? 0.85 : reentryTime < 30 ? 0.65 : reentryTime < 60 ? 0.45 : 0.25;
      this.fliq.record('adaptation', score, `reentry_after_failure: ${reentryTime.toFixed(0)}s`);
    }
  }

  /** Record player quitting a zone after failure */
  recordQuitAfterFailure(zoneId) {
    this._quitAfterFailure++;
    this.fliq.record('adaptation', 0.2, `quit_after_failure: ${zoneId}`);
  }

  /** Record a strategic Spark use */
  recordStrategicSparkUse(context = '') {
    this._strategicUseEvents++;
    this.fliq.record('resource_judgment', 0.8, `strategic_spark: ${context}`);
  }

  /** Record Spark waste (spent with no benefit) */
  recordSparkWaste(context = '') {
    this._sparkWasteEvents++;
    this.fliq.record('resource_judgment', 0.25, `spark_waste: ${context}`);
  }

  /** Record Spark saved for later (delayed gratification) */
  recordSparkSaved(context = '') {
    this.fliq.record('delayed_gratification', 0.8, `spark_saved: ${context}`);
  }

  /** Record strategy shift after setback */
  recordStrategyShift(context = '') {
    this._strategyShifts++;
    this.fliq.record('adaptation', 0.85, `strategy_shift: ${context}`);
  }

  /** Get summary stats for debugging / Chronicle enrichment. */
  getStats() {
    return {
      cellsExplored:   this._visitedCells.size,
      zonesVisited:    this._zonesVisited.size,
      totalDistance:    Math.round(this._totalDistance),
      activeTime:      Math.round(this._activeTime),
      idleTime:        Math.round(this._idleTime),
      peakSpark:       this._peakSpark,
      sparkVelocity:   this.getSparkVelocity().toFixed(2),
      // Phase 3 additions
      backtrackCount:  this._backtrackCount,
      sparkSpent:      this._sparkSpentTotal,
      sparkEarned:     this._sparkEarnedTotal,
      sparkWaste:      this._sparkWasteEvents,
      strategicUses:   this._strategicUseEvents,
      npcHelped:       this._npcHelpCount,
      npcIgnored:      this._npcIgnoreCount,
      generosity:      this._generosityEvents,
      failures:        this._failureCount,
      strategyShifts:  this._strategyShifts,
      riskyChoices:    this._riskyChoices,
      safeChoices:     this._safeChoices,
      puzzlesAttempted: Object.keys(this._puzzleAttempts).length,
    };
  }
}
