import { describe, it, expect } from "vitest";
import { emitAppEvent, onAppEvent } from "./bus.js";

describe("event bus", () => {
  it("delivers a published event to a subscriber", () => {
    const received: string[] = [];
    const off = onAppEvent((e) => received.push(e.type));
    emitAppEvent({ type: "sale.completed", payload: { saleId: 1 } });
    off();
    expect(received).toEqual(["sale.completed"]);
  });

  it("stops delivering after unsubscribe", () => {
    const received: string[] = [];
    const off = onAppEvent((e) => received.push(e.type));
    off();
    emitAppEvent({ type: "stock.changed" });
    expect(received).toEqual([]);
  });
});
