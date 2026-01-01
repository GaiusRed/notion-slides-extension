import type { PresenterState, SlideBoundary } from '../shared/types';
import { PRESENTATION_CSS } from './styles';
import { createOverlay, type OverlayApi } from './overlay';
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

function findPropertyContainer(root: HTMLElement): HTMLElement | null {
  const parent = root.parentElement;
  if (!parent) return null;
  
  const grandparent = parent.parentElement;
  if (!grandparent) return null;
  
  for (const sibling of Array.from(grandparent.children)) {
    if (!(sibling instanceof HTMLElement) || sibling === parent) continue;
    
    const hasLayoutContentWithDivider = sibling.classList.contains('layout-content-with-divider');
    const hasPropertyKeywords = /Tags|Status|Related Area|Related Project|Date|Created by/i.test(sibling.textContent || '');
    
    if (hasLayoutContentWithDivider || hasPropertyKeywords) {
      return sibling;
    }
  }
  
  return null;
}

function getCssPath(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.hasAttribute('data-block-id')) return `[data-block-id="${CSS.escape(el.getAttribute('data-block-id')!)}"]`;
  
  const path: string[] = [];
  let cur: HTMLElement | null = el;
  
  while (cur && cur !== document.body && cur !== document.documentElement) {
    let selector = cur.tagName.toLowerCase();
    
    if (cur.id) {
      selector = `#${CSS.escape(cur.id)}`;
      path.unshift(selector);
      break;
    }
    
    if (cur.hasAttribute('data-block-id')) {
      selector = `[data-block-id="${CSS.escape(cur.getAttribute('data-block-id')!)}"]`;
      path.unshift(selector);
      break;
    }

    let nth = 1;
    let sib = cur.previousElementSibling;
    while (sib) {
      nth++;
      sib = sib.previousElementSibling;
    }
    selector += `:nth-child(${nth})`;
    path.unshift(selector);
    
    cur = cur.parentElement;
  }
  
  return path.join(' > ');
}

function applySlideVisibilityCss(
  root: HTMLElement,
  boundaries: SlideBoundary[],
  currentIndex: number,
  slideStyleEl: HTMLStyleElement | null
): void {
  if (!slideStyleEl) return;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'));

  if (!blocks.length || !boundaries.length) {
    slideStyleEl.textContent = '';
    return;
  }

  const startEl = resolveBoundaryElement(root, boundaries[currentIndex])?.closest<HTMLElement>('[data-block-id]') ?? null;
  const nextBoundary = currentIndex + 1 < boundaries.length ? boundaries[currentIndex + 1] : null;
  const endEl = nextBoundary ? resolveBoundaryElement(root, nextBoundary)?.closest<HTMLElement>('[data-block-id]') ?? null : null;

  const startIdx = startEl ? blocks.indexOf(startEl) : 0;
  const endIdx = endEl ? blocks.indexOf(endEl) : -1;

  const rangeStart = startIdx >= 0 ? startIdx : 0;
  const rangeEnd = endIdx >= 0 ? endIdx : blocks.length;

  const ids: string[] = [];
  for (let i = rangeStart; i < rangeEnd; i++) {
    const id = blocks[i].getAttribute('data-block-id');
    if (id) ids.push(id);
  }

  const notSelectors = ids
    .slice(0, 2000)
    .map((id) => `:not([data-block-id="${CSS.escape(id)}"])`)
    .join('');

  slideStyleEl.textContent = `
:root.ns-presenting [data-block-id]${notSelectors} { display: none !important; }
`;
}

export function createPresenter() {
  let overlay: OverlayApi;

  let styleEl: HTMLStyleElement | null = null;
  let slideVisibilityEl: HTMLStyleElement | null = null;
  let headerHideEl: HTMLStyleElement | null = null;
  let observer: MutationObserver | null = null;
  let recomputeTimer: number | null = null;

  let scrollContainerRestore:
    | {
        el: HTMLElement;
        prev: {
          width: string;
          maxWidth: string;
          marginLeft: string;
          marginRight: string;
        };
      }
    | null = null;

  const state: PresenterState = {
    isPresenting: false,
    boundaries: [],
    currentIndex: 0,
    restoreScrollTop: null,
    zoomLevel: 1.5
  };

  overlay = createOverlay({
    start: () => gotoIndex(0),
    prev: () => gotoIndex(state.currentIndex - 1, 'prev'),
    next: () => gotoIndex(state.currentIndex + 1, 'next')
  });

  function ensureStyle(): void {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-ns-presenter', '');
    styleEl.textContent = PRESENTATION_CSS;
    document.head.appendChild(styleEl);

    if (!slideVisibilityEl) {
      slideVisibilityEl = document.createElement('style');
      slideVisibilityEl.setAttribute('data-ns-slide-visibility', '');
      document.head.appendChild(slideVisibilityEl);
    }

    if (!headerHideEl) {
      headerHideEl = document.createElement('style');
      headerHideEl.setAttribute('data-ns-header-hide', '');
      document.head.appendChild(headerHideEl);
    }
  }

  function removeStyle(): void {
    if (!styleEl) return;
    styleEl.remove();
    styleEl = null;

    if (slideVisibilityEl) {
      slideVisibilityEl.remove();
      slideVisibilityEl = null;
    }

    if (headerHideEl) {
      headerHideEl.remove();
      headerHideEl = null;
    }
  }

  function hideHeaderCSS(): void {
    if (!headerHideEl) return;
    
    const root = getContentRoot();
    const propertyContainer = findPropertyContainer(root);
    
    if (propertyContainer) {
      const selector = `:root.ns-presenting ${getCssPath(propertyContainer)}`;
      headerHideEl.textContent = `${selector} { display: none !important; }`;
    } else {
      headerHideEl.textContent = '';
    }
  }

  function pushScrollbarToEdge(): void {
    const target = getScrollTarget();
    if (target.kind !== 'element') return;

    const el = target.el;
    scrollContainerRestore = {
      el,
      prev: {
        width: el.style.width,
        maxWidth: el.style.maxWidth,
        marginLeft: el.style.marginLeft,
        marginRight: el.style.marginRight
      }
    };

    el.style.width = '100vw';
    el.style.maxWidth = 'none';
    el.style.marginLeft = '0';
    el.style.marginRight = '0';
  }

  function restoreScrollbarContainer(): void {
    if (!scrollContainerRestore) return;
    const { el, prev } = scrollContainerRestore;
    el.style.width = prev.width;
    el.style.maxWidth = prev.maxWidth;
    el.style.marginLeft = prev.marginLeft;
    el.style.marginRight = prev.marginRight;
    scrollContainerRestore = null;
  }

  function updateOverlay(): void {
    const zoomPercent = Math.round(state.zoomLevel * 100);
    overlay.setText(`${state.currentIndex + 1}/${Math.max(1, state.boundaries.length)} · ${zoomPercent}%`);
  }

  function applyZoom(): void {
    if (!state.isPresenting) return;
    const root = getContentRoot();
    root.style.transform = `scale(${state.zoomLevel})`;
    root.style.transformOrigin = 'top center';
    root.style.transition = 'transform 0.2s ease-out';
  }

  function clearZoom(): void {
    const root = getContentRoot();
    root.style.transform = '';
    root.style.transformOrigin = '';
    root.style.transition = '';
  }

  function recomputeBoundaries(reason: 'enter' | 'mutation' | 'navigate') {
    if (state.isPresenting) {
      hideHeaderCSS();
    }
    const root = getContentRoot();
    const target = getScrollTarget();
    const boundaries = scanSlideBoundaries(root);

    const previousBoundaryId = state.boundaries[state.currentIndex]?.blockId;

    state.boundaries = boundaries.length ? boundaries : [{ kind: 'start', element: root }];

    if (reason === 'enter' || !previousBoundaryId) {
      state.currentIndex = clamp(nearestBoundaryIndexFromScroll(root, target, state.boundaries), 0, state.boundaries.length - 1);
    } else {
      const idx = state.boundaries.findIndex((b) => b.blockId === previousBoundaryId);
      state.currentIndex = clamp(idx >= 0 ? idx : nearestBoundaryIndexFromScroll(root, target, state.boundaries), 0, state.boundaries.length - 1);
    }

    updateOverlay();
    applySlideVisibilityCss(root, state.boundaries, state.currentIndex, slideVisibilityEl);
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
    } catch {
    }
  }

  function gotoIndex(nextIndex: number, direction?: 'next' | 'prev'): void {
    if (!state.isPresenting) return;
    const root = getContentRoot();
    const target = getScrollTarget();

    const clamped = clamp(nextIndex, 0, state.boundaries.length - 1);
    const firstTry = resolveBoundaryElement(root, state.boundaries[clamped]);

    if (!firstTry) {
      recomputeBoundaries('navigate');
    }

    const resolved = resolveBoundaryElement(getContentRoot(), state.boundaries[clamped]);
    if (!resolved) {
      state.currentIndex = clamped;
      updateOverlay();
      return;
    }

    const oldIndex = state.currentIndex;
    state.currentIndex = clamped;
    updateOverlay();

    applySlideVisibilityCss(getContentRoot(), state.boundaries, state.currentIndex, slideVisibilityEl);

    // Add directional slide animation
    if (direction && oldIndex !== clamped) {
      // Next: slide up (from below), Prev: slide down (from above)
      const slideDistance = direction === 'next' ? 200 : -200;
      
      // Start with content offset in the opposite direction
      root.style.transition = 'none';
      root.style.transform = `translateY(${slideDistance}px) scale(${state.zoomLevel})`;
      
      // Scroll to new position instantly
      scrollToElementStart(target, resolved, 'auto');
      
      // Trigger reflow to ensure the transform is applied
      void root.offsetHeight;
      
      // Animate content sliding into view
      root.style.transition = 'transform 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)';
      root.style.transform = `translateY(0) scale(${state.zoomLevel})`;
      
      setTimeout(() => {
        root.style.transition = '';
      }, 450);
    } else {
      scrollToElementStart(target, resolved, 'smooth');
    }
  }

  function startObserving(): void {
    if (observer) return;
    const root = getContentRoot();
    observer = new MutationObserver(() => scheduleRecompute());
    observer.observe(root, { subtree: true, childList: true, characterData: true });
  }

  function stopObserving(): void {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  function enter(): void {
    if (state.isPresenting) return;
    state.isPresenting = true;

    ensureStyle();

    const root = getContentRoot();
    pushScrollbarToEdge();

    const target = getScrollTarget();
    state.restoreScrollTop = getScrollTop(target);

    document.documentElement.classList.add('ns-presenting');
    overlay.mount();

    recomputeBoundaries('enter');
    applyZoom();
    startObserving();
  }

  function exit(): void {
    if (!state.isPresenting) return;
    state.isPresenting = false;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }

    document.documentElement.classList.remove('ns-presenting');
    overlay.unmount();
    stopObserving();
    removeStyle();
    clearZoom();

    restoreScrollbarContainer();

    const restore = state.restoreScrollTop;
    state.restoreScrollTop = null;

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
    state.zoomLevel = 1.5;
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
    start() {
      gotoIndex(0);
    },
    next() {
      gotoIndex(state.currentIndex + 1, 'next');
    },
    prev() {
      gotoIndex(state.currentIndex - 1, 'prev');
    },
    async fullscreen() {
      await toggleFullscreen();
    },
    zoomIn() {
      state.zoomLevel = Math.min(3, state.zoomLevel + 0.1);
      applyZoom();
      updateOverlay();
    },
    zoomOut() {
      state.zoomLevel = Math.max(0.5, state.zoomLevel - 0.1);
      applyZoom();
      updateOverlay();
    },
    zoomReset() {
      state.zoomLevel = 1;
      applyZoom();
      updateOverlay();
    },
    exit() {
      exit();
    }
  };
}
