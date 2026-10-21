const APP_VERSION = '1.1.0';
const TAB_URL = chrome.runtime.getURL('tab.html');

// Open full tab on icon click
chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: TAB_URL });
  if (tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: TAB_URL });
  }
});

// Auto-lock session
let lockTimer = null;
function resetLockTimer(minutes) {
  if (lockTimer) clearTimeout(lockTimer);
  if (!minutes || minutes <= 0) return;
  lockTimer = setTimeout(() => {
    chrome.storage.session.set({ unlocked: false });
  }, minutes * 60 * 1000);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RESET_LOCK_TIMER') resetLockTimer(msg.minutes || 15);
  if (msg.type === 'LOCK_NOW') { chrome.storage.session.set({ unlocked: false }); sendResponse({ ok: true }); }
  if (msg.type === 'GET_VERSION') sendResponse({ version: APP_VERSION });
  return true;
});
