export class HomeUi {
  constructor() {
    const app = document.getElementById('app');
    if (!app) {
      throw new Error('FinCrew home app container was not found.');
    }

    app.innerHTML = `
      <div class="fincrew-3d-shell">
        <div class="scene-wrap">
          <canvas id="home3d-canvas" aria-label="FinCrew Cashflow Racer 3D road"></canvas>
        </div>

        <div class="hud-overlay">
          <header class="fincrew-topbar">
            <div>
              <div class="eyebrow">FINCREW</div>
              <div class="tagline">Your business. Watched 24/7.</div>
            </div>
            <div class="topbar-status">
              <div class="game-badge">CASHFLOW RACER</div>
              <div class="sim-badge">SIMULATED BUSINESS DATA</div>
            </div>
          </header>

          <section class="game-panel glass-panel" aria-label="Cashflow Racer game and mission progress">
            <div class="game-panel-top">
              <span class="eyebrow">CITY RUN · CASHFLOW RESCUE</span>
              <span id="game-progress" class="game-progress">RUN READY</span>
            </div>
            <div class="race-stats" aria-label="Driving game statistics">
              <div><span>SCORE</span><strong id="race-score">000000</strong></div>
              <div><span>DISTANCE</span><strong><span id="race-distance">0</span> m</strong></div>
              <div><span>SPEED</span><strong><span id="race-speed">0</span> <small>km/h</small></strong></div>
            </div>
            <div class="cash-shield">
              <div><span>CASH SHIELD</span><strong id="race-shield-label">100%</strong></div>
              <div class="shield-meter" role="progressbar" aria-label="Cash shield" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
                <span id="race-shield-fill"></span>
              </div>
            </div>
            <button id="drive-start-btn" class="drive-start-button" type="button">START ENGINE</button>
            <div class="mission-meter" role="progressbar" aria-label="Campaign progress" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0">
              <span id="mission-meter-fill"></span>
            </div>
            <ol id="quest-track" class="quest-track" aria-label="Five Cashflow Rescue missions">
              <li data-quest-step="late"><span>01</span><small>RECOVER</small></li>
              <li data-quest-step="expense"><span>02</span><small>SHIELD</small></li>
              <li data-quest-step="suspicious"><span>03</span><small>SCAN</small></li>
              <li data-quest-step="deadline"><span>04</span><small>PROTECT</small></li>
              <li data-quest-step="order"><span>05</span><small>GROW</small></li>
            </ol>
            <strong id="game-objective" class="game-objective">Drive smart. Protect your cash.</strong>
            <p id="game-instruction" class="game-instruction">Collect gold cash tokens, dodge expense crates, and steer with ← → or A / D.</p>
            <div class="game-panel-foot">
              <span>MISSION XP</span>
              <strong id="mission-xp">0</strong>
              <span class="game-foot-note">Earned for each completed mission</span>
            </div>
          </section>

          <div class="health-panel glass-panel">
            <div class="eyebrow">BUSINESS SHIELD · FINANCIAL HEALTH</div>
            <div class="health-row">
              <span id="health-number" class="health-number">82</span>
              <span class="health-total"> / 100</span>
            </div>
            <div id="health-level" class="health-level">HEALTHY</div>
            <p id="health-reason" class="health-reason">Everything looks steady.</p>
          </div>

          <div class="priorities-panel glass-panel">
            <div class="eyebrow">LIVE MISSION INTEL</div>
            <ul id="priority-list" class="priority-list"></ul>
          </div>

          <div class="cta-row">
            <button id="start-sim-btn" class="cta-button primary" type="button">START FINANCE RUN</button>
            <button id="next-event-btn" class="cta-button" type="button" disabled>NEXT MISSION</button>
            <button id="copilot-btn" class="cta-button crew-button" type="button" aria-expanded="false" aria-controls="crew-panel">CALL CREWS AI</button>
            <button id="two-d-btn" class="cta-button subtle" type="button">2D VIEW</button>
          </div>

          <div class="drive-controls" aria-label="Driving controls">
            <button id="drive-left-btn" type="button" aria-label="Steer left">←</button>
            <button id="drive-sound-btn" class="drive-sound-button" type="button" aria-pressed="true" aria-label="Turn game sound off">🔊</button>
            <button id="drive-pause-btn" type="button" aria-label="Pause or resume drive">Ⅱ</button>
            <button id="drive-right-btn" type="button" aria-label="Steer right">→</button>
          </div>

          <aside id="crew-panel" class="crew-panel glass-panel hidden" aria-label="Crews AI chat">
            <div class="crew-panel-head">
              <div>
                <div class="eyebrow">YOUR FINANCIAL CO-PILOT</div>
                <strong>Crews AI</strong>
              </div>
              <button id="crew-close-btn" class="crew-close" type="button" aria-label="Close Crews AI">×</button>
            </div>
            <div id="crew-messages" class="crew-messages" aria-live="polite">
              <p class="crew-message assistant">Hi, I’m Crews AI. When the microphone says it’s on, say “Crews” followed by your question. You can also type below.</p>
            </div>
            <form id="crew-form" class="crew-form">
              <label class="sr-only" for="crew-input">Ask Crews AI a question</label>
              <input id="crew-input" type="text" maxlength="500" placeholder="Ask Crews about your business…" autocomplete="off" required>
              <button class="crew-send" type="submit">SEND</button>
            </form>
            <div class="crew-voice-row">
              <button id="crew-mic-btn" class="crew-mic" type="button" aria-pressed="false">🎙 SAY “CREWS”</button>
              <span id="crew-voice-status" aria-live="polite">Tap CALL CREWS AI to turn on the microphone, then say “Crews”.</span>
            </div>
            <a class="crew-full-link" href="FinCrew.html">Open full Crews AI Copilot</a>
          </aside>

          <aside id="event-panel" class="event-panel glass-panel hidden">
            <div class="event-head">
              <div id="event-title" class="event-title">Active event</div>
              <div id="event-badge" class="event-badge">LIVE</div>
            </div>
            <p id="event-summary" class="event-summary">No event is active.</p>
            <div id="event-actions" class="event-actions"></div>
          </aside>
        </div>

        <div id="canvas-tooltip" class="canvas-tooltip hidden" aria-live="polite"></div>
        <div id="status-banner" class="status-banner hidden" aria-live="polite"></div>
      </div>
    `;

    this.root = app;
    this.canvas = document.getElementById('home3d-canvas');
    this.healthNumber = document.getElementById('health-number');
    this.healthLevel = document.getElementById('health-level');
    this.healthReason = document.getElementById('health-reason');
    this.priorityList = document.getElementById('priority-list');
    this.eventPanel = document.getElementById('event-panel');
    this.eventTitle = document.getElementById('event-title');
    this.eventSummary = document.getElementById('event-summary');
    this.eventBadge = document.getElementById('event-badge');
    this.eventActions = document.getElementById('event-actions');
    this.gameProgress = document.getElementById('game-progress');
    this.questTrack = document.getElementById('quest-track');
    this.gameObjective = document.getElementById('game-objective');
    this.gameInstruction = document.getElementById('game-instruction');
    this.missionMeter = this.root.querySelector('.mission-meter');
    this.missionMeterFill = document.getElementById('mission-meter-fill');
    this.missionXp = document.getElementById('mission-xp');
    this.raceScore = document.getElementById('race-score');
    this.raceDistance = document.getElementById('race-distance');
    this.raceSpeed = document.getElementById('race-speed');
    this.raceShieldLabel = document.getElementById('race-shield-label');
    this.raceShieldMeter = this.root.querySelector('.shield-meter');
    this.raceShieldFill = document.getElementById('race-shield-fill');
    this.driveStartButton = document.getElementById('drive-start-btn');
    this.startButton = document.getElementById('start-sim-btn');
    this.nextButton = document.getElementById('next-event-btn');
    this.crewPanel = document.getElementById('crew-panel');
    this.crewInput = document.getElementById('crew-input');
    this.crewMessages = document.getElementById('crew-messages');
    this.crewVoiceStatus = document.getElementById('crew-voice-status');
    this.tooltip = document.getElementById('canvas-tooltip');
    this.statusBanner = document.getElementById('status-banner');
  }

  bind({ onStart, onNext, onOpen2D, onAct, onWhy, onCrewQuestion, onCrewVoice, onCrewStop, onCrewVoiceQuestion, onDriveStart, onDriveLeft, onDriveRight, onDrivePause, onDriveSound }) {
    document.getElementById('start-sim-btn').addEventListener('click', onStart);
    document.getElementById('next-event-btn').addEventListener('click', onNext);
    document.getElementById('two-d-btn').addEventListener('click', onOpen2D);
    this.driveStartButton.addEventListener('click', onDriveStart);
    document.getElementById('drive-left-btn').addEventListener('click', onDriveLeft);
    document.getElementById('drive-right-btn').addEventListener('click', onDriveRight);
    document.getElementById('drive-pause-btn').addEventListener('click', onDrivePause);
    document.getElementById('drive-sound-btn').addEventListener('click', onDriveSound);
    document.getElementById('copilot-btn').addEventListener('click', () => {
      if (this.crewPanel.classList.contains('hidden')) {
        this.openCrew(onCrewVoice);
      } else {
        onCrewStop?.();
        this.closeCrew();
      }
    });
    document.getElementById('crew-close-btn').addEventListener('click', () => {
      onCrewStop?.();
      this.closeCrew();
    });
    document.getElementById('crew-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const message = this.crewInput.value.trim();
      if (message) {
        this.crewInput.value = '';
        onCrewQuestion(message);
      }
    });
    document.getElementById('crew-mic-btn').addEventListener('click', () => onCrewVoice?.());
    this.onCrewVoiceQuestion = onCrewVoiceQuestion;

    this.onAct = onAct;
    this.onWhy = onWhy;
    this.attachEventButtons();
  }

  openCrew(onCrewVoice) {
    this.crewPanel.classList.remove('hidden');
    document.querySelector('.fincrew-3d-shell')?.classList.add('crew-open');
    document.getElementById('copilot-btn').setAttribute('aria-expanded', 'true');
    this.crewInput.focus();
    onCrewVoice?.();
  }

  closeCrew() {
    this.crewPanel.classList.add('hidden');
    document.querySelector('.fincrew-3d-shell')?.classList.remove('crew-open');
    document.getElementById('copilot-btn').setAttribute('aria-expanded', 'false');
  }

  addCrewMessage(text, role = 'assistant') {
    const message = document.createElement('p');
    message.className = `crew-message ${role}`;
    message.textContent = text;
    this.crewMessages.appendChild(message);
    this.crewMessages.scrollTop = this.crewMessages.scrollHeight;
    return message;
  }

  setCrewVoiceStatus(text) {
    this.crewVoiceStatus.textContent = text;
  }

  setCrewVoiceActive(active) {
    const button = document.getElementById('crew-mic-btn');
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? '■ STOP LISTENING' : '🎙 START VOICE';
  }

  updateDrive(drive) {
    this.root.querySelector('.fincrew-3d-shell').classList.toggle('drive-active', drive.active);
    this.raceScore.textContent = String(Math.floor(drive.score)).padStart(6, '0');
    this.raceDistance.textContent = String(Math.floor(drive.distance));
    this.raceSpeed.textContent = String(Math.round(drive.speed));
    this.raceShieldLabel.textContent = `${drive.shield}%`;
    this.raceShieldMeter.setAttribute('aria-valuenow', String(drive.shield));
    this.raceShieldFill.style.width = `${drive.shield}%`;
    this.raceShieldFill.dataset.tone = drive.shield <= 35 ? 'low' : drive.shield <= 65 ? 'medium' : 'high';
    this.driveStartButton.textContent = drive.active
      ? 'DRIVE IN PROGRESS'
      : drive.gameOver
        ? 'RETRY DRIVE'
        : drive.distance
          ? 'RESUME DRIVE'
          : 'START ENGINE';
    this.driveStartButton.disabled = drive.active;
    this.driveStartButton.setAttribute('aria-label', this.driveStartButton.textContent);
    const soundButton = document.getElementById('drive-sound-btn');
    soundButton.setAttribute('aria-pressed', String(drive.soundEnabled));
    soundButton.setAttribute('aria-label', drive.soundEnabled ? 'Turn game sound off' : 'Turn game sound on');
    soundButton.textContent = drive.soundEnabled ? '🔊' : '🔇';
    document.getElementById('drive-pause-btn').textContent = drive.active ? 'Ⅱ' : '▶';
    document.getElementById('drive-pause-btn').setAttribute('aria-label', drive.active ? 'Pause drive' : 'Resume drive');
  }

  attachEventButtons() {
    this.eventActions.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action-id]');
      if (!btn) {
        return;
      }
      const actionId = btn.dataset.actionId;
      if (actionId === 'why') {
        this.onWhy?.();
        return;
      }
      this.onAct?.(actionId);
    });
  }

  update(state) {
    const score = Number(state?.score ?? 82);
    const tone = state?.level_tone || 'green';
    this.healthNumber.textContent = String(score);
    this.healthLevel.textContent = String(state?.level || 'HEALTHY').toUpperCase();
    this.healthLevel.dataset.tone = tone;
    this.healthReason.textContent = state?.reason || 'Everything looks steady.';
    const done = Array.isArray(state?.done) ? state.done.length : 0;
    const total = Number(state?.total || 5);
    this.gameObjective.textContent = state?.current?.title || (state?.finished ? 'Rescue run complete' : done ? 'Sector clear. Prepare for the next mission.' : 'Drive smart. Protect your cash.');
    this.gameInstruction.textContent = state?.current?.recommendation
      ? `${state.current.recommendation} Choose a move below. Important decisions always need your approval.`
      : state?.finished
        ? 'All five sectors are clear. Review the financial outcome and your decisions in the Activity Log.'
        : 'Collect gold cash tokens, dodge expense crates, and steer with ← → or A / D.';

    const priorities = Array.isArray(state?.priorities) ? state.priorities.slice(0, 4) : [];
    this.priorityList.innerHTML = priorities.length
      ? priorities.map((item) => `<li>${item.icon ? `<span>${item.icon}</span>` : ''}${item.text || ''}</li>`).join('')
      : '<li><span>✦</span>Keep the cash shield healthy.</li>';

    const currentEvent = state?.current;
    this.gameProgress.textContent = state?.finished
      ? 'ALL SECTORS CLEAR'
      : currentEvent
        ? `MISSION ${Math.min(done + 1, total)} / ${total}`
        : done
          ? `${done} / ${total} SECTORS CLEAR`
          : 'RUN READY';
    this.missionMeter.setAttribute('aria-valuenow', String(done));
    this.missionMeterFill.style.width = `${Math.min(done / total, 1) * 100}%`;
    this.missionXp.textContent = String(done * 100);
    this.startButton.textContent = state?.started ? 'RESTART FINANCE RUN' : 'START FINANCE RUN';
    this.startButton.setAttribute('aria-label', state?.started ? 'Restart the finance rescue run' : 'Start the finance rescue run');
    this.nextButton.disabled = !state?.started || Boolean(currentEvent) || Boolean(state?.finished);
    const completedIds = new Set((state?.done || []).map((item) => item.id));
    this.questTrack.querySelectorAll('[data-quest-step]').forEach((step) => {
      const id = step.dataset.questStep;
      step.classList.toggle('complete', completedIds.has(id));
      step.classList.toggle('active', state?.current?.id === id);
    });
    if (currentEvent) {
      this.eventPanel.classList.remove('hidden');
      this.eventTitle.textContent = currentEvent.title || 'Active event';
      this.eventBadge.textContent = currentEvent.tone === 'green' ? 'OPPORTUNITY' : 'LIVE';
      this.eventSummary.textContent = currentEvent.what || currentEvent.recommendation || 'FinCrew has a recommendation ready.';

      const actions = Array.isArray(currentEvent.actions) ? currentEvent.actions : [];
      this.eventActions.innerHTML = actions.length
        ? actions.map(({ id, label, tone }) => {
            const className = tone === 'primary' ? 'primary' : tone === 'warn' ? 'warn' : 'ghost';
            const text = (label || id || '').toUpperCase();
            return `<button class="panel-action ${className}" type="button" data-action-id="${id}">${text}</button>`;
          }).join('') + '<button class="panel-action ghost" type="button" data-action-id="why">WHY?</button>'
        : '<button class="panel-action ghost" type="button" data-action-id="why">WHY?</button>';
    } else {
      this.eventPanel.classList.add('hidden');
      this.eventActions.innerHTML = '';
    }
  }

  showStatus(message, tone = 'info') {
    this.statusBanner.textContent = message;
    this.statusBanner.dataset.tone = tone;
    this.statusBanner.classList.remove('hidden');
    clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => this.statusBanner.classList.add('hidden'), 4200);
  }

  setTooltip(html, x, y) {
    if (!html) {
      this.tooltip.classList.add('hidden');
      return;
    }
    this.tooltip.innerHTML = html;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    this.tooltip.classList.remove('hidden');
  }

  hideTooltip() {
    this.tooltip.classList.add('hidden');
  }
}
