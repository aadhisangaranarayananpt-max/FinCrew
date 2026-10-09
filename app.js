(() => {
  "use strict";

  const root = document.getElementById("root");
  const banner = document.getElementById("banner");
  const modal = document.getElementById("modal");
  const toast = document.getElementById("toast");
  const navItems = [
    ["overview", "Overview", "⌂"],
    ["cashflow", "Cash Flow", "↗"],
    ["invoices", "Invoices", "▤"],
    ["expenses", "Expenses", "−"],
    ["risks", "Risks", "◇"],
    ["obligations", "Obligations", "▣"],
    ["opportunities", "Opportunities", "✳"],
    ["ai", "CRUES AI", "✦"],
    ["activity", "Activity", "◷"],
    ["simulation", "Simulation", "🎮"]
  ];
  const CRUES_MESSAGES = {
    challenge: "CRUES found something we should handle.",
    path: "I’ve created a path for you.",
    success: "Nice! That obstacle is cleared.",
    stronger: "Your business is getting stronger.",
    risk: "A new challenge appeared. Let’s find the safest path forward."
  };

  const LANGUAGE_MAP = { en: "en-US", hi: "hi-IN", es: "es-ES" };
  const DEFAULT_VOICE_ENABLED = false;

  function showGuideMessage(key, fallback = "") {
    const message = CRUES_MESSAGES[key] || fallback;
    if (message) showToast(message);
  }

  function currentVoiceLanguage() {
    const stored = localStorage.getItem("fincrew-language") || "en";
    return LANGUAGE_MAP[stored] || LANGUAGE_MAP.en;
  }

  function updateVoiceControls() {
    const select = document.getElementById("cruesLangSelect");
    const button = document.getElementById("cruesVoiceToggle");
    const language = localStorage.getItem("fincrew-language") || "en";
    const enabled = localStorage.getItem("fincrew-voice-enabled") === "true";
    if (select) {
      select.value = Object.prototype.hasOwnProperty.call(LANGUAGE_MAP, language) ? language : "en";
    }
    if (button) {
      button.textContent = enabled ? "Voice on" : "Voice off";
      button.setAttribute("aria-pressed", String(enabled));
      button.classList.toggle("is-on", enabled);
    }
    document.documentElement.lang = language;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
  const suggested = [
    "How is my business doing?",
    "What should I do today?",
    "What is my biggest risk?",
    "Why did my score fall?",
    "Can I afford this expense?",
    "What happens if my customer pays late?",
    "Explain this simply."
  ];
  const BUSINESS_TYPES = [
    "Retail", "Restaurant", "Café", "Clothing", "Salon", "Freelancer", "Service", "E-commerce",
    "Wholesale", "Manufacturing", "Agency", "Startup", "Other"
  ];
  const DEFAULT_BUSINESS_PROFILE = {
    name: "AriaCraft Supplies",
    type: "Retail",
    customType: "",
    sells: "Craft and hobby materials",
    revenue: 680000,
    expenses: 420000,
    employees: 8,
    payment: "Mostly card and bank transfer",
    majorExpenses: "Inventory, rent, staffing, packaging",
    cash: 480000,
    receivables: 135000,
    payables: 95000,
    obligations: 95000,
    risk: "Medium",
    opportunities: "Buy in bulk, improve cash collection, upsell repeat customers"
  };
  const keySimple = "fincrew-simple-mode";
  const keyBusinessProfile = "fincrew-business-profile";
  let state = null;

  function getBusinessProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem(keyBusinessProfile) || "null");
      return { ...DEFAULT_BUSINESS_PROFILE, ...(raw || {}) };
    } catch (_) {
      return { ...DEFAULT_BUSINESS_PROFILE };
    }
  }

  function saveBusinessProfile(profile) {
    localStorage.setItem(keyBusinessProfile, JSON.stringify(profile));
  }

  async function syncBusinessProfileToServer(profile = getBusinessProfile()) {
    try {
      await request("/api/business-profile", profile);
    } catch (_) {
      // The frontend can still operate locally even if the backend is not available yet.
    }
  }

  function businessTypeDisplay(profile = getBusinessProfile()) {
    return profile.type === "Other" ? (profile.customType || "Custom business") : (profile.type || "Retail");
  }

  function businessProfileSummary() {
    const business = getBusinessProfile();
    const type = businessTypeDisplay(business);
    return `${business.name || "Your business"} · ${type}`;
  }
  let selectedWhatIf = "spend";
  let toastTimer;
  let voiceRecognition = null;
  let chatHistory = readHistory();

  function readHistory() {
    try {
      const items = JSON.parse(localStorage.getItem("fincrew-chat-history") || "[]");
      return Array.isArray(items) ? items.slice(-40) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem("fincrew-chat-history", JSON.stringify(chatHistory.slice(-40)));
    } catch (_) {
      showToast("Conversation could not be saved on this device.");
    }
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function richText(value) {
    return esc(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  }

  function money(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  function currentPage() {
    const allowed = navItems.map((item) => item[0]);
    const hash = location.hash.replace(/^#/, "");
    if (allowed.includes(hash)) return hash;
    const initial = document.body.dataset.page;
    return initial === "chat" ? "ai" : initial === "game" ? "simulation" : "overview";
  }

  function simpleMode() {
    return localStorage.getItem(keySimple) === "true";
  }

  async function request(path, body) {
    let response;
    try {
      response = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store"
      });
    } catch (_) {
      throw new Error("FinCrew can't reach its local backend. Start the app with start-fincrew.cmd, then refresh this page.");
    }
    let result;
    try {
      result = await response.json();
    } catch (_) {
      throw new Error("FinCrew received an unexpected response. Please refresh and try again.");
    }
    if (!response.ok) throw new Error(result.error || "That request could not be completed.");
    return result;
  }

  function setBanner(message, kind) {
    banner.textContent = message;
    banner.className = "banner" + (kind ? " " + kind : "");
    banner.hidden = !message;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3400);
  }

  function showModal(content) {
    modal.innerHTML = `<div class="mc">${content}<div class="row modal-actions"><button class="btn" data-close-modal>Close</button></div></div>`;
    modal.hidden = false;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.querySelector("[data-close-modal]").focus();
  }

  function closeModal() {
    modal.hidden = true;
    modal.innerHTML = "";
  }

  function navMarkup(active) {
    return navItems.map(([id, label, icon]) => `<a href="#${id}" class="${active === id ? "on" : ""}" ${active === id ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span>${label}</a>`).join("");
  }

  function shell(content, active, title) {
    const business = getBusinessProfile();
    return `<div class="app">
      <aside class="side">
        <a class="brand" href="index.html#overview" aria-label="CRUES overview">
          <span class="logo">C</span><span><strong>CRUES</strong><small>Your business. Watched 24/7.</small></span>
        </a>
        <nav aria-label="Main navigation">${navMarkup(active)}</nav>
        <div class="side-foot">
          <button class="btn sm" data-edit-business>Business setup</button>
          <label class="switch"><input id="simple-toggle" type="checkbox" ${simpleMode() ? "checked" : ""}> SIMPLE MODE</label>
          <a class="subtle-link" href="FinCrew.html">Open CRUES assistant ↗</a>
          <a class="subtle-link" href="fincrew-game.html">Judge demo ↗</a>
          <span class="sim-tag">${esc(business.name || "Business profile")}</span>
        </div>
      </aside>
      <main>
        <header class="top"><div><span class="eyebrow">${esc(business.name || "YOUR BUSINESS")}</span><strong class="top-title">${esc(title)}</strong></div>
          <div class="top-tools">
            <label class="lang-label" for="cruesLangSelect">Language</label>
            <select id="cruesLangSelect" aria-label="Choose language">
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="es">Español</option>
            </select>
            <button class="btn sm voice-toggle" id="cruesVoiceToggle" type="button" aria-pressed="false">Voice off</button>
          </div>
          <span class="live"><i></i> CRUES is watching</span>
        </header>
        <div class="view">${content}</div>
      </main>
    </div>`;
  }

  function businessSetupModalMarkup() {
    const business = getBusinessProfile();
    const options = BUSINESS_TYPES.map((type) => `<option value="${esc(type)}" ${business.type === type ? "selected" : ""}>${esc(type)}</option>`).join("");
    return `<div class="mc"><span class="mtag">BUSINESS SETUP</span><h3>Tell FinCrew about your business</h3>
      <form id="business-profile-form">
        <div class="grid2">
          <label>Business name<input name="name" value="${esc(business.name || "")}" required></label>
          <label>Business type<select name="type">${options}</select></label>
          <label>What you sell/provide<input name="sells" value="${esc(business.sells || "")}"></label>
          <label>Monthly revenue<input name="revenue" type="number" min="0" step="1000" value="${Number(business.revenue || 0)}"></label>
          <label>Monthly expenses<input name="expenses" type="number" min="0" step="1000" value="${Number(business.expenses || 0)}"></label>
          <label>Number of employees<input name="employees" type="number" min="0" step="1" value="${Number(business.employees || 0)}"></label>
          <label>How customers pay<input name="payment" value="${esc(business.payment || "")}"></label>
          <label>Major expenses<input name="majorExpenses" value="${esc(business.majorExpenses || "")}"></label>
          <label>Custom business type<input name="customType" value="${esc(business.customType || "")}" placeholder="Only if you chose Other"></label>
        </div>
        <div class="row modal-actions">
          <button type="submit" class="btn primary" data-save-business>Save profile</button>
          <button type="button" class="btn" data-reset-business>Reset</button>
          <button type="button" class="btn" data-close-modal>Close</button>
        </div>
      </form>
    </div>`;
  }

  function metricCard(label, value, gloss, key) {
    return `<article class="m"><span>${esc(label)}</span><b>${esc(value)}</b>${simpleMode() && gloss ? `<p class="gloss"><b>What does this mean?</b> ${esc(gloss)}</p>` : ""}${key ? `<button class="link" data-ask="${esc(key)}">Ask FinCrew</button>` : ""}</article>`;
  }

  function scoreHero(s) {
    const sc = Number(s.score || 0);
    const tone = s.level_tone || "green";
    const circumference = 2 * Math.PI * 78;
    const offset = circumference * (1 - sc / 100);
    return `<section class="hero">
      <div><p class="eyebrow">FINANCIAL HEALTH</p><div class="score ${tone}">${sc}<small> / 100</small></div>
        <span class="pill ${tone}">${esc(s.level || "HEALTHY")}</span>
        <p class="reason">${esc(s.reason || "Your business is steady. FinCrew is keeping an eye on the important numbers.")}</p>
        <button class="link" data-open-reason>Why did my score change?</button>
      </div>
      <svg class="ring" viewBox="0 0 180 180" role="img" aria-label="Financial health ${sc} out of 100">
        <circle class="ring-bg" cx="90" cy="90" r="78"></circle>
        <circle class="ring-fg ${tone}" cx="90" cy="90" r="78" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 90 90)"></circle>
        <text x="90" y="84" text-anchor="middle" class="ring-label">HEALTH</text><text x="90" y="111" text-anchor="middle" class="ring-value">${sc}</text>
      </svg>
    </section>`;
  }

  function businessJourneyScene(s) {
    const business = getBusinessProfile();
    const businessType = businessTypeDisplay(business);
    const score = Number(s.score || 0);
    const activeStep = Math.min(5, Math.max(1, Math.round(score / 20)));
    const challenges = [
      { label: "Late payment", icon: "⚠️", tone: "red", x: "16%", y: "28%" },
      { label: "Cash gap", icon: "💸", tone: "amber", x: "50%", y: "14%" },
      { label: "Obligation", icon: "📅", tone: "yellow", x: "80%", y: "34%" },
      { label: "Action", icon: "🧭", tone: "blue", x: "34%", y: "72%" },
      { label: "Success", icon: "🏆", tone: "green", x: "70%", y: "74%" }
    ];
    const pathSteps = ["Challenge", "Understand", "CRUES", "Action", "Progress", "Stronger Business"];
    return `<section class="story-stage crues-story-stage">
      <div class="story-copy">
        <p class="eyebrow">FROM STRUGGLE TO SUCCESS</p>
        <h2>Your business journey</h2>
        <p>CRUES turns today’s risks into a clear route forward for ${esc(business.name || "your business")}.</p>
      </div>
      <div class="story-visual crues-story-visual" aria-hidden="true">
        <div class="story-glow"></div>
        <div class="business-core crues-business-core">
          <span>${esc(businessType)}</span>
          <strong>${score}/100</strong>
          <small>${esc(s.level || "Healthy")}</small>
        </div>
        ${challenges.map((item) => `<div class="challenge-node crues-challenge-node ${item.tone}" style="left:${item.x};top:${item.y};"><span>${item.icon}</span><strong>${esc(item.label)}</strong></div>`).join("")}
      </div>
      <div class="story-path crues-journey">
        ${pathSteps.map((step, index) => `<span class="story-step crues-step ${index <= activeStep ? "on" : ""}">${esc(step)}</span>`).join("")}
      </div>
    </section>`;
  }

  function copilotGuideScene() {
    return `<section class="copilot-stage crues-copilot-stage">
      <div class="copilot-orb crues-copilot-orb" aria-hidden="true"><span>CR</span></div>
      <div class="copilot-copy">
        <p class="eyebrow">CRUES GUIDE</p>
        <h2>Clear answers. Safer decisions. Better momentum.</h2>
        <p>When a new challenge appears, CRUES explains what it means, what to do next, and what changes if you wait.</p>
      </div>
    </section>`;
  }

  function businessPathPlan(s) {
    const profile = getBusinessProfile();
    const businessType = businessTypeDisplay(profile);
    const overdue = Number((s.metrics && s.metrics.receivables) || 0) > 0 && (s.breakdown || []).some((item) => /overdue/i.test(item.label || ""));
    const path = {
      Retail: {
        now: "Collect overdue customer payments and slow any unnecessary stock buys.",
        next: "Set aside cash for supplier payments and keep only fast-moving stock.",
        plan: "Review stock movement and customer payment timing before buying more inventory.",
        opportunity: "Bundle slow-moving items into a promotion to free working capital."
      },
      Restaurant: {
        now: "Reduce food waste and protect the next payroll cycle.",
        next: "Reserve cash for supplier payments and keep menu costs under control.",
        plan: "Check daily sales, waste, and ingredient purchases before increasing spend.",
        opportunity: "Shift the menu toward your highest-margin dishes to increase profit without extra cost."
      },
      Café: {
        now: "Protect daily cash and reduce avoidable waste.",
        next: "Keep payroll and supplier costs within the next 7 days of cash.",
        plan: "Review ingredient usage and staffing levels before adding new costs.",
        opportunity: "Introduce a bundled offer on your highest-margin drinks and snacks."
      },
      Freelancer: {
        now: "Collect overdue client invoices and protect the tax reserve.",
        next: "Delay non-essential spends and keep a short cash buffer for the next 30 days.",
        plan: "Review project profitability and only accept work that improves your runway.",
        opportunity: "Offer a retainer or a simple monthly package to improve predictable income."
      },
      Service: {
        now: "Follow up on unpaid client work and protect payroll.",
        next: "Keep recurring costs tight and only approve necessary operating expenses.",
        plan: "Review which clients and projects are most profitable before taking on more work.",
        opportunity: "Bundle your best service to raise margin without increasing fixed cost."
      },
      "E-commerce": {
        now: "Reduce return risk and slow orders that need too much upfront working capital.",
        next: "Protect cash for shipping, platform fees, and inventory purchases.",
        plan: "Check profit per order and avoid buying stock that will sit too long.",
        opportunity: "Upsell your best-selling products to increase average order value."
      },
      Manufacturing: {
        now: "Protect raw-material cash and avoid non-core production spend.",
        next: "Review supplier payments and focus on the orders with the strongest margin.",
        plan: "Keep working capital aligned to order profitability instead of volume alone.",
        opportunity: "Prioritize higher-margin orders and reduce slow-moving stock."
      },
      Agency: {
        now: "Chase the overdue client work and protect payroll.",
        next: "Delay discretionary spend and reserve cash for tax and recurring costs.",
        plan: "Take only work with a healthy margin and a realistic payment timeline.",
        opportunity: "Convert one-off projects into retainer work for steadier revenue."
      },
      Startup: {
        now: "Protect runway before expanding marketing or hiring.",
        next: "Keep burn under control and postpone non-essential costs.",
        plan: "Review spending against revenue momentum before committing to growth.",
        opportunity: "Focus on the fastest path to repeatable revenue with better unit economics."
      },
      default: {
        now: "Protect cash and follow up on anything that is delaying collection or creating risk.",
        next: "Keep the cost base tight and only approve spending that supports the current business goal.",
        plan: "Track cash, customer payments, and the core operating costs before taking on new commitments.",
        opportunity: "Look for a low-risk growth step that improves cash without creating stress."
      }
    };
    const selected = path[businessType] || path.default;
    const currentStep = overdue ? "Collect the overdue invoice" : "Reserve the next week of cash";
    return `<section class="card path-card">
      <div class="row between"><div><p class="eyebrow">WHAT SHOULD I DO NOW?</p><h2>Action plan for ${esc(businessType)}</h2></div><button class="btn primary" type="button">START PATH</button></div>
      <div class="triage">
        <div class="triage-item red"><strong>🔴 DO THIS NOW</strong><p>${esc(selected.now)}</p><small>Why: ${esc(s.reason || "Cash and collection are the immediate pressure point.")}</small></div>
        <div class="triage-item amber"><strong>🟠 DO THIS NEXT</strong><p>${esc(selected.next)}</p><small>Amount: ${money(Math.max(s.metrics.obligations || 0, 0))} reserved if needed</small></div>
        <div class="triage-item yellow"><strong>🟡 PLAN THIS</strong><p>${esc(selected.plan)}</p><small>Risk if ignored: cash pressure and slower recovery.</small></div>
        <div class="triage-item green"><strong>🟢 OPPORTUNITY</strong><p>${esc(selected.opportunity)}</p><small>Expected benefit: improved margin or stronger cash position.</small></div>
      </div>
      <div class="path-box">
        <h3>YOUR FINANCIAL PATH</h3>
        <p><strong>WHERE AM I?</strong> ${esc(`You currently have ${money(s.metrics.cash)} in cash and ${money(s.metrics.obligations)} of obligations coming up. The business is ${s.level.toLowerCase()} with a ${s.score}/100 health score.`)}</p>
        <p><strong>WHAT IS THE PROBLEM?</strong> ${esc(s.reason || `The highest priority risk is cash pressure and delayed customer payment.`)}</p>
        <p><strong>WHAT SHOULD I DO FIRST?</strong> ${esc(currentStep + `. This is the action with the strongest effect on the immediate cash position.`)}</p>
        <p><strong>WHAT SHOULD I DO NEXT?</strong> ${esc(`1. ${currentStep} 2. Reserve ${money(s.metrics.obligations || 0)} for upcoming obligations 3. Delay non-essential spend 4. Keep a minimum cash buffer 5. Review again in 7 days`)}</p>
        <p><strong>WHAT WILL HAPPEN?</strong> ${esc(`If the plan is followed, the business should improve its cash coverage and reduce risk within the next week.`)}</p>
        <p><strong>WHAT IF I DO NOTHING?</strong> ${esc(`Cash can tighten further, deadlines may be missed, and the business may need an emergency decision under pressure.`)}</p>
        <div class="path-steps">
          <div class="step done">✓ Step 1 — ${esc(currentStep)}</div>
          <div class="step current">→ Step 2 — CURRENT — ${esc(selected.next)}</div>
          <div class="step pending">○ Step 3 — ${esc(selected.plan)}</div>
          <div class="step pending">○ Step 4 — ${esc(selected.opportunity)}</div>
          <div class="step pending">○ Step 5 — Review again in 7 days</div>
        </div>
      </div>
    </section>`;
  }

  function prioritiesMarkup(s) {
    return `<div class="todo">${s.priorities.map((p) => `<a href="#${esc(p.go)}" class="todo-i ${esc(p.tone)}"><span>${esc(p.icon)} ${esc(p.text)}</span><b>View →</b></a>`).join("")}</div>`;
  }

  function auditMarkup(items, limit) {
    const logs = (items || []).slice().reverse().slice(0, limit || 100);
    if (!logs.length) return `<div class="empty"><span>◷</span><strong>No decisions yet</strong><p>Detected events, recommendations, and owner choices will appear here.</p></div>`;
    return `<div class="log">${logs.map((item) => `<div class="log-i ${esc(item.kind || "")}"><time>${esc(item.t)}</time><span>${esc(item.msg)}</span></div>`).join("")}</div>`;
  }

  function dashboard(s) {
    const m = s.metrics;
    const business = getBusinessProfile();
    const businessName = business.name || "Your business";
    const businessType = businessTypeDisplay(business);
    return `<section class="welcome"><div><p class="eyebrow">YOUR BUSINESS. WATCHED 24/7.</p><h1>Good ${hourGreeting()}, ${esc(business.name || "owner")}.</h1><p>Here’s what matters for ${esc(businessName)} today. Business type: ${esc(businessType)}.</p></div><a class="btn primary" href="#simulation">🎮 Run the business simulation</a></section>
      ${businessJourneyScene(s)}
      ${scoreHero(s)}
      <h2 class="sec">Your business at a glance</h2>
      <section class="metrics">
        ${metricCard("Cash", money(m.cash), s.glossary.cash, "How much cash do I have?")}
        ${metricCard("Monthly revenue", money(m.revenue), s.glossary.revenue, "How is my business doing?")}
        ${metricCard("Monthly expenses", money(m.expenses), s.glossary.expenses, "Can I afford this expense?")}
        ${metricCard("Cash runway", `${m.runway_days} days`, s.glossary.runway, "What does cash runway mean?")}
        ${metricCard("Customer receivables", money(m.receivables), s.glossary.receivables, "What happens if my customer pays late?")}
        ${metricCard("Upcoming obligations", money(m.obligations), s.glossary.obligations, "What should I prepare for?")}
        ${metricCard("Risk level", m.risk, s.glossary.risk, "What is my biggest risk?")}
      </section>
      ${businessPathPlan(s)}
      <h2 class="sec">WHAT SHOULD I DO TODAY?</h2>${prioritiesMarkup(s)}
      <div class="grid2">
        <section><h2 class="sec">Why did my score change?</h2><article class="card">${esc(s.reason)}${s.breakdown.length ? `<ul class="plain-list">${s.breakdown.map((b) => `<li>${esc(b.label)} <strong>${b.points > 0 ? "+" : ""}${b.points} points</strong></li>`).join("")}</ul>` : ""}</article></section>
        <section><h2 class="sec">FinCrew’s latest decisions</h2>${auditMarkup(s.audit, 5)}<p><a href="#activity">View full activity log →</a></p></section>
      </div>
      <section class="cta-strip"><div><strong>Want to ask FinCrew?</strong><p>Get a clear answer based on today’s actual business numbers.</p></div><a class="btn primary" href="#ai">Chat with FinCrew →</a></section>`;
  }

  function hourGreeting() {
    const hour = new Date().getHours();
    return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  }

  function cashflow(s) {
    const m = s.metrics;
    const max = Math.max(...s.history.revenue, ...s.history.expenses);
    const bars = s.history.months.map((month, i) => `<div class="bg"><i class="r" style="height:${Math.max(8, s.history.revenue[i] / max * 100)}%" title="Revenue ₹${s.history.revenue[i]}K"></i><i class="e" style="height:${Math.max(8, s.history.expenses[i] / max * 100)}%" title="Expenses ₹${s.history.expenses[i]}K"></i><em>${esc(month)}</em></div>`).join("");
    return `<h1>Cash Flow</h1><p class="lede">A simple view of what is coming in and going out.</p>
      <div class="metrics">${metricCard("Cash available", money(m.cash), s.glossary.cash)}${metricCard("Monthly inflow", money(m.revenue), "Money expected from customers.")}${metricCard("Monthly outflow", money(m.expenses), s.glossary.expenses)}${metricCard("Estimated monthly surplus", money(m.profit), "Revenue left after regular monthly expenses.")}</div>
      <h2 class="sec">Six-month cash movement (₹ thousands)</h2><article class="card"><div class="chart-legend"><span><i class="r"></i>Revenue</span><span><i class="e"></i>Expenses</span></div><div class="bars">${bars}</div></article>
      <h2 class="sec">Cash safety check</h2><article class="card"><p>Your current cash would cover about <strong>${m.runway_days} days</strong> of regular costs.</p><div class="hbar"><i style="width:${Math.min(m.runway_days / 60 * 100, 100)}%"></i></div><p>Business owners often aim to keep at least 45 days of costs available. FinCrew will flag changes before they become urgent.</p><a href="#simulation">Test a cash-flow event in the simulation →</a></article>`;
  }

  function invoices(s) {
    return `<h1>Invoices</h1><p class="lede">Money customers owe AriaCraft Supplies.</p>
      <div class="metrics">${metricCard("Total receivables", money(s.metrics.receivables), s.glossary.receivables)}${metricCard("Overdue", money(s.metrics.cash ? (s.breakdown.find((b) => b.label.includes("overdue")) ? 85000 : 0) : 0), "Money that should already have arrived.")}</div>
      <h2 class="sec">Customer invoices</h2><table><thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th><th>Owner action</th></tr></thead><tbody>${s.invoices.map((inv) => `<tr><td>${esc(inv.id)}</td><td>${esc(inv.customer)}</td><td>${money(inv.amount)}</td><td><span class="pill ${inv.tone === "red" ? "red" : "green"}">${esc(inv.status)}</span></td><td>${inv.id === "INV-1042" && s.current && s.current.id === "late" ? `<a class="btn sm primary" href="#simulation">Review recommendation</a>` : "—"}</td></tr>`).join("")}</tbody></table>
      <article class="card note-card"><strong>FinCrew’s collection tip</strong><p>A friendly reminder is often the best first step. FinCrew will prepare one for your approval; it never sends a message without you.</p><button class="btn" data-ask="What should I do about overdue invoices?">Ask FinCrew</button></article>`;
  }

  function expenses(s) {
    return `<h1>Expenses</h1><p class="lede">Where the business spends each month.</p><div class="metrics">${metricCard("Monthly total", money(s.metrics.expenses), s.glossary.expenses)}${metricCard("Monthly revenue", money(s.metrics.revenue), s.glossary.revenue)}${metricCard("Estimated surplus", money(s.metrics.profit), "What remains after monthly costs.")}</div>
      <h2 class="sec">Monthly expense breakdown</h2><table><thead><tr><th>Category</th><th>Monthly amount</th></tr></thead><tbody>${s.expenses.map((row) => `<tr><td>${esc(row[0])}</td><td>${money(row[1])}</td></tr>`).join("")}</tbody></table>
      ${s.one_offs.length ? `<h2 class="sec">Unexpected expenses</h2><article class="card"><ul>${s.one_offs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></article>` : ""}
      <h2 class="sec">Try a spending decision</h2>${whatIfPanel()}`;
  }

  function risks(s) {
    return `<h1>Risks</h1><p class="lede">The things FinCrew is watching, explained in plain language.</p><div class="risk-list">${s.risks.map((risk) => `<article class="risk-card ${esc(risk.tone)}"><span class="pill ${esc(risk.tone)}">${risk.tone === "red" ? "ACT SOON" : risk.tone === "amber" ? "KEEP AN EYE" : "ON TRACK"}</span><h2>${esc(risk.title)}</h2><p>${esc(risk.detail)}</p><button class="btn sm" data-ask="${esc(risk.detail)}">Ask FinCrew about this</button></article>`).join("")}</div>
      <article class="note-card card"><strong>FinCrew does not label unusual payments as fraud.</strong><p>An alert means something differs from normal behaviour. You decide whether to review, hold, or approve it.</p><a class="btn" href="#simulation">Open the simulation →</a></article>`;
  }

  function obligations(s) {
    return `<h1>Obligations</h1><p class="lede">Bills and deadlines the business needs to prepare for.</p>
      <table><thead><tr><th>Obligation</th><th>Amount</th><th>Due</th><th>Preparation</th></tr></thead><tbody>${s.obligations.map((item) => `<tr><td>${esc(item.name)}</td><td>${money(item.amount)}</td><td>${esc(item.due)}</td><td><span class="pill ${item.status === "Set aside" ? "green" : "amber"}">${esc(item.status)}</span></td></tr>`).join("")}</tbody></table>
      <h2 class="sec">A calm checklist</h2><article class="card"><ol><li>Confirm the amount and date with your accountant.</li><li>Keep enough money ready before the deadline.</li><li>Collect sales and purchase records.</li><li>Pay or file at least one day early.</li></ol><a class="btn primary" href="#simulation">See FinCrew prepare for a deadline</a></article>`;
  }

  function opportunities(s) {
    return `<h1>Opportunities</h1><p class="lede">Growth is exciting. FinCrew checks that the cash can support it.</p><div class="risk-list">${s.opps.map((op) => `<article class="card"><span class="pill green">OPPORTUNITY</span><h2>${esc(op.title)}</h2><p>${esc(op.detail)}</p>${op.q ? `<button class="btn sm" data-ask="${esc(op.q)}">Ask FinCrew</button>` : ""}</article>`).join("")}</div>
      <h2 class="sec">Can you take on more work?</h2><article class="card"><p>Check what an order might mean for your cash before saying yes.</p><a class="btn primary" href="#simulation">Evaluate the ₹3,00,000 order →</a></article>`;
  }

  function whatIfPanel() {
    return `<article class="card"><div class="wi"><label class="sr-only" for="scenario">Choose a scenario</label><select id="scenario">
      <option value="spend">Spend a one-time amount</option><option value="late">Customer pays late (days)</option><option value="hire">Hire an employee (monthly pay)</option><option value="revenue">Revenue grows (%)</option><option value="order">Accept the ₹3 lakh order</option>
      </select><label class="sr-only" for="scenario-value">Amount, days, salary, or growth</label><input id="scenario-value" type="number" min="0" step="1000" value="120000" inputmode="numeric"><button class="btn primary" data-whatif>Calculate</button></div><div id="whatif-result" aria-live="polite"></div></article>`;
  }

  function journeyMarkup(s) {
    const phase = s.current ? 2 : s.done.length ? 6 : 0;
    const labels = ["DETECT", "UNDERSTAND", "EXPLAIN", "RECOMMEND", "ASK OWNER", "APPROVE", "UPDATE", "RECORD"];
    return `<div class="journey">${labels.map((label, i) => `<span class="${i < phase ? "on" : i === phase ? "now" : ""}">${label}</span>`).join("")}</div>`;
  }

  function eventCard(ev) {
    const fields = [["What happened", ev.what], ["Why it matters", ev.matters], ["Financial impact", ev.impact], ["Urgency", ev.urgency], ["FinCrew recommends", ev.recommendation]];
    return `<article class="event ${esc(ev.tone)}"><span class="eyebrow">${esc(ev.icon)} FINCREW DETECTED AN EVENT</span><h2>${esc(ev.title)}</h2>
      <div class="evg">${fields.map(([title, text]) => `<div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`).join("")}</div>
      ${ev.stats && ev.stats.length ? `<div class="stats">${ev.stats.map(([label, before, after]) => `<div class="stat"><span>${esc(label)}</span><b><s>${esc(before)}</s> → ${esc(after)}</b></div>`).join("")}</div>` : ""}
      ${ev.list ? `<div class="box"><h4>${esc(ev.list_title)}</h4><ul>${ev.list.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></div>` : ""}
      <div class="approval-hint"><strong>ACTION REQUIRES APPROVAL</strong><span>FinCrew will not move money or contact anyone without you.</span></div>
      <div class="acts">${ev.actions.map((action) => `<button class="btn ${esc(action.tone)}" data-event-action="${esc(action.id)}">${esc(action.label)}</button>`).join("")}<button class="btn" data-why>WHY?</button></div></article>`;
  }

  function game(s) {
    const complete = s.finished;
    return `<section class="sim-hero"><p class="eyebrow">🎮 GAME-A-THON MODE · SIMULATED BUSINESS DATA</p><h1>Detect. Explain. Decide. Stay in control.</h1><p>In under a minute, see an unexpected event change AriaCraft Supplies — and watch FinCrew ask before taking action.</p><div class="row"><button class="btn primary big" data-sim-start>${s.started ? "RESTART SIMULATION" : "START SIMULATION"}</button>${s.started ? `<button class="btn" data-sim-reset>Reset business</button>` : ""}<span class="sim-tag">8 people · ${money(s.metrics.revenue)}/month revenue · ${money(s.metrics.cash)} cash</span></div></section>
      ${businessJourneyScene(s)}
      ${scoreHero(s)}
      <section class="metrics">${metricCard("Cash", money(s.metrics.cash), s.glossary.cash)}${metricCard("Monthly revenue", money(s.metrics.revenue), s.glossary.revenue)}${metricCard("Monthly expenses", money(s.metrics.expenses), s.glossary.expenses)}${metricCard("Cash runway", `${s.metrics.runway_days} days`, s.glossary.runway)}${metricCard("Receivables", money(s.metrics.receivables), s.glossary.receivables)}${metricCard("Obligations", money(s.metrics.obligations), s.glossary.obligations)}</section>
      <h2 class="sec">The FinCrew decision journey</h2>${journeyMarkup(s)}
      <div class="grid2"><section><h2 class="sec">Event timeline</h2>${timeline(s)}</section><section><h2 class="sec">AI explanation</h2>${s.current ? `<article class="card"><strong>${esc(s.current.title)}</strong><p>${esc(s.current.matters)}</p><p><strong>Recommendation:</strong> ${esc(s.current.recommendation)}</p><button class="btn" data-why>WHY?</button></article>` : `<article class="card"><p>${complete ? "All five simulated events are complete. Your decisions and outcomes are recorded." : s.started ? "The current event has been resolved. Continue when you’re ready." : "Start the simulation to see FinCrew detect the first event."}</p>${s.started && !complete && !s.current ? `<button class="btn primary" data-sim-next>Continue to next event →</button>` : ""}</article>`}</section></div>
      ${s.current ? eventCard(s.current) : ""}
      ${s.started && !complete && !s.current ? `<div class="center"><button class="btn primary big" data-sim-next>CONTINUE SIMULATION →</button></div>` : ""}
      <h2 class="sec">WHAT IF?</h2><p>Try a choice without changing the business. FinCrew estimates the result and risk.</p>${whatIfPanel()}
      <h2 class="sec">ACTIVITY &amp; DECISION LOG</h2>${auditMarkup(s.audit)}
      ${complete ? `<section class="finale"><h1>FINCREW</h1><h2>Your business. Watched 24/7.</h2><ul><li>✓ Financial risks detected</li><li>✓ Cash flow monitored</li><li>✓ Opportunities evaluated</li><li>✓ AI recommendations explained</li><li>✓ Owner remained in control</li><li>✓ Every important decision recorded</li></ul><blockquote>“FinCrew doesn't just tell you what happened. It helps you understand what to do next.”</blockquote></section>` : ""}`;
  }

  function timeline(s) {
    const names = ["Payment delayed", "Unexpected expense", "Unusual transaction", "Deadline approaching", "Growth opportunity"];
    const icons = ["💳", "💸", "🔍", "📅", "🚀"];
    return `<ol class="timeline">${names.map((name, i) => `<li class="${i < s.done.length ? "complete" : s.current && s.current.id === ["late","expense","suspicious","deadline","order"][i] ? "active" : ""}"><i>${i < s.done.length ? "✓" : icons[i]}</i><span><strong>${esc(name)}</strong><small>${i < s.done.length ? esc(s.done[i].outcome) : i === s.done.length && s.current ? "Detected — awaiting your decision" : "Waiting for the previous decision"}</small></span></li>`).join("")}</ol>`;
  }

  function messageHtml(item) {
    return `<div class="msg ${item.role === "user" ? "me" : "fc"}">${richText(item.text)}${item.role === "assistant" ? `<small>${item.source === "ai" ? "FinCrew AI" : "FinCrew local reasoning"} · based on your business data</small>` : ""}</div>`;
  }

  function assistant(s) {
    const transcript = chatHistory.map(messageHtml).join("");
    const business = getBusinessProfile();
    const businessName = business.name || "Your business";
    return `<section class="chat-page-head"><div><p class="eyebrow">PERSONAL FINANCIAL CO-PILOT</p><h1>CRUES COPILOT</h1><p>Calm, clear answers about your actual business — no finance degree needed.</p></div><span class="pill green">${s.ai_enabled ? "AI CONNECTED" : "LOCAL REASONING · READY"}</span></section>
      ${copilotGuideScene()}
      <div class="layout2"><aside class="card context"><h2>Business context</h2><p><strong>${esc(businessName)}</strong><br><span class="muted">${esc(businessTypeDisplay(business))} business profile</span></p><dl><dt>Health</dt><dd>${s.score}/100 · ${esc(s.level)}</dd><dt>Cash</dt><dd>${money(s.metrics.cash)}</dd><dt>Runway</dt><dd>${s.metrics.runway_days} days</dd><dt>Monthly surplus</dt><dd>${money(s.metrics.profit)}</dd><dt>Risk</dt><dd>${esc(s.metrics.risk)}</dd></dl><div class="switch simple-switch"><label><input id="simple-toggle-inline" type="checkbox" ${simpleMode() ? "checked" : ""}> SIMPLE MODE</label></div><p class="muted">Simple Mode adds a <strong>“What does this mean?”</strong> explanation to answers.</p><h3>Recent conversations</h3><div class="hist">${chatHistory.filter((m) => m.role === "user").slice(-8).reverse().map((m) => `<button data-ask="${esc(m.text)}">${esc(m.text)}</button>`).join("") || `<span class="muted">Your questions will be saved here on this device.</span>`}</div><button class="btn sm" data-clear-chat>Clear conversation</button></aside>
        <section class="chat"><div class="chat-head"><div><h2>Ask CRUES anything</h2><p>Answers use the latest simulated business numbers.</p></div></div><div class="msgs" id="messages" aria-live="polite">${transcript || `<div class="msg fc">Hi, I’m CRUES. I’m watching ${esc(businessName)}’s numbers and can help you decide what to do next.</div>`}</div>
          <div class="chips">${suggested.map((question) => `<button class="chip" data-ask="${esc(question)}">${esc(question)}</button>`).join("")}</div>
          <form class="composer" id="chat-form"><label class="sr-only" for="chat-input">Ask CRUES a question</label><input id="chat-input" maxlength="500" placeholder="Ask about cash, risks, or a decision…" autocomplete="off" required><button class="btn primary">Send</button></form>
          <div class="voice"><button class="mic" id="mic-button" type="button">🎙 TALK TO CRUES</button><span class="vstate" id="voice-state" aria-live="polite">Tap to speak</span><span class="muted voice-help" id="voice-help">Voice input works in supported browsers. Your microphone is only used after you tap.</span></div>
        </section></div>`;
  }

  function activity(s) {
    return `<h1>Activity &amp; Decision Log</h1><p class="lede">A clear record of what FinCrew noticed, what it recommended, and what you chose.</p><div class="row"><span class="pill green">${s.audit.length} recorded activities</span><button class="btn" data-export-log>Download activity log</button></div><h2 class="sec">Newest first</h2>${auditMarkup(s.audit)}<article class="note-card card"><strong>Owner stays in control</strong><p>FinCrew records recommendations and decisions. It never sends reminders, holds payments, or accepts orders without your approval.</p></article>`;
  }

  function render(s) {
    state = s;
    const page = currentPage();
    const titles = Object.fromEntries(navItems.map(([id, label]) => [id, label]));
    const views = {
      overview: dashboard,
      cashflow,
      invoices,
      expenses,
      risks,
      obligations,
      opportunities,
      ai: assistant,
      activity,
      simulation: game
    };
    root.innerHTML = shell(views[page](s), page, titles[page]);
    const messageList = document.getElementById("messages");
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }

  async function refresh() {
    try {
      const s = await request("/api/state");
      setBanner("", "");
      render(s);
    } catch (error) {
      setBanner(error.message, "error");
      if (!state) {
        root.innerHTML = `<section class="offline card"><span>◉</span><h1>FinCrew needs its local service</h1><p>${esc(error.message)}</p><p>Keep this window open, start the service, then use the button below.</p><button class="btn primary" data-retry>Try again</button></section>`;
      } else {
        render(state);
      }
    }
  }

  async function mutate(path, body, successMessage) {
    setBusy(true);
    try {
      const result = await request(path, body);
      const nextState = result.state || result;
      render(nextState);
      if (result.result) {
        const r = result.result;
        const improved = typeof r.after === "number" && typeof r.before === "number" && r.after > r.before;
        const challengeLike = /challenge|warning|risk|late|expense|payment|obligation|suspicious|deadline/i.test((r.title || "") + " " + (r.message || ""));
        showGuideMessage(improved ? "success" : challengeLike ? "risk" : "path");
        showModal(`<span class="mtag">${esc(r.title)}</span><h3>${esc(r.title)}</h3><p>${esc(r.message)}</p>${r.draft ? `<h4>Reminder draft — ready for you to copy</h4><pre>${esc(r.draft)}</pre>` : ""}${r.before !== undefined ? `<p>Financial Health: <strong>${r.before}</strong> → <strong>${r.after}</strong></p>` : ""}<div class="row"><button class="btn primary" data-close-modal>Done</button>${r.draft ? `<button class="btn" data-copy-draft>Copy reminder</button>` : ""}</div>`);
      } else if (successMessage) {
        showToast(successMessage);
      }
    } catch (error) {
      setBanner(error.message, "error");
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy) {
    document.querySelectorAll("button").forEach((button) => {
      if (button.dataset.busyControl !== undefined || button.hasAttribute("data-sim-start") || button.hasAttribute("data-sim-next") || button.hasAttribute("data-event-action") || button.hasAttribute("data-whatif")) {
        button.disabled = busy;
      }
    });
  }

  function approvalDialog(actionId) {
    const action = state && state.current && state.current.actions.find((item) => item.id === actionId);
    if (!action) return;
    if (actionId === "cancel") {
      mutate("/api/act", { action: actionId }, "Decision cancelled. No business action was taken.");
      return;
    }
    const approval = action.approval || { action: action.label };
    showModal(`<span class="mtag">ACTION REQUIRES APPROVAL</span><h3>Are you sure?</h3><dl><dt>Action</dt><dd>${esc(approval.action)}</dd>${approval.customer ? `<dt>Customer / destination</dt><dd>${esc(approval.customer)}</dd>` : ""}${approval.amount ? `<dt>Amount</dt><dd>${esc(approval.amount)}</dd>` : ""}${approval.reason ? `<dt>Reason</dt><dd>${esc(approval.reason)}</dd>` : ""}</dl><p>FinCrew will record your decision. Nothing happens until you confirm below.</p><div class="row"><button class="btn primary" data-confirm-action="${esc(actionId)}">Confirm approval</button><button class="btn" data-close-modal>Go back</button></div>`);
  }

  function whyDialog() {
    if (!state || !state.current) {
      showModal(`<h3>Why this matters</h3><p>${esc(state ? state.reason : "Run the simulation to see FinCrew explain its recommendation.")}</p>`);
      return;
    }
    const ev = state.current;
    showModal(`<span class="mtag">FINCREW’S REASONING</span><h3>Why this recommendation?</h3><p>${esc(ev.recommendation)}</p><ol>${ev.why.map((item) => `<li>${esc(item)}</li>`).join("")}</ol><p class="muted">This is a recommendation, not an automatic action. You remain in control.</p>`);
  }

  async function submitChat(question) {
    const input = document.getElementById("chat-input");
    const q = (question || (input && input.value) || "").trim();
    if (!q) return;
    chatHistory.push({ role: "user", text: q });
    if (input) input.value = "";
    render(state);
    chatHistory.push({ role: "assistant", text: "Thinking…", source: "local", pending: true });
    render(state);
    try {
      const answer = await request("/api/chat", { message: q, simple: simpleMode() });
      chatHistory.pop();
      chatHistory.push({ role: "assistant", text: answer.text, source: answer.source });
      saveHistory();
      render(state);
      speakIfRequested(answer.text);
    } catch (error) {
      chatHistory.pop();
      chatHistory.push({ role: "assistant", text: error.message, source: "local" });
      saveHistory();
      render(state);
      setBanner(error.message, "error");
    }
  }

  function getSpeechRecognitionClass() {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition || null;
  }

  function voiceState(label, mode) {
    const indicator = document.getElementById("voice-state");
    const mic = document.getElementById("mic-button");
    if (indicator) {
      indicator.textContent = label;
      indicator.className = "vstate" + (mode ? ` ${mode}` : "");
    }
    if (mic) mic.classList.toggle("on", mode === "live");
  }

  function speakIfRequested(text) {
    const enabled = localStorage.getItem("fincrew-voice-enabled") === "true";
    if (!enabled) return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      voiceState("Response ready · speech playback unavailable", "warn");
      return;
    }
    const safeText = String(text || "").replace(/\*\*/g, "").trim();
    if (!safeText) return;
    voiceState("Speaking...", "");
    const utterance = new SpeechSynthesisUtterance(safeText);
    utterance.lang = currentVoiceLanguage();
    utterance.onend = () => voiceState("Tap to speak", "");
    utterance.onerror = () => voiceState("Response ready · speech playback unavailable", "warn");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function beginVoice() {
    const enabled = localStorage.getItem("fincrew-voice-enabled") === "true";
    if (!enabled) {
      localStorage.setItem("fincrew-voice-enabled", "true");
      updateVoiceControls();
      showToast("Voice enabled. Speak to CRUES when ready.");
    }

    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) || window.location.hostname.startsWith("192.168.") || window.location.hostname.startsWith("10.") || window.location.hostname.startsWith("172.");
    if (!window.isSecureContext && !isLocalHost) {
      voiceState("Voice requires a trusted local browser session. Open this app from localhost or a secure local network connection.", "warn");
      showToast("Voice recognition is usually limited to localhost or secure local network access. Please use a supported browser on the same network.");
      return;
    }

    const Recognition = getSpeechRecognitionClass();
    if (!Recognition) {
      voiceState("Voice input is not supported here. Type your question instead.", "warn");
      showToast("Voice input is not supported in this browser. Please type your message instead.");
      return;
    }
    if (voiceRecognition) {
      voiceRecognition.stop();
      voiceRecognition = null;
      voiceState("Tap to speak", "");
      return;
    }

    const requestVoiceAccess = () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
          startSpeechRecognition();
        }).catch(() => {
          voiceState("Microphone permission is blocked. Allow access to use voice chat.", "warn");
          showToast("Allow microphone permission in your browser, then tap the mic again.");
        });
        return;
      }
      startSpeechRecognition();
    };

    const startSpeechRecognition = () => {
      try {
        voiceRecognition = new Recognition();
        voiceRecognition.lang = currentVoiceLanguage();
        voiceRecognition.interimResults = false;
        voiceRecognition.maxAlternatives = 1;
        voiceRecognition.continuous = false;
        voiceRecognition.onstart = () => voiceState("Listening...", "live");
        voiceRecognition.onerror = (event) => {
          voiceRecognition = null;
          const text = event && event.error === "not-allowed"
            ? "Microphone permission was not granted. Please allow access and try again."
            : "I couldn't hear that. Please try again or type your question.";
          voiceState(text, "warn");
        };
        voiceRecognition.onresult = (event) => {
          const heard = Array.from(event.results)
            .map((result) => (result && result[0] ? result[0].transcript : ""))
            .join(" ")
            .trim();
          if (!heard) {
            voiceState("Tap to speak", "");
            return;
          }
          voiceState("Thinking...", "");
          submitChat(heard);
        };
        voiceRecognition.onend = () => {
          voiceRecognition = null;
          const indicator = document.getElementById("voice-state");
          if (indicator && indicator.textContent === "Listening...") voiceState("Tap to speak", "");
        };
        voiceRecognition.start();
      } catch (_) {
        voiceRecognition = null;
        voiceState("Couldn't start the microphone. Check browser permissions.", "warn");
        showToast("Microphone access was blocked. Please allow permission and try again.");
      }
    };

    requestVoiceAccess();
  }

  async function runWhatIf(button) {
    const type = document.getElementById("scenario").value;
    const input = document.getElementById("scenario-value");
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0) {
      showToast("Enter a valid number of 0 or more.");
      input.focus();
      return;
    }
    if (type === "order") selectedWhatIf = type;
    try {
      button.disabled = true;
      const result = await request("/api/whatif", { type, value });
      const output = document.getElementById("whatif-result");
      if (!output) return;
      output.innerHTML = `<div class="wi-out"><div><strong>Current state</strong><p>${money(result.current.cash)} cash · ${result.current.runway_days} days runway · health ${result.current.score}/100</p></div><span>↓</span><div><strong>Scenario: ${esc(result.title)}</strong><p>${esc(result.result)}</p></div><span>↓</span><div><strong>Expected result</strong><p>${money(result.scenario.cash)} cash · ${result.scenario.runway_days} days runway · health ${result.scenario.score}/100 · monthly profit ${money(result.scenario.profit)}</p></div><div><strong>Risk: <span class="pill ${result.risk === "Low" ? "green" : result.risk === "Medium" ? "amber" : "red"}">${esc(result.risk)}</span></strong><p>${esc(result.recommendation)}</p></div></div>`;
    } catch (error) {
      showToast(error.message);
      setBanner(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function downloadLog() {
    const content = (state.audit || []).map((entry) => `${entry.t} — ${entry.msg}`).join("\r\n");
    const blob = new Blob([content || "No activity recorded yet."], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fincrew-activity-log.txt";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Activity log downloaded.");
  }

  root.addEventListener("submit", (event) => {
    if (event.target.id === "chat-form") {
      event.preventDefault();
      submitChat();
    }
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button, a");
    if (!button) {
      if (event.target === modal) closeModal();
      return;
    }
    if (button.matches("[data-close-modal]")) return closeModal();
    if (button.matches("#cruesVoiceToggle")) {
      const isEnabled = localStorage.getItem("fincrew-voice-enabled") === "true";
      localStorage.setItem("fincrew-voice-enabled", String(!isEnabled));
      updateVoiceControls();
      if (!isEnabled) {
        showToast("Voice enabled. CRUES can speak answers back to you.");
      } else {
        showToast("Voice disabled.");
      }
      return;
    }
    if (button.matches("[data-sim-start]")) return mutate("/api/sim/start", {}, "Simulation started.");
    if (button.matches("[data-sim-next]")) return mutate("/api/sim/next", {}, "Next event detected.");
    if (button.matches("[data-sim-reset]")) return mutate("/api/sim/reset", {}, "Simulation reset.");
    if (button.matches("[data-event-action]")) return approvalDialog(button.dataset.eventAction);
    if (button.matches("[data-confirm-action]")) {
      const action = button.dataset.confirmAction;
      closeModal();
      return mutate("/api/act", { action }, "Owner decision recorded.");
    }
    if (button.matches("[data-why]")) return whyDialog();
    if (button.matches("[data-open-reason]")) return showModal(`<h3>WHY DID MY SCORE CHANGE?</h3><p>${esc(state.reason)}</p>${state.breakdown.length ? `<ul>${state.breakdown.map((item) => `<li>${esc(item.label)}: ${item.points > 0 ? "+" : ""}${item.points} points</li>`).join("")}</ul>` : `<p>No current events are reducing the score.</p>`}`);
    if (button.matches("[data-whatif]")) return runWhatIf(button);
    if (button.matches("[data-edit-business]")) {
      modal.innerHTML = businessSetupModalMarkup();
      modal.hidden = false;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      const form = document.getElementById("business-profile-form");
      const typeSelect = form && form.querySelector('[name="type"]');
      if (typeSelect) {
        typeSelect.addEventListener("change", () => {
          const customField = form.querySelector('[name="customType"]');
          if (customField) customField.disabled = typeSelect.value !== "Other";
        });
        typeSelect.dispatchEvent(new Event("change"));
      }
      return;
    }
    if (button.matches("[data-reset-business]")) {
      saveBusinessProfile({ ...DEFAULT_BUSINESS_PROFILE });
      closeModal();
      refresh();
      return;
    }
    if (button.matches("[data-save-business]")) {
      const form = document.getElementById("business-profile-form");
      if (!form) return;
      const formData = new FormData(form);
      const profile = getBusinessProfile();
      const next = {
        ...profile,
        name: String(formData.get("name") || DEFAULT_BUSINESS_PROFILE.name),
        type: String(formData.get("type") || DEFAULT_BUSINESS_PROFILE.type),
        customType: String(formData.get("customType") || ""),
        sells: String(formData.get("sells") || ""),
        revenue: Number(formData.get("revenue") || 0),
        expenses: Number(formData.get("expenses") || 0),
        employees: Number(formData.get("employees") || 0),
        payment: String(formData.get("payment") || ""),
        majorExpenses: String(formData.get("majorExpenses") || "")
      };
      saveBusinessProfile(next);
      syncBusinessProfileToServer(next);
      closeModal();
      refresh();
      return;
    }
    if (button.matches("[data-ask]")) {
      if (currentPage() !== "ai") location.hash = "ai";
      window.setTimeout(() => submitChat(button.dataset.ask), 0);
      return;
    }
    if (button.matches("#mic-button")) return beginVoice();
    if (button.matches("[data-clear-chat]")) {
      chatHistory = [];
      saveHistory();
      return render(state);
    }
    if (button.matches("[data-export-log]")) return downloadLog();
    if (button.matches("[data-retry]")) return refresh();
    if (button.matches("[data-copy-draft]")) {
      const pre = modal.querySelector("pre");
      const text = pre ? pre.textContent : "";
      if (text && navigator.clipboard) navigator.clipboard.writeText(text).then(() => showToast("Reminder copied."), () => showToast("Copy was blocked by the browser."));
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "simple-toggle" || event.target.id === "simple-toggle-inline") {
      localStorage.setItem(keySimple, String(event.target.checked));
      render(state);
      showToast(`Simple Mode ${event.target.checked ? "on" : "off"}.`);
    }
    if (event.target.id === "cruesLangSelect") {
      const language = event.target.value || "en";
      localStorage.setItem("fincrew-language", language);
      updateVoiceControls();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
    if (event.target.id === "scenario") {
      const input = document.getElementById("scenario-value");
      const defaults = { spend: 120000, late: 15, hire: 35000, revenue: 20, order: 300000 };
      input.value = defaults[event.target.value];
      input.disabled = event.target.value === "order";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && !modal.hidden) closeModal();
  });

  window.addEventListener("hashchange", () => {
    if (state) render(state);
    else refresh();
  });

  refresh();
})();
