// Simple stress bias app using localStorage

const STORAGE_KEY = "stressEntries";

let entries = [];

document.addEventListener("DOMContentLoaded", () => {
  loadEntries();
  setupTabs();
  setupCaptureForm();
  renderAll();
});

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load entries", e);
    entries = [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// -------- Tabs --------
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab").forEach(s => s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(tab).classList.add("active");
      renderAll();
    });
  });

  // Show/hide next action field based on actionable radio
  document.querySelectorAll("input[name='isActionable']").forEach(r => {
    r.addEventListener("change", () => {
      const wrapper = document.getElementById("next-action-wrapper");
      wrapper.style.display = r.value === "yes" ? "block" : "none";
    });
  });
}

// -------- Capture --------
function setupCaptureForm() {
  const form = document.getElementById("capture-form");
  const statusEl = document.getElementById("save-status");

  form.addEventListener("submit", e => {
    e.preventDefault();

    const formData = new FormData(form);
    const trigger = formData.get("trigger").trim();
    const interpretation = formData.get("interpretation").trim();
    const domain = formData.get("domain");
    const predictedSeverity = Number(formData.get("predictedSeverity"));
    const isActionable = formData.get("isActionable") === "yes";
    const nextAction = (formData.get("nextAction") || "").trim();

    if (!trigger || !interpretation || !domain) {
      statusEl.textContent = "Missing required fields.";
      return;
    }

    if (isActionable && !nextAction) {
      statusEl.textContent = "Next action required for actionable items.";
      return;
    }

    const now = new Date();
    const id = now.getTime().toString() + "-" + Math.random().toString(16).slice(2);
    const autoExpiresAt = !isActionable
      ? new Date(now.getTime() + 48 * 3600 * 1000).toISOString()
      : null;

    const entry = {
      id,
      createdAt: now.toISOString(),
      trigger,
      interpretation,
      domain,
      predictedSeverity,
      predictedTimeframeHours: 24, // simple default
      isActionable,
      nextAction: isActionable ? nextAction : null,
      actionStatus: isActionable ? "open" : null,
      actionCompletedAt: null,
      actualOutcomeKnown: false,
      actualOutcome: null,
      actualSeverity: null,
      outcomeLoggedAt: null,
      autoExpiresAt,
      archiveStatus: "active"
    };

    entries.unshift(entry); // newest first
    saveEntries();

    form.reset();
    document.getElementById("predicted-value").textContent = "5";
    // reset actionable toggle to yes
    form.querySelector("input[name='isActionable'][value='yes']").checked = true;
    document.getElementById("next-action-wrapper").style.display = "block";

    statusEl.textContent = "Saved.";
    setTimeout(() => { statusEl.textContent = ""; }, 1500);

    renderAll();
  });
}

// -------- Rendering --------
function renderAll() {
  renderActions();
  renderNoise();
  renderReview();
  renderInsights();
}

function renderActions() {
  const container = document.getElementById("actions-list");
  container.innerHTML = "";

  const openActions = entries.filter(e =>
    e.isActionable &&
    e.actionStatus === "open" &&
    e.archiveStatus === "active"
  );

  if (openActions.length === 0) {
    container.textContent = "No open actions.";
    return;
  }

  openActions.forEach(e => {
    const card = document.createElement("div");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `
      <span class="card-domain">${e.domain}</span>
      <span class="badge">Pred: ${e.predictedSeverity}/10</span>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <div><strong>Trigger:</strong> ${escapeHtml(shorten(e.trigger, 120))}</div>
      <div><strong>Next action:</strong> ${escapeHtml(shorten(e.nextAction || "", 160))}</div>
    `;
    card.appendChild(body);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Created: ${formatDate(e.createdAt)}`;
    card.appendChild(meta);

    const footer = document.createElement("div");
    footer.className = "card-footer";

    const doneBtn = document.createElement("button");
    doneBtn.className = "small";
    doneBtn.textContent = "Done";
    doneBtn.addEventListener("click", () => {
      e.actionStatus = "done";
      e.actionCompletedAt = new Date().toISOString();
      saveEntries();
      renderAll();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "small secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      e.actionStatus = "cancelled";
      saveEntries();
      renderAll();
    });

    footer.appendChild(doneBtn);
    footer.appendChild(cancelBtn);
    card.appendChild(footer);

    container.appendChild(card);
  });
}

function renderNoise() {
  const container = document.getElementById("noise-list");
  container.innerHTML = "";

  const now = new Date();
  let changed = false;

  const noise = entries.filter(e => !e.isActionable && e.archiveStatus === "active");

  // auto-archive expired
  noise.forEach(e => {
    if (e.autoExpiresAt && new Date(e.autoExpiresAt) < now) {
      e.archiveStatus = "archived";
      changed = true;
    }
  });
  if (changed) {
    saveEntries();
  }

  const activeNoise = entries.filter(e => !e.isActionable && e.archiveStatus === "active");

  if (activeNoise.length === 0) {
    container.textContent = "No active non-actionable items.";
    return;
  }

  activeNoise.forEach(e => {
    const card = document.createElement("div");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `
      <span class="card-domain">${e.domain}</span>
      <span class="badge">Pred: ${e.predictedSeverity}/10</span>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <div><strong>Trigger:</strong> ${escapeHtml(shorten(e.trigger, 120))}</div>
      <div><strong>Interpretation:</strong> ${escapeHtml(shorten(e.interpretation, 160))}</div>
    `;
    card.appendChild(body);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Auto-archives: ${e.autoExpiresAt ? formatDate(e.autoExpiresAt) : "n/a"}`;
    card.appendChild(meta);

    container.appendChild(card);
  });
}

function renderReview() {
  const container = document.getElementById("review-list");
  container.innerHTML = "";

  const now = new Date();
  const twentyFourHoursMs = 24 * 3600 * 1000;

  const pending = entries.filter(e => {
    if (e.actualOutcomeKnown) return false;
    const created = new Date(e.createdAt);
    return now - created >= twentyFourHoursMs;
  });

  if (pending.length === 0) {
    container.textContent = "No entries need outcome review.";
    return;
  }

  pending.forEach(e => {
    const wrapper = document.createElement("div");
    wrapper.className = "review-entry";

    const top = document.createElement("div");
    top.innerHTML = `
      <div><strong>Domain:</strong> ${e.domain}</div>
      <div><strong>Trigger:</strong> ${escapeHtml(shorten(e.trigger, 160))}</div>
      <div><strong>Interpretation:</strong> ${escapeHtml(shorten(e.interpretation, 160))}</div>
      <div class="meta">Predicted severity: ${e.predictedSeverity}/10 · Created: ${formatDate(e.createdAt)}</div>
    `;
    wrapper.appendChild(top);

    const outcomeLabel = document.createElement("label");
    outcomeLabel.textContent = "Actual outcome";
    const outcomeInput = document.createElement("textarea");
    outcomeInput.value = e.actualOutcome || "";
    outcomeLabel.appendChild(outcomeInput);
    wrapper.appendChild(outcomeLabel);

    const severityLabel = document.createElement("label");
    severityLabel.textContent = "Actual severity (0–10)";
    const severityInput = document.createElement("input");
    severityInput.type = "number";
    severityInput.min = "0";
    severityInput.max = "10";
    severityInput.value = e.actualSeverity != null ? e.actualSeverity : "";
    severityLabel.appendChild(severityInput);
    wrapper.appendChild(severityLabel);

    const saveBtn = document.createElement("button");
    saveBtn.className = "small";
    saveBtn.textContent = "Save outcome";
    saveBtn.addEventListener("click", () => {
      const outcomeText = outcomeInput.value.trim();
      const actual = severityInput.value === "" ? null : Number(severityInput.value);

      if (!outcomeText || actual == null || isNaN(actual) || actual < 0 || actual > 10) {
        alert("Need outcome text and actual severity 0–10.");
        return;
      }

      e.actualOutcome = outcomeText;
      e.actualSeverity = actual;
      e.actualOutcomeKnown = true;
      e.outcomeLoggedAt = new Date().toISOString();

      // archive if done or non-actionable
      if (!e.isActionable || e.actionStatus === "done" || e.actionStatus === "cancelled") {
        e.archiveStatus = "archived";
      }

      saveEntries();
      renderAll();
    });

    wrapper.appendChild(saveBtn);

    container.appendChild(wrapper);
  });
}

function renderInsights() {
  const container = document.getElementById("insights-content");
  container.innerHTML = "";

  const completed = entries.filter(e => e.actualOutcomeKnown && e.actualSeverity != null);

  if (completed.length === 0) {
    container.textContent = "No completed entries with outcomes yet.";
    return;
  }

  let sumDelta = 0;
  let overCount = 0;
  let underCount = 0;
  let equalCount = 0;

  completed.forEach(e => {
    const delta = e.predictedSeverity - e.actualSeverity;
    sumDelta += delta;
    if (delta > 0) overCount++;
    else if (delta < 0) underCount++;
    else equalCount++;
  });

  const avgDelta = sumDelta / completed.length;

  const p1 = document.createElement("p");
  p1.textContent = `Entries with outcome: ${completed.length}`;
  container.appendChild(p1);

  const p2 = document.createElement("p");
  p2.textContent = `Average prediction bias (predicted − actual): ${avgDelta.toFixed(2)}`;
  container.appendChild(p2);

  const p3 = document.createElement("p");
  p3.textContent = `Overestimated: ${overCount}, Underestimated: ${underCount}, Exact: ${equalCount}`;
  container.appendChild(p3);

  // Domain breakdown
  const byDomain = {};
  completed.forEach(e => {
    if (!byDomain[e.domain]) {
      byDomain[e.domain] = {
        count: 0,
        sumPred: 0,
        sumAct: 0
      };
    }
    byDomain[e.domain].count++;
    byDomain[e.domain].sumPred += e.predictedSeverity;
    byDomain[e.domain].sumAct += e.actualSeverity;
  });

  const domainHeader = document.createElement("p");
  domainHeader.textContent = "By domain (average predicted vs actual):";
  container.appendChild(domainHeader);

  Object.entries(byDomain).forEach(([domain, stats]) => {
    const avgPred = stats.sumPred / stats.count;
    const avgAct = stats.sumAct / stats.count;
    const line = document.createElement("p");
    line.textContent = `• ${domain}: predicted ${avgPred.toFixed(2)} vs actual ${avgAct.toFixed(2)} (n=${stats.count})`;
    container.appendChild(line);
  });
}

// -------- Helpers --------
function shorten(text, maxLen) {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
