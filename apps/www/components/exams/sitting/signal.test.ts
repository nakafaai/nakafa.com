import { describe, expect, it } from "@effect/vitest";
import { HashMap, Option } from "effect";
import {
  leftFullscreen,
  SIGNAL_INTERVAL_MS,
  takeSignal,
  visibilitySignal,
} from "@/components/exams/sitting/signal";

describe("takeSignal", () => {
  it("sends the first signal of a kind and records its time", () => {
    const [send, gate] = takeSignal(HashMap.empty(), "blur", 5000);

    expect(send).toBe(true);
    expect(Option.getOrUndefined(HashMap.get(gate, "blur"))).toBe(5000);
  });

  it("drops a second signal of the same kind within a second", () => {
    const [, first] = takeSignal(HashMap.empty(), "exit", 5000);
    const [send, second] = takeSignal(
      first,
      "exit",
      5000 + SIGNAL_INTERVAL_MS - 1
    );

    expect(send).toBe(false);
    expect(second).toBe(first);
  });

  it("sends a signal of the same kind again once a second has passed", () => {
    const [, first] = takeSignal(HashMap.empty(), "exit", 5000);
    const [send] = takeSignal(first, "exit", 5000 + SIGNAL_INTERVAL_MS);

    expect(send).toBe(true);
  });

  it("gates each kind on its own, so a copy does not hold back a paste", () => {
    const [, copied] = takeSignal(HashMap.empty(), "copy", 5000);
    const [send] = takeSignal(copied, "paste", 5001);

    expect(send).toBe(true);
  });
});

describe("visibilitySignal", () => {
  it("sends an exit when the page is hidden", () => {
    expect(visibilitySignal("hidden")).toBe("exit");
  });

  it("sends a return when the page shows again", () => {
    expect(visibilitySignal("visible")).toBe("return");
  });
});

describe("leftFullscreen", () => {
  it("is true only when the page was in full screen and is not now", () => {
    expect(leftFullscreen(true, false)).toBe(true);
    expect(leftFullscreen(true, true)).toBe(false);
    expect(leftFullscreen(false, false)).toBe(false);
    expect(leftFullscreen(false, true)).toBe(false);
  });
});
