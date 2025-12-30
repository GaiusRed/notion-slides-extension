import { createPresenter } from './presenter';
import { interpretKey, isEditableTarget } from './shortcuts';
import type { MessageFromBackground } from '../shared/types';

const presenter = createPresenter();

function onMessage(msg: MessageFromBackground, _sender: chrome.runtime.MessageSender, sendResponse: (resp?: any) => void) {
  if (msg?.type === 'ns-toggle-presentation') {
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

    if (action !== 'exit') {
      const editing = isEditableTarget(e.target);
      const hasModifier = e.metaKey || e.ctrlKey || e.altKey;

      if (editing && !hasModifier) return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (action === 'next') presenter.next();
    if (action === 'prev') presenter.prev();
    if (action === 'fullscreen') void presenter.fullscreen();
    if (action === 'zoom-in') presenter.zoomIn();
    if (action === 'zoom-out') presenter.zoomOut();
    if (action === 'zoom-reset') presenter.zoomReset();
    if (action === 'exit') presenter.exit();
  },
  { capture: true }
);
