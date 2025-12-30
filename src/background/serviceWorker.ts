import type { MessageToBackground } from '../shared/types';

async function getActiveTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  return tab?.id ?? null;
}

async function ping(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ns-ping' });
    return true;
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  const ok = await ping(tabId);
  if (ok) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/contentScript.js']
    });
  } catch {
  }
}

async function sendToggle(tabId: number): Promise<void> {
  await ensureContentScript(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ns-toggle-presentation' });
  } catch {
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await sendToggle(tab.id);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-presentation') return;
  const tabId = await getActiveTabId();
  if (!tabId) return;
  await sendToggle(tabId);
});

chrome.runtime.onMessage.addListener((msg: MessageToBackground) => {
  if (msg?.type === 'ns-pong') {
  }
});
