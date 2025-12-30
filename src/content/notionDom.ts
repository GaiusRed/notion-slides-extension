import type { SlideBoundary } from '../shared/types';

function isElement(node: unknown): node is Element {
  return !!node && typeof node === 'object' && (node as Element).nodeType === Node.ELEMENT_NODE;
}

export type ScrollTarget =
  | { kind: 'window' }
  | { kind: 'element'; el: HTMLElement };

function isScrollable(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  const canScrollY = overflowY === 'auto' || overflowY === 'scroll';
  return canScrollY && el.scrollHeight > el.clientHeight + 50;
}

function findScrollableAncestor(start: Element | null): HTMLElement | null {
  let cur: Element | null = start;
  while (cur) {
    if (cur instanceof HTMLElement && isScrollable(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

export function getScrollTarget(): ScrollTarget {
  const root = getContentRoot();
  const scrollAncestor = findScrollableAncestor(root);
  if (scrollAncestor) return { kind: 'element', el: scrollAncestor };

  const overflowHint = document
    .querySelector('[data-testid="page-content"]')
    ?.closest<HTMLElement>('[style*="overflow"]');

  const candidates: Array<Element | null> = [
    document.querySelector('.notion-frame'),
    document.querySelector('.notion-scroller'),
    overflowHint ?? null,
    document.querySelector('[role="main"]')
  ];

  for (const c of candidates) {
    if (!c) continue;
    const el = c as HTMLElement;
    if (isScrollable(el)) return { kind: 'element', el };
  }

  return { kind: 'window' };
}

export function getContentRoot(): HTMLElement {
  const byTestId = document.querySelector('[data-testid="page-content"]');
  if (byTestId && isElement(byTestId)) return byTestId as HTMLElement;

  const notionPage = document.querySelector('.notion-page-content');
  if (notionPage && isElement(notionPage)) return notionPage as HTMLElement;

  const main = document.querySelector('[role="main"]');
  if (main && isElement(main)) return main as HTMLElement;

  return document.body;
}

function closestBlock(el: Element): HTMLElement {
  const block = el.closest<HTMLElement>('[data-block-id]');
  if (block) return block;

  const selectable = el.closest<HTMLElement>('.notion-selectable');
  if (selectable) return selectable;

  return el as HTMLElement;
}

function uniqBoundaries(boundaries: SlideBoundary[]): SlideBoundary[] {
  const seen = new Set<string>();
  const out: SlideBoundary[] = [];

  for (const b of boundaries) {
    const key = b.blockId ? `id:${b.blockId}` : b.element ? `el:${(b.element as any)}` : JSON.stringify(b);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }

  return out;
}

export function scanSlideBoundaries(root: HTMLElement): SlideBoundary[] {
  const boundaries: SlideBoundary[] = [];

  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'));

  const firstBlock = blocks[0] ?? root.firstElementChild?.closest<HTMLElement>('*') ?? root;
  boundaries.push({ kind: 'start', blockId: firstBlock?.getAttribute?.('data-block-id') ?? undefined, element: firstBlock ?? root });

  const h1Candidates: Element[] = [
    ...Array.from(root.querySelectorAll('[role="heading"][aria-level="1"]')),
    ...Array.from(root.querySelectorAll('h1'))
  ];

  for (const h of h1Candidates) {
    const block = closestBlock(h);
    boundaries.push({ kind: 'h1', blockId: block.getAttribute('data-block-id') ?? undefined, element: block });
  }

  const dividerCandidates: Element[] = [
    ...Array.from(root.querySelectorAll('hr')),
    ...Array.from(root.querySelectorAll('[role="separator"]')),
    ...Array.from(root.querySelectorAll('.notion-divider-block'))
  ];

  for (const d of dividerCandidates) {
    const dividerBlock = closestBlock(d);
    const idx = blocks.indexOf(dividerBlock);
    const nextBlock = idx >= 0 ? blocks[idx + 1] : null;
    const boundaryEl = nextBlock ?? dividerBlock;
    boundaries.push({
      kind: 'divider',
      blockId: boundaryEl.getAttribute('data-block-id') ?? undefined,
      element: boundaryEl
    });
  }

  return uniqBoundaries(boundaries);
}

export function resolveBoundaryElement(root: HTMLElement, b: SlideBoundary): HTMLElement | null {
  if (b.element && b.element.isConnected) return b.element;
  if (b.blockId) {
    const byId = root.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(b.blockId)}"]`);
    if (byId) return byId;
  }
  return null;
}

export function getScrollTop(target: ScrollTarget): number {
  if (target.kind === 'window') return window.scrollY;
  return target.el.scrollTop;
}

export function scrollToElementStart(target: ScrollTarget, el: HTMLElement, behavior: ScrollBehavior): void {
  if (target.kind === 'window') {
    const y = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y, behavior });
    return;
  }

  const containerRect = target.el.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const nextTop = elRect.top - containerRect.top + target.el.scrollTop;
  target.el.scrollTo({ top: nextTop, behavior });
}
