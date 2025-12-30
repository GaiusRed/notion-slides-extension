export type Shortcut = 'next' | 'prev' | 'exit' | 'fullscreen' | 'zoom-in' | 'zoom-out' | 'zoom-reset';

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;

  if (el.isContentEditable) return true;
  if (el.closest('[contenteditable="true"]')) return true;

  return false;
}

export function interpretKey(e: KeyboardEvent): Shortcut | null {
  if (e.key === 'Escape') return 'exit';

  if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) return 'fullscreen';

  if (e.key === '=' || e.key === '+') return 'zoom-in';
  if (e.key === '-' || e.key === '_') return 'zoom-out';
  if (e.key === '0' && !e.shiftKey) return 'zoom-reset';

  if (e.key === 'ArrowLeft' || e.key === 'PageUp') return 'prev';
  if (e.key === ' ' && e.shiftKey) return 'prev';

  if (e.key === 'ArrowRight' || e.key === 'PageDown') return 'next';
  if (e.key === ' ' && !e.shiftKey) return 'next';

  return null;
}
