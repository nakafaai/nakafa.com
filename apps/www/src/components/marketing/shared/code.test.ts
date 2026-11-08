import { describe, expect, it } from "@effect/vitest";
import { PRESSED_ATTRIBUTE } from "@repo/design-system/hooks/press";
import { Effect, Exit, Function as Fn, Option } from "effect";
import type { ComponentType } from "react";
import {
  holdsEarlyPress,
  laterCode,
  openLaterCode,
  readWaiting,
} from "@/components/marketing/shared/code";

const Section: ComponentType<object> = Fn.constNull;

describe("the code of a later section", () => {
  it.effect("loads once, and only when the section is opened", () =>
    Effect.gen(function* () {
      const load = vi.fn(() => Promise.resolve(Section));
      const code = laterCode(load);
      const waiting = readWaiting(code);
      yield* Effect.yieldNow;
      expect(load).not.toHaveBeenCalled();

      yield* Effect.promise(() => openLaterCode(code));
      yield* Effect.promise(() => openLaterCode(code));

      expect(yield* Effect.promise(() => waiting)).toBe(Section);
      expect(readWaiting(code)).toBe(waiting);
      expect(load).toHaveBeenCalledTimes(1);
      expect(code.component).toStrictEqual(Option.some(Section));
    })
  );

  it.live("leaves its boundary waiting when the code fails to load", () =>
    Effect.gen(function* () {
      const code = laterCode<object>(() => Promise.reject(new Error("gone")));
      const waiting = readWaiting(code);

      const opened = yield* Effect.exit(
        Effect.tryPromise(() => openLaterCode(code))
      );

      expect(Exit.isFailure(opened)).toBe(true);
      expect(
        yield* Effect.promise(() => waiting).pipe(
          Effect.timeoutOption("20 millis")
        )
      ).toStrictEqual(Option.none());
    })
  );
});

describe("a later section's early press", () => {
  it("is held by a section whose control was pressed before React took the page over", () => {
    const box = document.createElement("div");
    box.innerHTML = `<section><form><button ${PRESSED_ATTRIBUTE}="">Attach files</button></form></section>`;

    expect(holdsEarlyPress(box)).toBe(true);
  });

  it("is not held by a section nobody pressed", () => {
    const box = document.createElement("div");
    box.innerHTML =
      "<section><form><button>Attach files</button></form></section>";

    expect(holdsEarlyPress(box)).toBe(false);
  });
});
