export class HomeUi {
  constructor() {
    const app = document.getElementById('app');
    if (!app) {
      throw new Error('FinCrew home app container was not found.');
    }

    app.innerHTML = `
      <div class="fincrew-3d-shell">
        <div class="scene-wrap">
          <canvas id="home3d-canvas" aria-label="FinCrew financial campus"></canvas>
        </div>

        <div class="hud-overlay">
          <header class="fincrew-topbar">
            <div>
              <div class="eyebrow">FINCREW</div>
              <div class="tagline">Your business. Watched 24/7.</div>
            </div>
            <div class="sim-badge">SIMULATED BUSINESS DATA</div>
          </header>

          <div class="health-panel glass-panel">
            <div class="eyebrow">FINANCIAL HEALTH</div>
            <div class="health-row">
              <span id="health-number" class="health-number">82</span>
              <span class="health-total"> / 100</span>
            </div>
            <div id="health-level" class="health-level">HEALTHY</div>
            <p id="health-reason" class="health-reason">Everything looks steady.</p>
          </div>

          <div class="priorities-panel glass-panel">
            <div class="eyebrow">WHAT SHOULD I DO TODAY?</div>
            <ul id="priority-list" class="priority-list"></ul>
          </div>

          <div class="cta-row">
            <button id="start-sim-btn" class="cta-button primary" type="button">START SIMULATION</button>
            <button id="next-event-btn" class="cta-button" type="button">NEXT EVENT</button>
            <button id="copilot-btn" class="cta-button" type="button">TALK TO FINCREW</button>
            <button id="two-d-btn" class="cta-button subtle" type="button">2D VIEW</button>
            <button id="game-btn" class="cta-button subtle" type="button">Game-A-Thon</button>
          </div>

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
    this.tooltip = document.getElementById('canvas-tooltip');
    this.statusBanner = document.getElementById('status-banner');
  }

  bind({ onStart, onNext, onOpen2D, onOpenGame, onOpenCopilot, onAct, onWhy }) {
    document.getElementById('start-sim-btn').addEventListener('click', onStart);
    document.getElementById('next-event-btn').addEventListener('click', onNext);
    document.getElementById('two-d-btn').addEventListener('click', onOpen2D);
    document.getElementById('game-btn').addEventListener('click', onOpenGame);
    document.getElementById('copilot-btn').addEventListener('click', onOpenCopilot);

    this.onAct = onAct;
    this.onWhy = onWhy;
    this.attachEventButtons();
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

    const priorities = Array.isArray(state?.priorities) ? state.priorities.slice(0, 4) : [];
    this.priorityList.innerHTML = priorities.length
      ? priorities.map((item) => `<li>${item.icon ? `<span>${item.icon}</span>` : ''}${item.text || ''}</li>`).join('')
      : '<li><span>✦</span>Keep the cash buffer healthy.</li>';

    const currentEvent = state?.current;
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
