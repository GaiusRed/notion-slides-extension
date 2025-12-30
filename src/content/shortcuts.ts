export type Shortcut = 'next' | 'prev' | 'exit' | 'fullscreen';

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;

  // Contenteditable itself or within.
  if (el.isContentEditable) return true;
  if (el.closest('[contenteditable="true"]')) return true;

  return false;
}

export function interpretKey(e: KeyboardEvent): Shortcut | null {
  // Exit always.
  if (e.key === 'Escape') return 'exit';

  // Fullscreen toggle in presenting.
  if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) return 'fullscreen';

  // Prev
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') return 'prev';
  if (e.key === ' ' && e.shiftKey) return 'prev';

  // Next
  if (e.key === 'ArrowRight' || e.key === 'PageDown') return 'next';
  if (e.key === ' ' && !e.shiftKey) return 'next';

  return null;
}
