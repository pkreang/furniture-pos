import { defineStore } from "pinia";
import { ref } from "vue";

interface AppEvent {
  type: string;
  payload?: unknown;
}

/**
 * Subscribes to the server's SSE stream. `tick` increments on every event, so
 * views can `watch` it to refresh; `lastEvent` carries the latest payload.
 */
export const useEventsStore = defineStore("events", () => {
  const tick = ref(0);
  const lastEvent = ref<AppEvent | null>(null);
  let source: EventSource | null = null;

  function connect(): void {
    if (source) return;
    source = new EventSource("/api/events", { withCredentials: true });
    source.onmessage = (msg) => {
      try {
        lastEvent.value = JSON.parse(msg.data) as AppEvent;
        tick.value += 1;
      } catch {
        /* ignore malformed events */
      }
    };
  }

  function disconnect(): void {
    source?.close();
    source = null;
  }

  return { tick, lastEvent, connect, disconnect };
});
