export type OverlayApi = {
  mount(): void;
  unmount(): void;
  setText(text: string): void;
};

export function createOverlay(): OverlayApi {
  let el: HTMLDivElement | null = null;

  return {
    mount() {
      if (el) return;
      el = document.createElement('div');
      el.className = 'ns-slide-overlay';
      el.textContent = '';
      document.documentElement.appendChild(el);
    },
    unmount() {
      if (!el) return;
      el.remove();
      el = null;
    },
    setText(text: string) {
      if (!el) return;
      el.textContent = text;
    }
  };
}
