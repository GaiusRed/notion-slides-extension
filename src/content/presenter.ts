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

function isBefore(a: Node, b: Node): boolean {
  // True if `a` comes before `b` in document order.
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function findVoidHeaderContainer(marker: HTMLElement, firstBlock: HTMLElement): HTMLElement | null {
  // In many Notion DB pages, the `contenteditable=false data-content-editable-void=true` node is a marker.
  // The *visible* header strip is typically a sibling under the same parent or a small ancestor wrapper.
  let cur: HTMLElement | null = marker.parentElement;
  for (let depth = 0; depth < 4 && cur; depth++) {
    if (cur.querySelector('[data-block-id]')) return null;

    if (isBefore(cur, firstBlock)) return cur;

    cur = cur.parentElement;
  }
  return null;
}

function looksLikeDbGridStrip(el: HTMLElement): boolean {
  // Matches the inline-style grid used by the DB property/tag strip.
  // Heuristic: It uses grid-template-columns.
  const style = el.getAttribute('style') || '';
  return style.includes('grid-template-columns');
}

function looksLikePropertyRow(el: HTMLElement): boolean {
  // Heuristic: Property rows often contain specific labels.
  // We don't check for data-block-id here because sometimes the wrapper might not have it, 
  // but we want to be careful not to hide actual content.
  const text = el.textContent || '';
  // specific property names often found in headers
  const markers = ['Tags', 'Related Area', 'Related Project', 'Related Resource', 'Status', 'Date', 'Created by'];
  const hasMarker = markers.some(m => text.includes(m));
  
  // It should be a relatively short row, not a paragraph of text containing the word "Date".
  return hasMarker && text.length < 300; 
}

function findHeaderElementsToHide(root: HTMLElement, firstBlock: HTMLElement | null): HTMLElement[] {
  const toHide: HTMLElement[] = [];

  // 1. Search for specific text markers in the top part of the page
  // We limit the search to elements before the first block to avoid scanning the whole doc.
  
  // Helper to check if an element is visually above the first block
  const isAbove = (el: HTMLElement) => {
    if (!firstBlock) return true;
    return isBefore(el, firstBlock);
  };

  // Strategy: Find all text nodes containing markers, then find their row containers.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const markers = ['Tags', 'Related Area', 'Related Project', 'Related Resource', 'Status', 'Date', 'Created by'];
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.parentElement) continue;
    // Optimization: if we passed the first block, stop.
    if (firstBlock && firstBlock.compareDocumentPosition(node.parentElement) & Node.DOCUMENT_POSITION_PRECEDING) {
       // node is after firstBlock
       continue; 
    }

    const text = node.textContent || '';
    if (markers.some(m => text.includes(m))) {
      // Found a marker. Walk up to find a suitable container to hide.
      // We look for a container that is a direct child of a layout wrapper or has specific classes.
      let cur: HTMLElement | null = node.parentElement;
      let candidate: HTMLElement | null = null;
      
      // Walk up max 5 levels
      for (let i = 0; i < 5 && cur && cur !== root; i++) {
        if (cur.hasAttribute('data-block-id')) {
            candidate = null; // Don't hide actual blocks
            break;
        }
        
        // If it looks like a row (flex/grid) or has specific classes
        const style = window.getComputedStyle(cur);
        if (style.display === 'flex' || style.display === 'grid' || cur.className.includes('property')) {
            candidate = cur;
        }
        cur = cur.parentElement;
      }
      
      if (candidate && isAbove(candidate)) {
        toHide.push(candidate);
      }
    }
  }

  // 2. Grid strips (fallback)
  const grids = Array.from(document.querySelectorAll<HTMLElement>('div[style*="grid-template-columns"]'));
  for (const grid of grids) {
    if (isAbove(grid) && !grid.querySelector('[data-block-id]')) {
      toHide.push(grid);
    }
  }

  return toHide;
}

function getBlocks(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'));
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

    // Use nth-child for robustness
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
  const blocks = getBlocks(root);

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

  // Revert to v3 logic (CSS :not selector) to avoid display: revert issues.
  // This ensures we don't break the layout of code blocks or other complex elements.
  const notSelectors = ids
    .slice(0, 2000)
    .map((id) => `:not([data-block-id="${CSS.escape(id)}"])`)
    .join('');

  slideStyleEl.textContent = `
:root.ns-presenting [data-block-id]${notSelectors} { display: none !important; }
`;
}

export function createPresenter() {
  const overlay = createOverlay();

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
    restoreScrollTop: null
  };

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
    const firstBlock = root.querySelector<HTMLElement>('[data-block-id]');
    
    const toHide = findHeaderElementsToHide(root, firstBlock);

    // Deduplicate
    const uniqueToHide = Array.from(new Set(toHide));

    // 3. Generate CSS selectors
    const selectors = uniqueToHide.map(el => `:root.ns-presenting ${getCssPath(el)}`).join(',\n');
    
    headerHideEl.textContent = selectors ? `${selectors} { display: none !important; }` : '';
  }

  function hideEl(el: HTMLElement): boolean {
    if (!hiddenHeaderPrev.has(el)) {
      hiddenHeaderPrev.set(el, {
        value: el.style.getPropertyValue('display'),
        priority: el.style.getPropertyPriority('display')
      });
    }
    // Force override even if Notion sets display via !important.
    el.style.setProperty('display', 'none', 'important');
    return true;
  }

  function hideHeaderBeforeFirstBlock(): void {
    // Many Notion DB pages render a non-block header/properties area above the first block.
    // We hide siblings that come BEFORE the first block at each nesting level,
    // but only when they contain no blocks. This avoids hiding real slide content.
    let root = getContentRoot();
    let firstBlock = root.querySelector<HTMLElement>('[data-block-id]');

    // Fallback: some Notion layouts render blocks outside the detected root.
    if (!firstBlock) {
      firstBlock = document.querySelector<HTMLElement>('[data-block-id]');
      if (firstBlock) root = (firstBlock.closest('[data-testid="page-content"]') as HTMLElement) ?? document.body;
    }

    if (!firstBlock || !document.contains(firstBlock)) return;

    // Always attempt to hide known header/property shells (safe: they should not contain blocks).
    const alwaysHideSelectors = [
      '.notion-page-header',
      '.notion-page-controls',
      '[data-testid="page-header"]',
      '[data-testid="page-properties"]',
      '[data-testid="page-cover"]',
      '[data-testid="page-icon"]'
    ];
    for (const sel of alwaysHideSelectors) {
      const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
      for (const el of els) {
        if (el.querySelector('[data-block-id]')) continue;
        hideEl(el);
      }
    }

    const path: HTMLElement[] = [];
    let cur: HTMLElement | null = firstBlock;
    while (cur && cur !== root) {
      path.push(cur);
      cur = cur.parentElement as HTMLElement | null;
    }
    path.push(root);
    path.reverse();

    // For each parent->child on the path, hide preceding siblings that contain no blocks.
    for (let i = 0; i < path.length - 1; i++) {
      const parent = path[i];
      const childOnPath = path[i + 1];
      const children = Array.from(parent.children) as HTMLElement[];
      for (const child of children) {
        if (child === childOnPath) break;
        if (child.querySelector('[data-block-id]')) continue;
        
        // Aggressive check: if it looks like a property row, hide it.
        if (looksLikePropertyRow(child) || looksLikeDbGridStrip(child)) {
            hideEl(child);
            continue;
        }

        hideEl(child);
      }
    }

    // Extra: Notion DB pages often use this wrapper for the properties strip.
    // Hide it if it appears before the first block and contains no blocks.
    const layoutStrips = Array.from(document.querySelectorAll<HTMLElement>('.layout-content.layout-content-with-divider'));
    for (const el of layoutStrips) {
      if (!isBefore(el, firstBlock)) continue;
      if (el.querySelector('[data-block-id]')) continue;
      hideEl(el);
    }

    // Fallback: Scan for property-like grids anywhere above the first block
    // This catches cases where the properties are not direct siblings in the path
    const potentialGrids = Array.from(document.querySelectorAll<HTMLElement>('div[style*="grid-template-columns"]'));
    for (const grid of potentialGrids) {
        if (isBefore(grid, firstBlock) && !grid.querySelector('[data-block-id]')) {
            hideEl(grid);
        }
    }

    // Specific: the database property/tag strip often lives in a ContentEditableVoid container.
    // User confirmed removing this node removes the header strip.
    const voidHeaderCandidates = Array.from(
      document.querySelectorAll<HTMLElement>('[data-content-editable-void="true"][contenteditable="false"]')
    );
    let voidContainersHidden = 0;
    for (const marker of voidHeaderCandidates) {
      if (marker.querySelector('[data-block-id]')) continue;

      // 1) Hide the marker itself if it looks like the strip.
      // We check this BEFORE checking parent/sibling relationships.
      if (looksLikeDbGridStrip(marker) || isBefore(marker, firstBlock)) {
        hideEl(marker);
      }

      const container = findVoidHeaderContainer(marker, firstBlock);
      if (!container) continue;

      // Safety cap: don't hide tons of containers on huge pages.
      if (voidContainersHidden >= 25) break;

      hideEl(container);
      voidContainersHidden++;

      // 2) If the visible strip is in a sibling wrapper, hide siblings that match the grid signature.
      const parent = container.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children) as HTMLElement[];
        for (const sib of siblings) {
          if (sib === container) continue;
          if (sib.querySelector('[data-block-id]')) continue;
          const sibLooksGrid = looksLikeDbGridStrip(sib);
          if (!sibLooksGrid) continue;
          hideEl(sib);
        }
      }
    }
  }

  function restoreHiddenHeader(): void {
    for (const [el, prev] of hiddenHeaderPrev.entries()) {
      if (!prev.value) {
        el.style.removeProperty('display');
      } else {
        el.style.setProperty('display', prev.value, prev.priority || undefined);
      }
    }
    hiddenHeaderPrev.clear();
  }

  function pushScrollbarToEdge(): void {
    const target = getScrollTarget();
    if (target.kind !== 'element') return;

    const el = target.el;
    // Save previous inline styles and widen the actual scroll container.
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
    overlay.setText(`${state.currentIndex + 1}/${Math.max(1, state.boundaries.length)}`);
  }

  function recomputeBoundaries(reason: 'enter' | 'mutation' | 'navigate') {
    if (state.isPresenting) {
      hideHeaderCSS();
    }
    const root = getContentRoot();
    const target = getScrollTarget();
    const boundaries = scanSlideBoundaries(root);

    const previousBoundaryId = state.boundaries[state.currentIndex]?.blockId;

    // If empty (shouldn't be), keep at least start.
    state.boundaries = boundaries.length ? boundaries : [{ kind: 'start', element: root }];

    // Keep slide stable across mutations. If we recalc from scroll while hiding blocks,
    // scroll position can shift and incorrectly map to the last boundary.
    if (reason === 'enter' || !previousBoundaryId) {
      state.currentIndex = clamp(nearestBoundaryIndexFromScroll(root, target, state.boundaries), 0, state.boundaries.length - 1);
    } else {
      const idx = state.boundaries.findIndex((b) => b.blockId === previousBoundaryId);
      state.currentIndex = clamp(idx >= 0 ? idx : nearestBoundaryIndexFromScroll(root, target, state.boundaries), 0, state.boundaries.length - 1);
    }

    updateOverlay();

    // Ensure only the current slide is visible.
    applySlideVisibilityCss(root, state.boundaries, state.currentIndex, slideVisibilityEl);

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

    applySlideVisibilityCss(getContentRoot(), state.boundaries, state.currentIndex, slideVisibilityEl);

    scrollToElementStart(target, resolved, 'smooth');
  }

  function startObserving(): void {
    if (observer) return;
    const root = getContentRoot();
    observer = new MutationObserver(() => scheduleRecompute());
    // Avoid observing attribute mutations; Notion updates attributes frequently and may create noise.
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

    console.log('[NotionSlides] Enter presentation (v6)');

    ensureStyle();

    // Apply UI cleanup + scrollbar adjustments based on actual DOM.
    const root = getContentRoot();
    pushScrollbarToEdge();

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

    restoreScrollbarContainer();

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
