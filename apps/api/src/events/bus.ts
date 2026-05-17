import { EventEmitter } from "node:events";

export type AppEventType = "sale.completed" | "stock.changed" | "delivery.updated";

export interface AppEvent {
  type: AppEventType;
  payload?: unknown;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0); // one listener per connected SSE client

/** Publishes an application event to every SSE subscriber. */
export function emitAppEvent(event: AppEvent): void {
  emitter.emit("event", event);
}

/** Subscribes to application events; returns an unsubscribe function. */
export function onAppEvent(fn: (event: AppEvent) => void): () => void {
  emitter.on("event", fn);
  return () => emitter.off("event", fn);
}
