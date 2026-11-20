import { afterEach, describe, expect, it } from "@effect/vitest";
import { releaseSheetExit } from "@repo/design-system/lib/sheet";

afterEach(() => {
  document.body.replaceChildren();
});

/** An animation on the document's clock, or one tied to a scroll when `scroll` is set, that notes its cancel. */
function animation(scroll: boolean) {
  const noted = { cancelled: false };
  const timeline = scroll ? { source: document.body } : {};
  return {
    animation: {
      cancel: () => {
        noted.cancelled = true;
      },
      timeline,
    },
    noted,
  };
}

/** A sheet with its grip as its first child, whose animations are the given ones. */
function sheetWith(
  animations: readonly ReturnType<typeof animation>["animation"][]
) {
  const sheet = document.createElement("div");
  const grip = document.createElement("div");
  sheet.append(grip);
  Object.defineProperty(sheet, "getAnimations", {
    value: () => [...animations],
  });
  document.body.append(sheet);
  return { grip, sheet };
}

/** Lets the sheet's observer read the attributes written before it: a mutation queues its notice as a microtask. */
const observed = () => Promise.resolve();

describe("releaseSheetExit", () => {
  it("cancels the scroll-tied animations of a sheet as its exit starts, and keeps the ones on the clock", async () => {
    const tied = animation(true);
    const clock = animation(false);
    const { grip, sheet } = sheetWith([tied.animation, clock.animation]);
    const release = releaseSheetExit(grip);

    sheet.setAttribute("data-open", "");
    await observed();
    expect(tied.noted.cancelled).toBe(false);

    sheet.setAttribute("data-ending-style", "");
    await observed();
    expect(tied.noted.cancelled).toBe(true);
    expect(clock.noted.cancelled).toBe(false);
    release?.();
  });

  it("leaves the sheet alone once its grip has gone", async () => {
    const tied = animation(true);
    const { grip, sheet } = sheetWith([tied.animation]);
    const release = releaseSheetExit(grip);

    release?.();
    sheet.setAttribute("data-ending-style", "");
    await observed();
    expect(tied.noted.cancelled).toBe(false);
  });

  it("watches nothing for a grip outside a sheet, or none", () => {
    expect(releaseSheetExit(document.createElement("div"))).toBeUndefined();
    expect(releaseSheetExit(null)).toBeUndefined();
  });

  it("does nothing when the exit's attribute is taken away", async () => {
    const tied = animation(true);
    const { grip, sheet } = sheetWith([tied.animation]);
    sheet.setAttribute("data-ending-style", "");
    const release = releaseSheetExit(grip);

    sheet.removeAttribute("data-ending-style");
    await observed();
    expect(tied.noted.cancelled).toBe(false);
    release?.();
  });
});
