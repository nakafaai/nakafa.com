// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  type Options,
  scene,
} from "@repo/design-system/components/nina/figure";
import {
  gazeAt,
  holding,
  type Live,
  press,
  retarget,
  start,
  step,
  view,
} from "@repo/design-system/components/nina/live";
import type { Shape } from "@repo/design-system/components/nina/shape";
import { Array as Arr } from "effect";

const WHOLE: Options = { act: "santai", whole: true };
const PEEK: Options = { act: "pegang", lean: "intip" };
const TILE: Options = { lean: "kanan", mood: "halo", tile: "pop-cream" };
const FRAME = 1 / 60;
const STILL: readonly [number, number] = [0, 0];
/** The stroke that only a surprised face draws. */
const SURPRISE = "M176,44 L180,30";
/** The tip of her right arm among the numbers that her springs hold. */
const TIP = 17;
/** A draw that always gives the lowest number: her first habit comes after three seconds. */
const LOWEST = () => 0;

/** Lets `frames` frames of a sixtieth of a second go by. */
function wait(
  live: Live,
  options: Options,
  frames: number,
  draw: () => number = LOWEST
) {
  return Arr.reduce(Arr.range(1, frames), live, (held) =>
    step(held, options, FRAME, STILL, draw)
  );
}

/** Gives the numbers of a list one by one, then the last one again. */
function sequence(numbers: readonly number[]) {
  const given = { next: 0 };
  return () => {
    const number = numbers[Math.min(given.next, numbers.length - 1)];
    given.next += 1;
    return number;
  };
}

/** The path of every line of ink in a list of shapes, also inside groups. */
function paths(shapes: readonly Shape[]): readonly string[] {
  return Arr.flatMap(shapes, (shape) => {
    if (shape._tag === "g") {
      return paths(shape.children);
    }
    return shape._tag === "path" ? [shape.d] : [];
  });
}

/** Whether her face shows surprise. */
function surprised(live: Live, options: Options) {
  return Arr.contains(paths(view(live, options).shapes), SURPRISE);
}

describe("her life", () => {
  it("takes over from the still picture without a jump, in all three windows", () => {
    for (const options of [WHOLE, PEEK, TILE]) {
      expect(view(start(options, LOWEST), options)).toEqual(scene(options));
    }
  });

  it("starts on the moment and the look that the options ask for", () => {
    expect(start({ ...WHOLE, t: 2 }, LOWEST).clock).toBe(2);
    expect(start({ ...WHOLE, look: [1, 2] }, LOWEST).gaze).toEqual([1, 2]);
  });

  it("stands at ease when all of her shows and holds the edge when she looks over it", () => {
    expect(start({ whole: true }, LOWEST).act).toBe("santai");
    expect(start({ lean: "intip" }, LOWEST).act).toBe("pegang");
  });

  it("knows when she holds something, which then arrives with a pop", () => {
    expect(holding(start({ act: "membaca", whole: true }, LOWEST))).toBe(true);
    expect(holding(start(WHOLE, LOWEST))).toBe(false);
    expect(holding(press(start(WHOLE, LOWEST), WHOLE).live)).toBe(false);
  });

  it("goes on doing her act with every frame", () => {
    const begun = start(WHOLE, LOWEST);
    const live = wait(begun, WHOLE, 60);
    expect(live.clock).toBeCloseTo(begun.clock + 1, 9);
    expect(live.act).toBe("santai");
  });

  it("moves her limbs after the act without throwing one, even when frames take long", () => {
    const options: Options = { act: "melambai", whole: true };
    const slow = Arr.reduce(Arr.range(1, 200), start(options, LOWEST), (held) =>
      step(held, options, 0.05, STILL, LOWEST)
    );
    expect(Arr.every(slow.springs.x, (x) => Math.abs(x) < 400)).toBe(true);
  });

  it("changes what she does without a jump", () => {
    const before = wait(start(WHOLE, LOWEST), WHOLE, 30);
    const changed = retarget(before, "melambai");
    expect(changed.act).toBe("melambai");
    expect(changed.clock).toBe(0);
    const next = step(changed, WHOLE, FRAME, STILL, LOWEST);
    expect(Math.abs(next.springs.x[TIP] - before.springs.x[TIP])).toBeLessThan(
      5
    );
  });

  it("leaves her as she is when she is asked to do what she already does", () => {
    const live = start(WHOLE, LOWEST);
    expect(retarget(live, "santai")).toBe(live);
  });

  it("keeps the act that she goes back to while she plays another", () => {
    const playing = press(start(WHOLE, LOWEST), WHOLE).live;
    const changed = retarget(playing, "tidur");
    expect(changed.act).toBe("melambai");
    expect(changed.home).toBe("tidur");
    expect(wait(changed, WHOLE, 120).act).toBe("tidur");
  });

  it("waves, juggles and cheers on three presses, and goes back to what she was doing", () => {
    const presses = Arr.scan(Arr.range(1, 4), start(WHOLE, LOWEST), (live) =>
      wait(press(live, WHOLE).live, WHOLE, 1)
    );
    expect(Arr.map(Arr.drop(presses, 1), ({ act }) => act)).toEqual([
      "melambai",
      "main",
      "merayakan",
      "melambai",
    ]);
    const wave = press(start(WHOLE, LOWEST), WHOLE).live;
    expect(wait(wave, WHOLE, 90).act).toBe("melambai");
    expect(wait(wave, WHOLE, 110).act).toBe("santai");
  });

  it("waves, drums, and ducks behind the edge on three presses over an edge", () => {
    const first = press(start(PEEK, LOWEST), PEEK);
    const second = press(first.live, PEEK);
    const rested = wait(second.live, PEEK, 100);
    const third = press(rested, PEEK);
    expect([first.duck, second.duck, third.duck]).toEqual([false, false, true]);
    expect([first.live.act, second.live.act]).toEqual(["lambai", "ketuk"]);
    expect(press(third.live, PEEK).live.act).toBe("lambai");
    // Down behind the edge she is not yet surprised; she shows it when she comes up again.
    expect(surprised(third.live, PEEK)).toBe(false);
    expect(surprised(wait(third.live, PEEK, 30), PEEK)).toBe(true);
    expect(surprised(wait(third.live, PEEK, 110), PEEK)).toBe(false);
  });

  it("shows another face in a tile each time, for a moment", () => {
    const first = press(start(TILE, LOWEST), TILE).live;
    expect(view(first, TILE)).toEqual(scene({ ...TILE, mood: "tertawa" }));
    const second = press(wait(first, TILE, 70), TILE).live;
    expect(view(second, TILE)).toEqual(scene({ ...TILE, mood: "kedip" }));
    const third = press(wait(second, TILE, 70), TILE).live;
    expect(view(third, TILE)).toEqual(scene({ ...TILE, mood: "bangga" }));
    const over = wait(third, TILE, 70);
    expect(view(over, TILE)).toEqual(scene(TILE));
    expect(press(over, TILE).live.clicks).toBe(4);
  });

  it("ends a face that a press showed when the act that she played is over", () => {
    const played = press(start(WHOLE, LOWEST), WHOLE).live;
    const flashed = {
      ...played,
      glad: { from: 0, mood: "malu", until: 99 },
    } as const;
    expect(wait(flashed, WHOLE, 120).glad).toBeUndefined();
  });

  it("does one of her habits by herself now and then, and then goes back", () => {
    const options: Options = {
      act: "santai",
      fidget: ["melambai", "main"],
      whole: true,
    };
    const waiting = wait(start(options, LOWEST), options, 170);
    expect(waiting.act).toBe("santai");
    const habit = wait(waiting, options, 20);
    expect(habit.act).toBe("melambai");
    expect(habit.until).toBe(2.2);
    // The next one comes five seconds after she has gone back, and the draw picks it.
    const rested = wait(habit, options, 140);
    expect(rested.act).toBe("santai");
    expect(wait(rested, options, 330, sequence([0, 0.99])).act).toBe("main");
  });

  it("keeps her habits short over an edge", () => {
    const options: Options = { fidget: ["ketuk"], lean: "intip" };
    const habit = wait(start(options, LOWEST), options, 200);
    expect(habit.act).toBe("ketuk");
    expect(habit.until).toBe(1.3);
  });

  it("has no habits unless she is given some", () => {
    const live = wait(start(WHOLE, LOWEST), WHOLE, 700);
    expect(live.act).toBe("santai");
    expect(live.until).toBe(0);
  });

  it("looks toward the pointer, a little more with every frame", () => {
    const toward: readonly [number, number] = [4, 3];
    const first = step(start(WHOLE, LOWEST), WHOLE, FRAME, toward, LOWEST);
    const second = step(first, WHOLE, FRAME, toward, LOWEST);
    expect(first.gaze[0]).toBeGreaterThan(0);
    expect(second.gaze[0]).toBeGreaterThan(first.gaze[0]);
    expect(second.gaze[0]).toBeLessThan(4);
  });

  it("shows her eyes where they look, also when she is mirrored", () => {
    const mirrored: Options = { ...TILE, side: "kiri" };
    for (const options of [TILE, mirrored]) {
      const looking = step(
        start(options, LOWEST),
        options,
        FRAME,
        [4, 0],
        LOWEST
      );
      expect(view(looking, options)).toEqual(
        scene({ ...options, look: looking.gaze })
      );
    }
  });
});

describe("where she looks", () => {
  const BOX = { height: 100, left: 100, top: 100, width: 100 };

  it("is straight ahead for a pointer in the middle of her face", () => {
    expect(gazeAt([150, 140], BOX)).toEqual([0, 0]);
  });

  it("is a few units toward a pointer far away, and no more", () => {
    expect(gazeAt([5000, 5000], BOX)).toEqual([4, 3]);
    expect(gazeAt([-5000, -5000], BOX)).toEqual([-4, -3]);
  });

  it("grows with the distance of a pointer that is near", () => {
    const near = gazeAt([300, 140], BOX);
    const nearer = gazeAt([200, 140], BOX);
    expect(near[0]).toBeGreaterThan(nearer[0]);
    expect(nearer[0]).toBeGreaterThan(0);
  });
});
