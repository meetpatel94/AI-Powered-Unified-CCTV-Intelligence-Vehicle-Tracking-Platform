/**
 * Realtime channel stub (alerts, camera state, ANPR hits).
 *
 * Usage once the gateway exists:
 *   const bus = createRealtimeChannel();
 *   bus.on('alert:new', (payload) => ...);
 */

export type RealtimeEvent =
  | 'alert:new'
  | 'alert:ack'
  | 'camera:state'
  | 'anpr:hit'
  | 'kpi:tick'
  | 'analytics:tick'
  | 'investigation:tick'
  /** Per-camera stream health frame (fps, latency, loss, RTSP/WebRTC/HLS state). */
  | 'camera:health';

type Handler = (payload: unknown) => void;

export interface RealtimeChannel {
  on: (event: RealtimeEvent, handler: Handler) => () => void;
  close: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL ?? '';

export function createRealtimeChannel(): RealtimeChannel {
  const handlers = new Map<RealtimeEvent, Set<Handler>>();
  let socket: WebSocket | null = null;

  if (WS_URL) {
    socket = new WebSocket(WS_URL);
    socket.onmessage = (message) => {
      try {
        const { event, payload } = JSON.parse(message.data) as {
          event: RealtimeEvent;
          payload: unknown;
        };
        handlers.get(event)?.forEach((handler) => handler(payload));
      } catch {
        // ignore malformed frames
      }
    };
  }

  return {
    on(event, handler) {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return () => set.delete(handler);
    },
    close() {
      socket?.close();
      handlers.clear();
    },
  };
}
