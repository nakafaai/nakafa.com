import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { createScatter, type Place } from "@repo/design-system/lib/toy/scatter";
import {
  define,
  FRAME,
  leave,
  stagePage,
  wait,
} from "@repo/design-system/test/toy";
import { Array as Arr, MutableList, Option } from "effect";

/** The page the layer covers: as wide as a test sets, with its corner at (10, 20) in the window. */
const page = { width: 800 };
let observers: ResizeObserverStub[] = [];
let fontsArrive: () => void = () => undefined;

class ResizeObserverStub {
  disconnected = false;
  callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    observers = Arr.append(observers, this);
  }

  observe() {
    // The stub watches nothing: the tests call the callback when the page changes.
  }

  disconnect() {
    this.disconnected = true;
  }
}

function rect(left: number, top: number, width: number, height: number) {
  return () => new DOMRect(left, top, width, height);
}

/** The page changed: the observer tells the layer, and the frame that follows places the toys. */
function changed() {
  Arr.forEach(observers, (observer) => observer.callback());
  wait(FRAME);
}

beforeEach(() => {
  page.width = 800;
  observers = [];
  stagePage();
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  const ready = new Promise<void>((resolve) => {
    fontsArrive = () => resolve();
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  leave();
});

/** A layer over the page, a scatter on it, and a way to add toys with a place. */
function scatter() {
  const layer = document.createElement("div");
  document.body.replaceChildren(layer);
  Object.defineProperty(layer, "clientWidth", { get: () => page.width });
  define(layer, {
    getBoundingClientRect: rect(10, 20, 800, 2000),
    offsetLeft: 10,
    offsetParent: null,
    offsetTop: 20,
  });
  const rest = vi.fn();
  const placed = createScatter(rest);
  const toy = (place: Place) => {
    const el = document.createElement("div");
    layer.append(el);
    placed.add(el, place);
    return el;
  };
  return { layer, placed, rest, toy };
}

const anywhere: Place = () => Option.some({ x: 1, y: 2 });

describe("placing toys", () => {
  it("puts a toy where its place function says, measured from the corner of the layer", () => {
    const { layer, placed, toy } = scatter();
    const target = document.createElement("div");
    define(target, {
      offsetHeight: 60,
      offsetLeft: 110,
      offsetParent: null,
      offsetTop: 220,
      offsetWidth: 50,
    });
    const el = toy((_, box) => {
      const found = box(target);
      expect(found).toEqual({
        bottom: 260,
        height: 60,
        left: 100,
        right: 150,
        top: 200,
        width: 50,
      });
      return Option.some({
        size: 40.4,
        x: found.left + 4.4,
        y: found.bottom + 0.6,
      });
    });
    placed.attach(layer);
    wait(FRAME);
    expect(el.hidden).toBe(false);
    expect(el.style.left).toBe("104px");
    expect(el.style.top).toBe("261px");
    expect(el.style.getPropertyValue("--toy")).toBe("40px");
  });

  it("measures a part by its layout, so a part that rises into view by a transform never moves its toys", () => {
    const { layer, placed, toy } = scatter();
    const card = document.createElement("div");
    define(card, {
      clientLeft: 1,
      clientTop: 1,
      offsetLeft: 40,
      offsetParent: null,
      offsetTop: 300,
    });
    const part = document.createElement("div");
    define(part, {
      // On the screen the part still sits 24 px lower, mid rise.
      getBoundingClientRect: rect(51, 335, 30, 40),
      offsetHeight: 40,
      offsetLeft: 10,
      offsetParent: card,
      offsetTop: 10,
      offsetWidth: 30,
    });
    const el = toy((_, box) => {
      const found = box(part);
      return Option.some({ x: found.left, y: found.top });
    });
    placed.attach(layer);
    wait(FRAME);
    expect(el.style.left).toBe("41px");
    expect(el.style.top).toBe("291px");
  });

  it("measures an SVG part on the screen, since it has no layout offsets", () => {
    const { layer, placed, toy } = scatter();
    const part = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    define(part, { getBoundingClientRect: rect(60, 70, 30, 40) });
    const el = toy((_, box) => {
      const found = box(part);
      return Option.some({ x: found.right, y: found.bottom });
    });
    placed.attach(layer);
    wait(FRAME);
    expect(el.style.left).toBe("80px");
    expect(el.style.top).toBe("90px");
  });

  it("keeps a toy inside the layer, so a place near an edge never makes the page scroll sideways", () => {
    const { layer, placed, toy } = scatter();
    const drawn = toy(() => Option.some({ x: 780, y: 0 }));
    Object.defineProperty(drawn, "offsetWidth", { get: () => 56 });
    const sized = toy(() => Option.some({ size: 40, x: 790, y: 0 }));
    const left = toy(() => Option.some({ x: -12, y: 0 }));
    placed.attach(layer);
    wait(FRAME);
    expect(drawn.style.left).toBe("744px");
    expect(sized.style.left).toBe("760px");
    expect(left.style.left).toBe("0px");
  });

  it("asks for the width of the layer and leaves the size alone when a place gives none", () => {
    const { layer, placed, toy } = scatter();
    const place = vi.fn(anywhere);
    const el = toy(place);
    placed.attach(layer);
    wait(FRAME);
    expect(place).toHaveBeenCalledWith(800, expect.any(Function));
    expect(el.style.getPropertyValue("--toy")).toBe("");
  });

  it("hides a toy that has no room and shows it again when there is", () => {
    const { layer, placed, toy } = scatter();
    let room = false;
    const el = toy(() => (room ? Option.some({ x: 5, y: 6 }) : Option.none()));
    placed.attach(layer);
    wait(FRAME);
    expect(el.hidden).toBe(true);
    room = true;
    changed();
    expect(el.hidden).toBe(false);
    expect(el.style.left).toBe("5px");
  });

  it("reads every place before it moves any toy", () => {
    const { layer, placed, toy } = scatter();
    let left = 10;
    const first = toy(() => Option.some({ x: left, y: 0 }));
    const seen = MutableList.make<string>();
    toy(() => {
      MutableList.append(seen, first.style.left);
      return Option.some({ x: 0, y: 0 });
    });
    placed.attach(layer);
    wait(FRAME);
    left = 111;
    changed();
    // The second place was read while the first toy had not yet moved.
    expect(MutableList.toArray(seen)).toEqual(["", "10px"]);
    expect(first.style.left).toBe("111px");
  });
});

describe("a new width", () => {
  it("sends every toy back to its place, hidden ones too, and only once per width", () => {
    const { layer, placed, rest, toy } = scatter();
    const shown = toy(anywhere);
    const hidden = toy(() => Option.none());
    placed.attach(layer);
    wait(FRAME);
    // The first width is no change of page.
    expect(rest).not.toHaveBeenCalled();
    changed();
    expect(rest).not.toHaveBeenCalled();
    page.width = 600;
    changed();
    expect(rest.mock.calls).toEqual([[shown], [hidden]]);
    changed();
    expect(rest).toHaveBeenCalledTimes(2);
  });

  it("is placed at the next frame, however many times the page was resized", () => {
    const { layer, placed, toy } = scatter();
    const place = vi.fn(anywhere);
    toy(place);
    placed.attach(layer);
    wait(FRAME);
    place.mockClear();
    page.width = 640;
    Arr.forEach(observers, (observer) => {
      observer.callback();
      observer.callback();
      observer.callback();
    });
    expect(place).not.toHaveBeenCalled();
    wait(FRAME);
    expect(place).toHaveBeenCalledTimes(1);
    expect(place).toHaveBeenCalledWith(640, expect.any(Function));
  });
});

describe("toys that come and go", () => {
  it("places a toy that is added later at the next frame, and leaves one that is taken out", () => {
    const { layer, placed, toy } = scatter();
    placed.attach(layer);
    wait(FRAME);
    const place = vi.fn(anywhere);
    const el = document.createElement("div");
    layer.append(el);
    const remove = placed.add(el, place);
    wait(FRAME);
    expect(el.style.left).toBe("1px");
    remove();
    place.mockClear();
    toy(anywhere);
    wait(FRAME);
    expect(place).not.toHaveBeenCalled();
  });

  it("places toys only on a layer, so a toy added before one waits for it", () => {
    const { layer, placed, toy } = scatter();
    const place = vi.fn(anywhere);
    const el = toy(place);
    wait(2 * FRAME);
    expect(place).not.toHaveBeenCalled();
    expect(el.style.left).toBe("");
    placed.attach(layer);
    wait(FRAME);
    expect(place).toHaveBeenCalledTimes(1);
  });
});

describe("the fonts", () => {
  it("place toys again when they arrive", async () => {
    const { layer, placed, toy } = scatter();
    const place = vi.fn(anywhere);
    toy(place);
    placed.attach(layer);
    wait(FRAME);
    place.mockClear();
    fontsArrive();
    await document.fonts.ready;
    wait(FRAME);
    expect(place).toHaveBeenCalledTimes(1);
  });
});

describe("stopping", () => {
  it("stops watching the layer and drops a pass that was asked for", () => {
    const { layer, placed, toy } = scatter();
    const place = vi.fn(anywhere);
    toy(place);
    const stop = placed.attach(layer);
    stop();
    expect(Arr.every(observers, (observer) => observer.disconnected)).toBe(
      true
    );
    expect(vi.getTimerCount()).toBe(0);
    wait(2 * FRAME);
    expect(place).not.toHaveBeenCalled();
    changed();
    expect(place).not.toHaveBeenCalled();
  });
});
