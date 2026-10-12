import { describe, expect, it } from "@effect/vitest";
import { scene } from "@repo/mascot/nina/figure";
import {
  gazeAt,
  type Life,
  press,
  retarget,
  start,
  step,
  view,
} from "@repo/mascot/nina/life";
import type { Mark } from "@repo/mascot/nina/mark";
import { BEHAVIORS, type Options } from "@repo/mascot/nina/options";
import { wholeNumbers } from "@repo/mascot/nina/spring";
import { EVERY_OPTIONS } from "@repo/mascot/nina/test.fixture";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr, Formatter, Number as Num } from "effect";

const WHOLE: Options = { act: "relaxed", whole: true };
const PEEK: Options = { act: "gripping", lean: "peek" };
const TILE: Options = { lean: "right", mood: "hello", tile: "cream" };
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
  life: Life,
  options: Options,
  frames: number,
  draw: () => number = LOWEST
) {
  return Arr.reduce(Arr.range(1, frames), life, (held) =>
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
function paths(shapes: readonly Shape<Mark>[]): readonly string[] {
  return Arr.flatMap(shapes, (shape) => {
    if (shape._tag === "g") {
      return paths(shape.children);
    }
    return shape._tag === "path" ? [shape.d] : [];
  });
}

/** Whether her face shows surprise. */
function surprised(life: Life, options: Options) {
  return Arr.contains(paths(view(life, options).picture.shapes), SURPRISE);
}

describe("her life", () => {
  it("takes over from the still picture without a jump, for every set of options", () => {
    expect(EVERY_OPTIONS).toHaveLength(592);
    for (const options of EVERY_OPTIONS) {
      // A failure names the set of options in the message.
      expect(
        view(start(options, LOWEST), options).picture,
        Formatter.format(options)
      ).toEqual(scene(options));
    }
  });

  it("shows the face of an act over an edge from the very first frame, as the still picture does", () => {
    const greeting: Options = { act: "greeting", lean: "peek" };
    expect(scene(greeting)).toEqual(scene({ ...greeting, mood: "happy" }));
    expect(scene({ act: "drumming", lean: "left" })).toEqual(
      scene({ act: "drumming", lean: "left", mood: "laughing" })
    );
    expect(scene(greeting)).not.toEqual(scene({ ...greeting, mood: "hello" }));
  });

  it("starts on the moment and the look that the options ask for", () => {
    expect(start({ ...WHOLE, t: 2 }, LOWEST).clock).toBe(2);
    expect(start({ ...WHOLE, look: [1, 2] }, LOWEST).gaze).toEqual([1, 2]);
  });

  it("stands at ease when all of her shows and holds the edge when she looks over it", () => {
    expect(start({ whole: true }, LOWEST).act).toBe("relaxed");
    expect(start({ lean: "peek" }, LOWEST).act).toBe("gripping");
  });

  it("knows when she holds something, which then arrives with a pop", () => {
    const reading: Options = { act: "reading", whole: true };
    expect(view(start(reading, LOWEST), reading).holds).toBe(true);
    expect(view(start(WHOLE, LOWEST), WHOLE).holds).toBe(false);
    const waving = press(start(WHOLE, LOWEST), WHOLE).life;
    expect(view(waving, WHOLE).holds).toBe(false);
  });

  it("goes on doing her act with every frame", () => {
    const begun = start(WHOLE, LOWEST);
    const life = wait(begun, WHOLE, 60);
    expect(life.clock).toBeCloseTo(begun.clock + 1, 9);
    expect(life.act).toBe("relaxed");
  });

  it("brings her limbs to the act in a frame that took long, as small steps would, and throws none past it", () => {
    const options: Options = { act: "waving", whole: true };
    const changed = retarget(start(WHOLE, LOWEST), "waving");
    const slow = 0.3;
    const target = wholeNumbers(BEHAVIORS.waving.pose(slow));
    const gap = (life: Life) =>
      Arr.map(Arr.zip(life.springs.x, target), ([x, goal]) =>
        Math.abs(x - goal)
      );
    const after = step(changed, options, slow, STILL, LOWEST);
    // One step as long as the frame would run away: each limb would end up far
    // past the act, where small steps leave it a few percent from it.
    expect(Num.sumAll(gap(after))).toBeLessThan(Num.sumAll(gap(changed)) / 4);
    expect(Math.max(...gap(after))).toBeLessThan(Math.max(...gap(changed)));
  });

  it("changes what she does without a jump", () => {
    const before = wait(start(WHOLE, LOWEST), WHOLE, 30);
    const changed = retarget(before, "waving");
    expect(changed.act).toBe("waving");
    expect(changed.clock).toBe(0);
    const next = step(changed, WHOLE, FRAME, STILL, LOWEST);
    expect(Math.abs(next.springs.x[TIP] - before.springs.x[TIP])).toBeLessThan(
      5
    );
  });

  it("leaves her as she is when she is asked to do what she already does", () => {
    const life = start(WHOLE, LOWEST);
    expect(retarget(life, "relaxed")).toBe(life);
  });

  it("keeps the act that she goes back to while she plays another", () => {
    const playing = press(start(WHOLE, LOWEST), WHOLE).life;
    const changed = retarget(playing, "sleeping");
    expect(changed.act).toBe("waving");
    expect(changed.home).toBe("sleeping");
    expect(wait(changed, WHOLE, 120).act).toBe("sleeping");
  });

  it("waves, juggles and cheers on three presses, and goes back to what she was doing", () => {
    const presses = Arr.scan(Arr.range(1, 4), start(WHOLE, LOWEST), (life) =>
      wait(press(life, WHOLE).life, WHOLE, 1)
    );
    expect(Arr.map(Arr.drop(presses, 1), ({ act }) => act)).toEqual([
      "waving",
      "juggling",
      "cheering",
      "waving",
    ]);
    const wave = press(start(WHOLE, LOWEST), WHOLE).life;
    expect(wait(wave, WHOLE, 90).act).toBe("waving");
    expect(wait(wave, WHOLE, 110).act).toBe("relaxed");
  });

  it("waves, drums, and ducks behind the edge on three presses over an edge", () => {
    const first = press(start(PEEK, LOWEST), PEEK);
    const second = press(first.life, PEEK);
    const rested = wait(second.life, PEEK, 100);
    const third = press(rested, PEEK);
    expect([first.duck, second.duck, third.duck]).toEqual([false, false, true]);
    expect([first.life.act, second.life.act]).toEqual(["greeting", "drumming"]);
    expect(press(third.life, PEEK).life.act).toBe("greeting");
    // Down behind the edge she is not yet surprised; she shows it when she comes up again.
    expect(surprised(third.life, PEEK)).toBe(false);
    expect(surprised(wait(third.life, PEEK, 30), PEEK)).toBe(true);
    expect(surprised(wait(third.life, PEEK, 110), PEEK)).toBe(false);
  });

  it("shows another face in a tile each time, for a moment", () => {
    const first = press(start(TILE, LOWEST), TILE).life;
    expect(view(first, TILE).picture).toEqual(
      scene({ ...TILE, mood: "laughing" })
    );
    const second = press(wait(first, TILE, 70), TILE).life;
    expect(view(second, TILE).picture).toEqual(
      scene({ ...TILE, mood: "winking" })
    );
    const third = press(wait(second, TILE, 70), TILE).life;
    expect(view(third, TILE).picture).toEqual(
      scene({ ...TILE, mood: "proud" })
    );
    const over = wait(third, TILE, 70);
    expect(view(over, TILE).picture).toEqual(scene(TILE));
    expect(press(over, TILE).life.clicks).toBe(4);
  });

  it("shows the face of a press for its own time, also when an act that she still played ends before it", () => {
    // Three quick presses over an edge: she still drums when the third ducks her.
    const drumming = press(press(start(PEEK, LOWEST), PEEK).life, PEEK).life;
    const third = press(wait(drumming, PEEK, 18), PEEK);
    expect(third.duck).toBe(true);
    // The drumming is over 0.8 seconds after the third press, and she comes up surprised.
    const up = wait(third.life, PEEK, 60);
    expect(up.act).toBe("gripping");
    expect(surprised(up, PEEK)).toBe(true);
    expect(surprised(wait(third.life, PEEK, 110), PEEK)).toBe(false);
  });

  it("does one of her habits by herself now and then, and then goes back", () => {
    const options: Options = {
      act: "relaxed",
      fidget: ["waving", "juggling"],
      whole: true,
    };
    const waiting = wait(start(options, LOWEST), options, 170);
    expect(waiting.act).toBe("relaxed");
    const habit = wait(waiting, options, 20);
    expect(habit.act).toBe("waving");
    expect(habit.until).toBe(2.2);
    // The next one comes five seconds after she has gone back, and the draw picks it.
    const rested = wait(habit, options, 140);
    expect(rested.act).toBe("relaxed");
    expect(wait(rested, options, 330, sequence([0, 0.99])).act).toBe(
      "juggling"
    );
  });

  it("keeps her habits short over an edge", () => {
    const options: Options = { fidget: ["drumming"], lean: "peek" };
    const habit = wait(start(options, LOWEST), options, 200);
    expect(habit.act).toBe("drumming");
    expect(habit.until).toBe(1.3);
  });

  it("has no habits unless she is given some", () => {
    const life = wait(start(WHOLE, LOWEST), WHOLE, 700);
    expect(life.act).toBe("relaxed");
    expect(life.until).toBe(0);
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
    const mirrored: Options = { ...TILE, side: "left" };
    for (const options of [TILE, mirrored]) {
      const looking = step(
        start(options, LOWEST),
        options,
        FRAME,
        [4, 0],
        LOWEST
      );
      expect(view(looking, options).picture).toEqual(
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
