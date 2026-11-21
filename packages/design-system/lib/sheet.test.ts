import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import {
  attachSheetGrip,
  releaseSheetExit,
  reportSheetHeight,
} from "@repo/design-system/lib/sheet";

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

/** An element whose animations are the given ones. */
function animated(
  animations: readonly ReturnType<typeof animation>["animation"][]
) {
  const element = document.createElement("div");
  Object.defineProperty(element, "getAnimations", {
    value: () => [...animations],
  });
  return element;
}

/** A sheet with its grip as its first child, whose animations are the given ones. */
function sheetWith(
  animations: readonly ReturnType<typeof animation>["animation"][]
) {
  const sheet = animated(animations);
  const grip = document.createElement("div");
  sheet.append(grip);
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

  it("cancels the scroll-tied animations of the backdrop that leaves with the sheet, and of no part that stays", async () => {
    const tied = animation(true);
    const leaving = animation(true);
    const staying = animation(true);
    const { grip, sheet } = sheetWith([tied.animation]);
    const backdrop = animated([leaving.animation]);
    const page = animated([staying.animation]);
    document.body.append(backdrop, page);
    const release = releaseSheetExit(grip);

    backdrop.setAttribute("data-ending-style", "");
    sheet.setAttribute("data-ending-style", "");
    await observed();
    expect(tied.noted.cancelled).toBe(true);
    expect(leaving.noted.cancelled).toBe(true);
    expect(staying.noted.cancelled).toBe(false);
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

/** The callback the sheet's ResizeObserver was given, which the test calls to report a resize. */
let resized: () => void = () => undefined;

/** A ResizeObserver that keeps its callback, so that the test reports the resizes itself. */
class ResizeObserverDouble {
  constructor(callback: () => void) {
    resized = callback;
  }

  disconnect() {
    resized = () => undefined;
  }

  observe() {}
}

/** A sheet of the given height with its grip, opened from a trigger inside the sheet behind it. */
function stackedSheets(height: number) {
  const behind = document.createElement("div");
  behind.setAttribute("data-presentation", "sheet");
  const trigger = document.createElement("button");
  trigger.setAttribute("aria-controls", "front");
  behind.append(trigger);
  const front = document.createElement("div");
  front.id = "front";
  Object.defineProperty(front, "offsetHeight", { value: height });
  const grip = document.createElement("div");
  front.append(grip);
  document.body.append(behind, front);
  return { behind, grip };
}

describe("reportSheetHeight", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes the sheet's height on the sheet it was opened from, and takes it off as it leaves", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
    const { behind, grip } = stackedSheets(221);
    const leave = reportSheetHeight(grip);

    resized();
    expect(behind.style.getPropertyValue("--sheet-front-height")).toBe("221px");

    leave?.();
    expect(behind.style.getPropertyValue("--sheet-front-height")).toBe("");
  });

  it("writes nothing for a sheet that no trigger in a sheet opened", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
    const { behind, grip } = stackedSheets(221);
    behind.removeAttribute("data-presentation");
    const leave = reportSheetHeight(grip);

    resized();
    expect(behind.style.getPropertyValue("--sheet-front-height")).toBe("");
    leave?.();
  });

  it("writes nothing for a sheet without an id, which no trigger can name", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
    const { behind, grip } = stackedSheets(221);
    grip.parentElement?.removeAttribute("id");
    const leave = reportSheetHeight(grip);

    resized();
    expect(behind.style.getPropertyValue("--sheet-front-height")).toBe("");
    leave?.();
  });

  it("skips a grip outside a sheet", () => {
    expect(reportSheetHeight(null)).toBeUndefined();
  });
});

describe("attachSheetGrip", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the sheet's height and lets it go with both of the grip's refs", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
    const { behind, grip } = stackedSheets(180);
    const detach = attachSheetGrip(grip);

    resized();
    expect(behind.style.getPropertyValue("--sheet-front-height")).toBe("180px");

    detach();
    expect(behind.style.getPropertyValue("--sheet-front-height")).toBe("");
  });

  it("does nothing for a grip outside a sheet", () => {
    expect(() => attachSheetGrip(null)()).not.toThrow();
  });
});
