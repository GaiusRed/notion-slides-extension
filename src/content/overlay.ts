export type OverlayApi = {
  mount(): void;
  unmount(): void;
  setText(text: string): void;
};

export type OverlayActions = {
  start(): void;
  prev(): void;
  next(): void;
};

function createEmojiButton(emoji: string, label: string, onActivate: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ns-overlay-btn';
  btn.textContent = emoji;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);

  const suppressFocusAndPropagation = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  btn.addEventListener('pointerdown', suppressFocusAndPropagation);
  btn.addEventListener('mousedown', suppressFocusAndPropagation);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onActivate();
  });

  return btn;
}

export function createOverlay(actions: OverlayActions): OverlayApi {
  let el: HTMLDivElement | null = null;
  let textEl: HTMLSpanElement | null = null;

  return {
    mount() {
      if (el) return;
      el = document.createElement('div');
      el.className = 'ns-slide-overlay';

      const startBtn = createEmojiButton('<<', 'Return to start', actions.start);
      const prevBtn = createEmojiButton('<', 'Previous slide', actions.prev);
      const nextBtn = createEmojiButton('>', 'Next slide', actions.next);

      textEl = document.createElement('span');
      textEl.className = 'ns-overlay-text';
      textEl.textContent = '';

      el.appendChild(startBtn);
      el.appendChild(prevBtn);
      el.appendChild(nextBtn);
      el.appendChild(textEl);

      document.documentElement.appendChild(el);
    },
    unmount() {
      if (!el) return;
      el.remove();
      el = null;
      textEl = null;
    },
    setText(text: string) {
      if (!textEl) return;
      textEl.textContent = text;
    }
  };
}
