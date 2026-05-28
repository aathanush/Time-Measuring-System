// ── CONFIG ──────────────────────────────────────────────────
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

const TRACKED_DOMAINS = [
  "youtube.com", "instagram.com", "reddit.com",
  "myflixerfree.org", "grok.com", "grok.ai",
  "perchance.org", "google.com", "bing.com",
  "duckduckgo.com", "web.whatsapp.com"
];
// ────────────────────────────────────────────────────────────

let trackingStart = null;
let activeTabId   = null;
let todaySeconds  = 0;
let lastDate      = getTodayStr();

function getTodayStr() {
  // Returns local date as YYYY-MM-DD
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isTracked(url) {
  if (!url || !url.startsWith("http")) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return TRACKED_DOMAINS.some(d => host === d || host.endsWith("." + d));
  } catch { return false; }
}

function checkDateReset() {
  const today = getTodayStr();
  if (today !== lastDate) {
    todaySeconds = 0;
    lastDate = today;
    save();
  }
}

function startTracking(tabId, url) {
  stopTracking();
  if (isTracked(url)) {
    trackingStart = Date.now();
    activeTabId   = tabId;
  }
}

function stopTracking() {
  if (trackingStart !== null) {
    todaySeconds  += (Date.now() - trackingStart) / 1000;
    trackingStart  = null;
    activeTabId    = null;
    save();
  }
}

function save() {
  browser.storage.local.set({ todaySeconds, lastDate });
}

async function load() {
  const d = await browser.storage.local.get(["todaySeconds", "lastDate"]);
  lastDate = getTodayStr();
  todaySeconds = (d.lastDate === lastDate) ? (d.todaySeconds || 0) : 0;
}

async function postToSheets() {
  stopTracking(); // flush any active session before posting
  checkDateReset();

  const minutes = Math.round(todaySeconds / 60);
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // avoids CORS preflight
      body: JSON.stringify({ date: getTodayStr(), source: "laptop", minutes }),
      redirect: "follow"
    });
    console.log(`[Screentime] Posted ${minutes} min to Sheets`);
  } catch (err) {
    console.error("[Screentime] Failed to post:", err);
  }

  // Resume tracking if still on a tracked tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) startTracking(tabs[0].id, tabs[0].url);
}

function scheduleAlarm() {
  const now  = new Date();
  const next = new Date();
  next.setHours(20, 0, 0, 0); // 8:00 PM
  if (now >= next) next.setDate(next.getDate() + 1);
  browser.alarms.create("post8pm", {
    when: next.getTime(),
    periodInMinutes: 1440  // repeat every 24 hours
  });
}

// ── Event listeners ──────────────────────────────────────────
browser.tabs.onActivated.addListener(async ({ tabId }) => {
  checkDateReset();
  stopTracking();
  const tab = await browser.tabs.get(tabId);
  startTracking(tabId, tab.url);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0]?.id === tabId) {
      checkDateReset();
      startTracking(tabId, changeInfo.url);
    }
  });
});

browser.windows.onFocusChanged.addListener(async (winId) => {
  checkDateReset();
  if (winId === browser.windows.WINDOW_ID_NONE) {
    stopTracking();
  } else {
    const tabs = await browser.tabs.query({ active: true, windowId: winId });
    if (tabs[0]) startTracking(tabs[0].id, tabs[0].url);
  }
});

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "post8pm") postToSheets();
});

// ── Startup / Install ─────────────────────────────────────────
browser.runtime.onInstalled.addListener(async () => {
  await load();
  scheduleAlarm();
});

browser.runtime.onStartup.addListener(async () => {
  await load();
  const alarm = await browser.alarms.get("post8pm");
  if (!alarm) scheduleAlarm();
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) startTracking(tabs[0].id, tabs[0].url);
});
