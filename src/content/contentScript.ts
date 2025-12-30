import { createPresenter } from './presenter';
import { interpretKey, isEditableTarget } from './shortcuts';
import type { MessageFromBackground } from '../shared/types';

const presenter = createPresenter();

console.log('[NotionSlides] Content script loaded');

function onMessage(msg: MessageFromBackground, _sender: chrome.runtime.MessageSender, sendResponse: (resp?: any) => void) {
  if (msg?.type === 'ns-toggle-presentation') {
    console.log('[NotionSlides] Toggle presentation');
    presenter.toggle();
    sendResponse({ ok: true, isPresenting: presenter.isPresenting });
    return true;
  }

  if (msg?.type === 'ns-ping') {
    sendResponse({ ok: true });
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener(onMessage);

window.addEventListener(
  'keydown',
  (e) => {
    if (!presenter.isPresenting) return;

    const action = interpretKey(e);
    if (!action) return;

    // Always allow Escape.
    if (action !== 'exit') {
      const editing = isEditableTarget(e.target);
      const hasModifier = e.metaKey || e.ctrlKey || e.altKey;

      // In editing contexts, do not hijack navigation keys unless a modifier is used.
      if (editing && !hasModifier) return;
    }

    // Prevent default browser scrolling in presentation mode.
    // (We avoid preventing if we're not actually handling.)
    e.preventDefault();
    e.stopPropagation();

    if (action === 'next') presenter.next();
    if (action === 'prev') presenter.prev();
    if (action === 'fullscreen') void presenter.fullscreen();
    if (action === 'exit') presenter.exit();
  },
  { capture: true }
);
