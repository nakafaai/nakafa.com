// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "@effect/vitest";
import { ActSchema } from "@repo/design-system/components/nina/act";
import { EdgeSchema } from "@repo/design-system/components/nina/edge";
import { MoodSchema } from "@repo/design-system/components/nina/face";
import {
  type Options,
  scene,
} from "@repo/design-system/components/nina/figure";
import { DIGESTS } from "@repo/design-system/components/nina/fixture";
import type { Shape } from "@repo/design-system/components/nina/shape";
import { Array as Arr, Option, Order, Record as Rec, Result } from "effect";

/** One drawing, named by what it shows, with the options that ask for it. */
type Case = readonly [id: string, options: Options];

const SIDES = ["kanan", "kiri"] as const;
const TIMES = [0, 0.35, 1.1, 2.9, 3.7, 6.2, 9.4];
const EDGE_TIMES = [0, 0.4, 1.3];
const LEANS = ["kanan", "kiri", "tengah"] as const;
const LOOK = [2.5, -1.5] as const;
const CAPITAL = /[A-Z]/gu;
const HOOKS: Record<string, string> = {
  eye: "data-eye",
  limb: "data-limb",
  part: "data-part",
};

function drawing(id: string, options: Options): Case {
  return [id, options];
}

/** The cases for all of her: every act, both sides, at several moments and at its best. */
const WHOLE = Arr.flatMap(ActSchema.literals, (act) =>
  Arr.flatMap(SIDES, (side) => [
    drawing(`whole.${act}.${side}.still`, { act, side, whole: true }),
    ...Arr.map(TIMES, (t) =>
      drawing(`whole.${act}.${side}.${t}`, { act, side, t, whole: true })
    ),
  ])
);

/** The cases for her faces in a tile and over an edge, in every way she stands. */
const WINDOW = Arr.flatMap(MoodSchema.literals, (mood) =>
  Arr.flatMap(SIDES, (side) => [
    ...Arr.map(LEANS, (lean) =>
      drawing(`window.${mood}.${lean}.${side}`, {
        lean,
        mood,
        side,
        tile: "pop-cream",
      })
    ),
    drawing(`window.${mood}.intip.${side}`, {
      lean: "intip",
      mood,
      side,
      tile: "pop-yellow",
    }),
  ])
);

/** The cases for what she does over an edge. */
const EDGE = Arr.flatMap(EdgeSchema.literals, (act) =>
  Arr.flatMap(SIDES, (side) => [
    drawing(`edge.${act}.${side}.still`, { act, lean: "intip", side }),
    ...Arr.map(EDGE_TIMES, (t) =>
      drawing(`edge.${act}.${side}.${t}`, { act, lean: "intip", side, t })
    ),
  ])
);

/** The cases for a mood, a look and a bare window. */
const DETAIL = [
  drawing("whole.default", { whole: true }),
  drawing("whole.santai.kanan.mood.malu", {
    act: "santai",
    mood: "malu",
    whole: true,
  }),
  drawing("whole.santai.kanan.look", {
    act: "santai",
    look: LOOK,
    whole: true,
  }),
  drawing("whole.santai.kiri.look", {
    act: "santai",
    look: LOOK,
    side: "kiri",
    whole: true,
  }),
  drawing("whole.membaca.kanan.look", {
    act: "membaca",
    look: LOOK,
    t: 1.1,
    whole: true,
  }),
  drawing("whole.main.kiri.look", {
    act: "main",
    look: LOOK,
    side: "kiri",
    t: 2.9,
    whole: true,
  }),
  drawing("window.halo.kanan.look", {
    lean: "kanan",
    look: LOOK,
    tile: "pop-blue",
  }),
  drawing("window.halo.kiri.look", {
    lean: "kiri",
    look: LOOK,
    side: "kiri",
    tile: "pop-green",
  }),
  drawing("window.halo.tengah.bare", { lean: "tengah" }),
  drawing("window.halo.default", {}),
  drawing("edge.pegang.kanan.mood.tanya", {
    lean: "intip",
    mood: "tanya",
    t: 0.7,
  }),
  drawing("edge.lambai.kanan.look", {
    act: "lambai",
    lean: "intip",
    look: LOOK,
    t: 0.3,
  }),
];

const CASES = [...WHOLE, ...WINDOW, ...EDGE, ...DETAIL];

/** The name that a drawn property has in SVG. */
function attributeName(name: string) {
  return Option.getOrElse(Rec.get(HOOKS, name), () =>
    name.replace(CAPITAL, (letter) => `-${letter.toLowerCase()}`)
  );
}

/** What a shape sets, in order of name, the way the prototype's markup sets it. */
function attributes(
  values: Readonly<Record<string, boolean | number | string | undefined>>
) {
  return Arr.join(
    Arr.map(
      Arr.sortBy(
        Order.mapInput(
          Order.String,
          ([name]: readonly [string, string]) => name
        )
      )(
        Arr.filterMap(Rec.toEntries(values), ([name, value]) =>
          value === undefined
            ? Result.failVoid
            : Result.succeed([attributeName(name), `${value}`] as const)
        )
      ),
      ([name, value]) => `${name}=${value}`
    ),
    ";"
  );
}

/** Shapes in the form that the digests were made from; an empty group draws nothing. */
function canonical(shapes: readonly Shape[]): string {
  return Arr.join(
    Arr.filterMap(shapes, (shape) => {
      if (shape._tag === "g") {
        const children = canonical(shape.children);
        return children === ""
          ? Result.failVoid
          : Result.succeed(
              `g(${attributes({ part: shape.part, transform: shape.transform })})[${children}]`
            );
      }
      const { _tag, ...rest } = shape;
      return Result.succeed(`${_tag}(${attributes(rest)})[]`);
    }),
    ","
  );
}

/** The digest of one drawing: its window and its shapes. */
function digestOf(options: Options) {
  const { box, shapes } = scene(options);
  return createHash("sha256")
    .update(`box=${box[0]},${box[1]},${box[2]},${box[3]}|${canonical(shapes)}`)
    .digest("hex")
    .slice(0, 16);
}

describe("the drawing of Nina", () => {
  it("is asked for exactly the cases that the prototype was asked", () => {
    expect(
      Arr.sort(
        Arr.map(CASES, ([id]) => id),
        Order.String
      )
    ).toEqual(Arr.sort(Rec.keys(DIGESTS), Order.String));
  });

  it("draws what the prototype draws, for every act, face, lean and side", () => {
    for (const [id, options] of CASES) {
      expect(digestOf(options), id).toBe(DIGESTS[id]);
    }
  });
});
