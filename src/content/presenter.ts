import type { PresenterState, SlideBoundary } from '../shared/types';
import { PRESENTATION_CSS } from './styles';
import { createOverlay } from './overlay';
import {
  getContentRoot,
  getScrollTarget,
  getScrollTop,
  resolveBoundaryElement,
  scanSlideBoundaries,
  scrollToElementStart,
  type ScrollTarget
} from './notionDom';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function nearestBoundaryIndexFromScroll(root: HTMLElement, target: ScrollTarget, boundaries: SlideBoundary[]): number {
  const top = getScrollTop(target);

  // We look for the last boundary whose top is <= current scroll.
  // For element scroll containers, convert element offsets to container scroll space.
  const containerTop = target.kind === 'window' ? 0 : target.el.getBoundingClientRect().top;

  let best = 0;
  for (let i = 0; i < boundaries.length; i++) {
    const el = resolveBoundaryElement(root, boundaries[i]);
    if (!el) continue;

    if (target.kind === 'window') {
      const y = el.getBoundingClientRect().top + window.scrollY;
      if (y <= top + 4) best = i;
    } else {
      const y = el.getBoundingClientRect().top - containerTop + target.el.scrollTop;
      if (y <= top + 4) best = i;
    }
  }
  return best;
}

export function createPresenter() {
  const overlay = createOverlay();

  let styleEl: HTMLStyleElement | null = null;
  let observer: MutationObserver | null = null;
  let recomputeTimer: number | null = null;

  const state: PresenterState = {
    isPresenting: false,
    boundaries: [],
    currentIndex: 0,
    restoreScrollTop: null
  };

  function ensureStyle(): void {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-ns-presenter', '');
    styleEl.textContent = PRESENTATION_CSS;
    document.head.appendChild(styleEl);
  }

  function removeStyle(): void {
    if (!styleEl) return;
    styleEl.remove();
    styleEl = null;
  }

  function updateOverlay(): void {
    overlay.setText(`${state.currentIndex + 1}/${Math.max(1, state.boundaries.length)}`);
  }

  function recomputeBoundaries(reason: 'enter' | 'mutation' | 'navigate') {
    const root = getContentRoot();
    const target = getScrollTarget();
    const boundaries = scanSlideBoundaries(root);

    // If empty (shouldn't be), keep at least start.
    state.boundaries = boundaries.length ? boundaries : [{ kind: 'start', element: root }];

    // Keep the current slide anchored by scroll position.
    state.currentIndex = clamp(nearestBoundaryIndexFromScroll(root, target, state.boundaries), 0, state.boundaries.length - 1);

    updateOverlay();

    if (reason === 'enter') {
      // Nothing else.
    }
  }

  function scheduleRecompute(): void {
    if (!state.isPresenting) return;
    if (recomputeTimer) window.clearTimeout(recomputeTimer);
    recomputeTimer = window.setTimeout(() => {
      recomputeTimer = null;
      recomputeBoundaries('mutation');
    }, 400);
  }

  async function toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      // MVP: keep it non-fatal.
      console.warn('[NotionSlides] Fullscreen failed:', e);
    }
  }

  function gotoIndex(nextIndex: number): void {
    if (!state.isPresenting) return;
    const root = getContentRoot();
    const target = getScrollTarget();

    // Best effort: resolve element, otherwise recompute then try.
    const clamped = clamp(nextIndex, 0, state.boundaries.length - 1);
    const firstTry = resolveBoundaryElement(root, state.boundaries[clamped]);

    if (!firstTry) {
      recomputeBoundaries('navigate');
    }

    const resolved = resolveBoundaryElement(getContentRoot(), state.boundaries[clamped]);
    if (!resolved) {
      // If still missing due to virtualization, do nothing beyond updating overlay.
      state.currentIndex = clamped;
      updateOverlay();
      return;
    }

    state.currentIndex = clamped;
    updateOverlay();

    scrollToElementStart(target, resolved, 'smooth');
  }

  function startObserving(): void {
    if (observer) return;
    const root = getContentRoot();
    observer = new MutationObserver(() => scheduleRecompute());
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
  }

  function stopObserving(): void {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  function enter(): void {
    if (state.isPresenting) return;
    state.isPresenting = true;

    console.log('[NotionSlides] Enter presentation');

    ensureStyle();

    const target = getScrollTarget();
    state.restoreScrollTop = getScrollTop(target);

    document.documentElement.classList.add('ns-presenting');
    overlay.mount();

    recomputeBoundaries('enter');
    startObserving();
  }

  function exit(): void {
    if (!state.isPresenting) return;
    state.isPresenting = false;

    console.log('[NotionSlides] Exit presentation');

    // Leave fullscreen if active.
    if (document.fullscreenElement) {
      // Fire and forget.
      void document.exitFullscreen();
    }

    document.documentElement.classList.remove('ns-presenting');
    overlay.unmount();
    stopObserving();
    removeStyle();

    // Restore scroll position from before entering.
    const restore = state.restoreScrollTop;
    state.restoreScrollTop = null;

    // Restore after styles are removed to avoid layout interference.
    if (typeof restore === 'number') {
      const target = getScrollTarget();
      if (target.kind === 'window') {
        window.scrollTo({ top: restore, behavior: 'auto' });
      } else {
        target.el.scrollTo({ top: restore, behavior: 'auto' });
      }
    }

    state.boundaries = [];
    state.currentIndex = 0;
  }

  function toggle(): void {
    if (state.isPresenting) exit();
    else enter();
  }

  return {
    get isPresenting() {
      return state.isPresenting;
    },
    toggle,
    next() {
      gotoIndex(state.currentIndex + 1);
    },
    prev() {
      gotoIndex(state.currentIndex - 1);
    },
    async fullscreen() {
      await toggleFullscreen();
    },
    exit() {
      exit();
    }
  };
}
