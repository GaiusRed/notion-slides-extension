export type BoundaryKind = 'start' | 'h1' | 'divider';

export type SlideBoundary = {
  kind: BoundaryKind;
  blockId?: string;
  // Snapshot element at scan time (may become disconnected due to virtualization)
  element?: HTMLElement;
};

export type PresenterState = {
  isPresenting: boolean;
  boundaries: SlideBoundary[];
  currentIndex: number;
  restoreScrollTop: number | null;
};

export type ToggleMessage = { type: 'ns-toggle-presentation' };
export type PingMessage = { type: 'ns-ping' };
export type MessageFromBackground = ToggleMessage | PingMessage;

export type MessageToBackground = { type: 'ns-pong' };
