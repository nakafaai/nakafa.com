import { Schema } from "effect";
import {
  box,
  ellipse,
  line,
  PART,
  type Shape,
  setCell,
} from "@/lib/island/tiles/shape";

/** What sets one species apart within its family: its ears, tail, horns, and a mane or crest. */
export const Traits = Schema.Struct({
  crest: Schema.Boolean,
  ears: Schema.Literals(["point", "round", "long", "none"]),
  horns: Schema.Literals(["none", "horns", "antlers", "tusks"]),
  tail: Schema.Literals(["long", "bushy", "short", "none"]),
});
export type Traits = typeof Traits.Type;

/** Ears on a head centered at (x, y) with radius `r`. */
function earsOf(shape: Shape, x: number, y: number, r: number, traits: Traits) {
  const top = y - r;
  if (traits.ears === "point") {
    line(shape, [x - 1, top], [x - 1, top - 1], PART.body);
    line(shape, [x + 1, top], [x + 1, top - 1], PART.body);
  } else if (traits.ears === "round") {
    setCell(shape, x - 1.5, top, PART.body);
    setCell(shape, x + 1.5, top, PART.body);
  } else if (traits.ears === "long") {
    line(shape, [x - 0.5, top], [x - 1, top - 3], PART.body);
    line(shape, [x + 1, top], [x + 0.5, top - 3], PART.belly);
  }
}

/** Horns, antlers or tusks on a head centered at (x, y) with radius `r`. */
function hornsOf(
  shape: Shape,
  x: number,
  y: number,
  r: number,
  traits: Traits
) {
  if (traits.horns === "horns") {
    line(shape, [x - 1, y - r], [x - 2, y - r - 2], PART.pale);
  } else if (traits.horns === "antlers") {
    line(shape, [x - 1, y - r], [x - 2, y - r - 3], PART.dark);
    line(shape, [x - 2, y - r - 2], [x, y - r - 3], PART.dark);
  } else if (traits.horns === "tusks") {
    line(shape, [x + r, y + 1], [x + r + 1, y], PART.pale);
  }
}

/** A tail leaving the body's back at (x, y). */
function tailOf(shape: Shape, x: number, y: number, traits: Traits) {
  if (traits.tail === "long") {
    line(shape, [x, y], [x - 2, y - 3], PART.body);
  } else if (traits.tail === "bushy") {
    ellipse(shape, x - 1.5, y - 2, 1.6, 2.2, PART.body);
  } else if (traits.tail === "short") {
    setCell(shape, x - 0.5, y, PART.body);
  }
}

/** Legs from the body's underside at `top` down to the ground. */
function legsOf(shape: Shape, xs: readonly number[], top: number, width = 1) {
  for (const x of xs) {
    box(shape, x, top, x + width - 1, 15, PART.leg);
  }
}

/** A head with its eye looking forward, its ears, horns and a snout. */
function headOf(
  shape: Shape,
  x: number,
  y: number,
  r: number,
  traits: Traits,
  snout = 1
) {
  ellipse(shape, x, y, r, r, PART.body);
  box(shape, x + r - 1, y, x + r - 1 + snout, y + 1, PART.belly);
  earsOf(shape, x, y, r, traits);
  hornsOf(shape, x, y, r, traits);
  setCell(shape, x + r * 0.3, y - r * 0.35, PART.eye);
}

/** Every family's drawing, each facing east with its feet on the bottom row. */
export const FAMILIES = {
  /** A cat, a fox, a dog: a long low body and a round head. */
  small: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7, 10.5, 4.6, 2.4, PART.body);
    ellipse(shape, 7.5, 11.8, 3.4, 1.0, PART.belly);
    legsOf(shape, [4, 6, 9, 10], 12);
    tailOf(shape, 2.5, 9.5, traits);
    headOf(shape, 12, 7.5, 2.4, traits);
  },
  /** A mouse, a squirrel, a hamster: small and low, with a big head. */
  rodent: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7, 12.5, 4, 2.4, PART.body);
    ellipse(shape, 7.5, 13.8, 3, 0.9, PART.belly);
    legsOf(shape, [5, 9], 14);
    tailOf(shape, 3, 12, traits);
    headOf(shape, 11, 11, 2.3, traits, 0);
  },
  /** A deer, a goat, a horse, a cow: a deep body on tall legs and a neck. */
  hoof: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7, 8.5, 5, 2.7, PART.body);
    ellipse(shape, 7, 10, 3.6, 0.9, PART.belly);
    legsOf(shape, [3, 5, 9, 11], 10);
    line(shape, [10.5, 7], [12, 4.5], PART.body, 2);
    if (traits.crest) {
      line(shape, [10, 6], [11.5, 3.5], PART.accent);
    }
    tailOf(shape, 2.2, 7.5, traits);
    headOf(shape, 13, 4, 1.8, traits, 1);
  },
  /** A bear, a pig, a boar, a rhino: a heavy body on short thick legs. */
  heavy: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7.2, 9.8, 5.6, 3.4, PART.body);
    ellipse(shape, 7.2, 12, 4.4, 1.2, PART.belly);
    legsOf(shape, [3, 9], 12, 2);
    legsOf(shape, [5, 11], 13, 2);
    tailOf(shape, 1.8, 8.5, traits);
    headOf(shape, 12.6, 9, 2.6, traits, 1);
  },
  /** A giraffe, a camel, a llama: a long neck raising the head high. */
  tall: (shape: Shape, traits: Traits) => {
    ellipse(shape, 6, 9, 4, 2.4, PART.body);
    legsOf(shape, [3, 5, 7, 8], 11);
    line(shape, [8.5, 8], [11.5, 3], PART.body, 2);
    tailOf(shape, 2.2, 8.5, traits);
    headOf(shape, 12.6, 2.6, 1.6, traits, 1);
  },
  /** An elephant: a great body, big ears and a trunk to the ground. */
  elephant: (shape: Shape, traits: Traits) => {
    ellipse(shape, 6.8, 8, 5.4, 4, PART.body);
    legsOf(shape, [3, 5, 8, 10], 11, 2);
    ellipse(shape, 12, 6.5, 2.8, 2.8, PART.body);
    ellipse(shape, 10.8, 7, 1.6, 2.4, PART.belly);
    line(shape, [14, 7], [14.5, 14], PART.body, 1);
    setCell(shape, 12.8, 5.4, PART.eye);
    hornsOf(shape, 13, 9, 1, traits);
  },
  /** A monkey, an orangutan: sitting up, with long arms. */
  primate: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7.5, 11, 3.2, 3.6, PART.body);
    ellipse(shape, 8, 11.8, 2, 2.2, PART.belly);
    line(shape, [10, 9], [11.5, 14], PART.body, 1);
    line(shape, [5, 9], [4, 14], PART.body, 1);
    box(shape, 6, 14, 9, 15, PART.dark);
    tailOf(shape, 4.2, 13.5, traits);
    ellipse(shape, 8, 5.5, 2.6, 2.6, PART.body);
    ellipse(shape, 8.8, 6.2, 1.4, 1.4, PART.belly);
    setCell(shape, 9, 5, PART.eye);
    earsOf(shape, 8, 5.5, 2.6, traits);
  },
  /** A sparrow, a pigeon, a kingfisher: a round bird on two thin legs. */
  songbird: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7.5, 11, 3.6, 2.6, PART.body);
    ellipse(shape, 8.5, 12, 2.2, 1.2, PART.belly);
    ellipse(shape, 6.5, 10.5, 2.4, 1.4, PART.mark);
    line(shape, [4, 10], [2, 8.5], PART.body, 1);
    legsOf(shape, [7, 9], 13.5);
    ellipse(shape, 10.8, 8.5, 2, 2, PART.body);
    box(shape, 12.6, 8.5, 13.6, 9, PART.accent);
    setCell(shape, 11.2, 8, PART.eye);
    if (traits.crest) {
      line(shape, [10, 6.5], [9, 5], PART.accent);
    }
  },
  /** A duck, a goose, a swan: a long low body on the water and a neck. */
  waterbird: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7, 11.5, 5, 2.6, PART.body);
    ellipse(shape, 6.2, 11, 3, 1.4, PART.mark);
    line(shape, [11, 10], [11.6, traits.crest ? 4 : 6.5], PART.body, 2);
    ellipse(shape, 12.4, traits.crest ? 4 : 6.4, 1.7, 1.5, PART.body);
    box(
      shape,
      13.6,
      traits.crest ? 4 : 6.4,
      14.8,
      traits.crest ? 4.4 : 6.8,
      PART.accent
    );
    setCell(shape, 12.6, traits.crest ? 3.6 : 6, PART.eye);
    legsOf(shape, [7], 14);
  },
  /** A heron, a flamingo, a stork: tall on long legs, with a long neck and bill. */
  wader: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7, 7.5, 3.6, 2, PART.body);
    ellipse(shape, 6, 7.2, 2.4, 1.2, PART.mark);
    line(shape, [9.5, 6.5], [10.5, 2.8], PART.body, 1);
    ellipse(shape, 11, 2.4, 1.4, 1.3, PART.body);
    line(shape, [12.2, 2.6], [14.6, 3.6], PART.accent);
    setCell(shape, 11.2, 2, PART.eye);
    box(shape, 6, 9, 6, 15, PART.dark);
    box(shape, 8, 9, 8, 15, PART.dark);
    if (traits.crest) {
      line(shape, [10.4, 1.4], [8.8, 0.6], PART.accent);
    }
  },
  /** An owl, an eagle, a parrot, a hornbill: perched upright on a branch. */
  perch: (shape: Shape, traits: Traits) => {
    ellipse(shape, 8, 9.5, 3.2, 4, PART.body);
    ellipse(shape, 8.6, 10.5, 2, 2.6, PART.belly);
    ellipse(shape, 6.4, 9.6, 1.8, 3, PART.mark);
    ellipse(shape, 8.6, 4.6, 2.5, 2.4, PART.body);
    box(shape, 10.6, 4.8, 11.6, 5.8, PART.accent);
    setCell(shape, 9.4, 4, PART.eye);
    line(shape, [6, 13], [5, 15], PART.body, 2);
    box(shape, 4, 15, 12, 15, PART.dark);
    if (traits.crest) {
      line(shape, [7.6, 2.4], [7, 0.8], PART.accent);
      line(shape, [9.6, 2.4], [10.2, 0.8], PART.accent);
    }
  },
  /** A fish seen from the side: its body, its fins, and its tail. */
  fish: (shape: Shape, traits: Traits) => {
    ellipse(shape, 8.5, 8, 5.2, traits.crest ? 4 : 3, PART.body);
    ellipse(shape, 9, 9.6, 3.6, 1.2, PART.belly);
    line(shape, [3.4, 8], [1, 5], PART.accent, 1);
    line(shape, [3.4, 8], [1, 11], PART.accent, 1);
    line(
      shape,
      [7, traits.crest ? 4 : 5],
      [9.5, traits.crest ? 2 : 3.6],
      PART.accent
    );
    setCell(shape, 12, 7, PART.eye);
  },
  /** An eel, a barracuda, a needlefish: long and narrow. */
  eel: (shape: Shape, _traits: Traits) => {
    ellipse(shape, 8, 8, 7.4, 1.6, PART.body);
    line(shape, [1, 8], [0, 6.5], PART.accent);
    line(shape, [4, 6.6], [11, 6.6], PART.accent);
    setCell(shape, 13.6, 7.4, PART.eye);
  },
  /** A ray or a flatfish: wide and flat with a thin tail. */
  ray: (shape: Shape, _traits: Traits) => {
    ellipse(shape, 9, 8, 5, 4.4, PART.body);
    ellipse(shape, 9.5, 8.8, 3, 2.2, PART.belly);
    line(shape, [4, 8], [0, 9], PART.accent);
    setCell(shape, 11.6, 6.4, PART.eye);
    setCell(shape, 11.6, 9.6, PART.eye);
  },
  /** A turtle or a tortoise: a shell over four short legs. */
  turtle: (shape: Shape, _traits: Traits) => {
    ellipse(shape, 7.4, 11.4, 4.8, 3, PART.body);
    box(shape, 3, 12, 12, 12, PART.mark);
    ellipse(shape, 13, 12, 1.6, 1.3, PART.belly);
    setCell(shape, 13.4, 11.4, PART.eye);
    legsOf(shape, [4, 10], 14, 2);
  },
  /** A lizard, a gecko, a monitor, a crocodile: low, long, with a long tail. */
  lizard: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7.6, 12.6, 4, 1.6, PART.body);
    ellipse(shape, 12.6, 12, 2, 1.4, PART.body);
    line(shape, [4, 12.6], [0, 14], PART.body, 1);
    legsOf(shape, [5, 10], 14);
    setCell(shape, 13, 11.4, PART.eye);
    if (traits.crest) {
      line(shape, [5, 11], [10, 11], PART.accent);
    }
  },
  /** A snake: coils along the ground with its head raised. */
  snake: (shape: Shape, traits: Traits) => {
    line(shape, [1, 14], [5, 12], PART.body, 2);
    line(shape, [5, 12], [9, 14], PART.body, 2);
    line(shape, [9, 14], [11, 10], PART.body, 2);
    ellipse(shape, 12.4, 9, 1.8, traits.crest ? 2.6 : 1.4, PART.body);
    setCell(shape, 13, 8.6, PART.eye);
    setCell(shape, 14.4, 9.4, PART.accent);
  },
  /** A frog or a toad: crouched, with eyes on top of its head. */
  frog: (shape: Shape, _traits: Traits) => {
    ellipse(shape, 8, 12, 4.4, 2.8, PART.body);
    ellipse(shape, 8.6, 13.2, 3, 1.3, PART.belly);
    ellipse(shape, 10, 9.2, 1.2, 1.2, PART.body);
    setCell(shape, 10.2, 9, PART.eye);
    line(shape, [4, 13], [2.6, 15], PART.body, 2);
    box(shape, 9, 15, 11, 15, PART.dark);
  },
  /** A butterfly or a moth: two pairs of patterned wings around a thin body. */
  butterfly: (shape: Shape, _traits: Traits) => {
    ellipse(shape, 5.4, 5.6, 3.4, 3.6, PART.body);
    ellipse(shape, 10.6, 5.6, 3.4, 3.6, PART.body);
    ellipse(shape, 5.8, 11, 2.6, 2.8, PART.accent);
    ellipse(shape, 10.2, 11, 2.6, 2.8, PART.accent);
    box(shape, 7.5, 3, 8, 13, PART.dark);
    setCell(shape, 4.5, 5, PART.mark);
    setCell(shape, 11.5, 5, PART.mark);
  },
  /** A beetle, a ladybird: a domed shell on six short legs. */
  beetle: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7.4, 11.4, 4.6, 3.4, PART.body);
    ellipse(shape, 12.4, 12, 1.6, 1.4, PART.dark);
    legsOf(shape, [4, 7, 10], 14);
    if (traits.horns !== "none") {
      line(shape, [13, 11], [15, 8], PART.dark);
    }
  },
  /** A bee, a wasp, a dragonfly: a striped body with clear wings above it. */
  bee: (shape: Shape, traits: Traits) => {
    ellipse(shape, 7.6, 10, traits.tail === "long" ? 6.4 : 4, 2, PART.body);
    ellipse(shape, 7, 6.4, 3, 2, PART.pale);
    ellipse(shape, 12, 9.4, 1.6, 1.6, PART.dark);
    setCell(shape, 12.4, 9, PART.eye);
  },
  /** A crab: a wide shell on legs, raising two claws. */
  crab: (shape: Shape, _traits: Traits) => {
    ellipse(shape, 8, 11.6, 4.8, 2.6, PART.body);
    ellipse(shape, 2.6, 8.4, 1.6, 1.4, PART.accent);
    ellipse(shape, 13.4, 8.4, 1.6, 1.4, PART.accent);
    line(shape, [4, 10.6], [3, 9.6], PART.body);
    line(shape, [12, 10.6], [13, 9.6], PART.body);
    legsOf(shape, [4, 6, 10, 12], 14);
    setCell(shape, 7, 9.6, PART.eye);
    setCell(shape, 9, 9.6, PART.eye);
  },
  /** A snail: a round shell on a soft foot, with feelers. */
  snail: (shape: Shape, _traits: Traits) => {
    ellipse(shape, 6.6, 10.6, 3.6, 3.6, PART.body);
    ellipse(shape, 6.6, 10.6, 1.6, 1.6, PART.mark);
    box(shape, 3, 14, 13, 15, PART.belly);
    line(shape, [12, 14], [13, 11], PART.belly);
    setCell(shape, 13.4, 10.4, PART.eye);
  },
} as const;

/** The name of one family. */
export type Family = keyof typeof FAMILIES;
