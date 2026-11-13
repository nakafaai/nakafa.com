import {
  box,
  ellipse,
  line,
  PART,
  type Shape,
  setCell,
} from "@/lib/island/tiles/shape";

/** A stem from the ground up to `top` at column `x`. */
function stem(shape: Shape, x: number, top: number) {
  line(shape, [x, 15], [x, top], PART.accent);
}

/** A pair of leaves leaving a stem at column `x`, row `y`. */
function leaves(shape: Shape, x: number, y: number) {
  line(shape, [x - 1, y], [x - 3, y - 1], PART.accent);
  line(shape, [x + 1, y + 1], [x + 3, y], PART.accent);
}

/**
 * Every plant family's drawing (ADR 0047, D11), each standing on the bottom row
 * of its tile: the petals are the body, the heart the belly, the stem and the
 * leaves the accent.
 */
export const FLORA = {
  /** A rose, a peony: a full round bloom on a leafy stem. */
  round: (shape: Shape) => {
    stem(shape, 8, 7);
    leaves(shape, 8, 11);
    ellipse(shape, 8, 5, 3.2, 2.8, PART.body);
    ellipse(shape, 8, 4.6, 1.4, 1.2, PART.mark);
    setCell(shape, 8, 4, PART.belly);
  },
  /** A tulip, a crocus, a poppy: a cup on a straight stem between two long leaves. */
  cup: (shape: Shape) => {
    stem(shape, 8, 7);
    line(shape, [7, 15], [5, 9], PART.accent);
    line(shape, [9, 15], [11, 9], PART.accent);
    box(shape, 6, 4, 10, 7, PART.body);
    setCell(shape, 7, 3, PART.body);
    setCell(shape, 9, 3, PART.body);
    setCell(shape, 8, 5, PART.belly);
  },
  /** A daisy, an aster, a marigold: a ring of petals around a bright heart. */
  daisy: (shape: Shape) => {
    stem(shape, 8, 8);
    leaves(shape, 8, 12);
    ellipse(shape, 8, 5, 3.4, 3.4, PART.body);
    ellipse(shape, 8, 5, 1.3, 1.3, PART.belly);
  },
  /** A frangipani, a jasmine: a five-pointed star on a short stem. */
  star: (shape: Shape) => {
    stem(shape, 8, 9);
    leaves(shape, 8, 12);
    line(shape, [8, 3], [8, 9], PART.body);
    line(shape, [5, 5], [11, 5], PART.body);
    line(shape, [6, 8], [10, 8], PART.body);
    ellipse(shape, 8, 6, 1.6, 1.6, PART.body);
    setCell(shape, 8, 6, PART.belly);
  },
  /** A bluebell, a snowdrop: little bells hanging from an arching stem. */
  bell: (shape: Shape) => {
    line(shape, [7, 15], [8, 6], PART.accent);
    line(shape, [8, 6], [12, 4], PART.accent);
    box(shape, 4, 7, 6, 9, PART.body);
    box(shape, 9, 6, 11, 8, PART.body);
    box(shape, 11, 9, 13, 11, PART.body);
    setCell(shape, 5, 10, PART.belly);
    setCell(shape, 12, 12, PART.belly);
  },
  /** A lavender, a lupine: a tall spike of small flowers. */
  spike: (shape: Shape) => {
    stem(shape, 8, 9);
    leaves(shape, 8, 13);
    for (let y = 2; y <= 9; y += 1) {
      box(shape, 7, y, 9, y, y % 2 === 0 ? PART.body : PART.mark);
    }
    setCell(shape, 8, 1, PART.body);
  },
  /** A hydrangea, an ixora: a head of tiny flowers over a leafy bush. */
  cluster: (shape: Shape) => {
    ellipse(shape, 8, 11.5, 5.2, 3.6, PART.accent);
    ellipse(shape, 8, 6, 4.2, 3.4, PART.body);
    setCell(shape, 6, 5, PART.belly);
    setCell(shape, 9, 4, PART.belly);
    setCell(shape, 10, 7, PART.belly);
    setCell(shape, 7, 8, PART.belly);
  },
  /** A hibiscus, a lily: a wide trumpet with its long heart showing. */
  trumpet: (shape: Shape) => {
    stem(shape, 7, 8);
    leaves(shape, 7, 12);
    ellipse(shape, 8.5, 5.5, 3.8, 3.2, PART.body);
    line(shape, [8, 6], [12, 4], PART.belly);
  },
  /** A sunflower, a hollyhock: a tall stem raising a big head. */
  tall: (shape: Shape) => {
    line(shape, [8, 15], [8, 6], PART.accent, 2);
    leaves(shape, 8, 10);
    leaves(shape, 8, 13);
    ellipse(shape, 8.5, 3.6, 3.6, 3.4, PART.body);
    ellipse(shape, 8.5, 3.6, 1.8, 1.8, PART.belly);
  },
  /** An orchid: two blooms on an arching spray over broad leaves. */
  orchid: (shape: Shape) => {
    ellipse(shape, 8, 14, 5, 1.6, PART.accent);
    line(shape, [8, 13], [10, 4], PART.accent);
    ellipse(shape, 6, 6, 2.4, 2, PART.body);
    ellipse(shape, 11, 8, 2.4, 2, PART.body);
    setCell(shape, 6, 7, PART.belly);
    setCell(shape, 11, 9, PART.belly);
  },
  /** A lotus, a water lily: a cup of petals on a round leaf. */
  lotus: (shape: Shape) => {
    ellipse(shape, 8, 14, 6.6, 1.8, PART.accent);
    ellipse(shape, 8, 10, 3.4, 2.6, PART.body);
    line(shape, [8, 7], [8, 9], PART.mark);
    setCell(shape, 8, 10, PART.belly);
  },
  /** Rice, wheat, barley: stalks bowing under their ripe heads. */
  grain: (shape: Shape) => {
    for (const x of [4, 7, 10, 12]) {
      line(shape, [x, 15], [x + 1, 6], PART.accent);
      line(shape, [x + 1, 6], [x + 2, 2], PART.body);
    }
  },
  /** Corn, sorghum, sugarcane: a tall cane with long leaves and a cob. */
  corn: (shape: Shape) => {
    line(shape, [7, 15], [7, 1], PART.accent, 2);
    line(shape, [6, 9], [2, 6], PART.accent);
    line(shape, [9, 7], [13, 4], PART.accent);
    ellipse(shape, 10, 10, 1.2, 2.6, PART.body);
    line(shape, [7, 1], [9, 0], PART.belly);
  },
  /** Cabbage, lettuce, bok choy: a low round head of leaves. */
  leafy: (shape: Shape) => {
    ellipse(shape, 8, 12.4, 5.6, 3.2, PART.accent);
    ellipse(shape, 8, 11.6, 3.4, 2.4, PART.body);
    line(shape, [8, 10], [8, 13], PART.belly);
  },
  /** Tomato, chili, beans: a vine on a stake, hung with fruit. */
  vine: (shape: Shape) => {
    line(shape, [8, 15], [8, 1], PART.dark);
    ellipse(shape, 6, 6, 2.2, 2, PART.accent);
    ellipse(shape, 10, 10, 2.2, 2, PART.accent);
    ellipse(shape, 6, 12.5, 2, 1.8, PART.accent);
    ellipse(shape, 10.5, 5.5, 1.5, 1.5, PART.body);
    ellipse(shape, 5.5, 9.5, 1.5, 1.5, PART.body);
    ellipse(shape, 11, 13, 1.5, 1.5, PART.body);
  },
  /** Carrot, cassava, ginger: a fan of leaves over a root peeking from the soil. */
  root: (shape: Shape) => {
    for (const x of [4, 6, 8, 10, 12]) {
      line(shape, [8, 12], [x, 3 + Math.abs(x - 8)], PART.accent);
    }
    ellipse(shape, 8, 13.8, 2.6, 1.8, PART.body);
    setCell(shape, 8, 13, PART.belly);
  },
  /** Coffee, tea, berries: a round bush dotted with fruit or flowers. */
  bush: (shape: Shape) => {
    ellipse(shape, 8, 9.6, 6, 5.4, PART.accent);
    box(shape, 7, 14, 9, 15, PART.dark);
    for (const [x, y] of [
      [5, 7],
      [10, 6],
      [8, 10],
      [4, 11],
      [12, 10],
    ] as const) {
      setCell(shape, x, y, PART.body);
      setCell(shape, x + 1, y, PART.belly);
    }
  },
  /** Basil, mint, lemongrass: small sprigs of leaves with flowers at their tips. */
  herb: (shape: Shape) => {
    for (const [x, top] of [
      [5, 6],
      [8, 3],
      [11, 6],
    ] as const) {
      line(shape, [8, 15], [x, top], PART.accent);
      ellipse(shape, x, top + 2, 1.4, 1, PART.body);
      setCell(shape, x, top - 1, PART.belly);
    }
  },
  /** A fern: fronds arching out from the ground, lined with leaflets. */
  fern: (shape: Shape) => {
    for (const [x, y] of [
      [2, 5],
      [8, 1],
      [14, 5],
    ] as const) {
      line(shape, [8, 15], [x, y], PART.accent);
      line(
        shape,
        [(x + 8) / 2 - 1, (y + 15) / 2],
        [(x + 8) / 2 + 1, (y + 15) / 2 - 1],
        PART.body
      );
    }
  },
  /** Tall grass, reeds, cattails: blades with seed heads. */
  grass: (shape: Shape) => {
    for (const [x, top] of [
      [3, 6],
      [6, 2],
      [9, 4],
      [12, 3],
    ] as const) {
      line(shape, [x + 1, 15], [x, top + 3], PART.accent);
      line(shape, [x, top + 2], [x, top], PART.body);
    }
  },
  /** A saguaro, a prickly pear: a ribbed column with arms and a flower on top. */
  cactus: (shape: Shape) => {
    box(shape, 7, 4, 9, 15, PART.body);
    box(shape, 4, 7, 5, 10, PART.body);
    box(shape, 5, 10, 6, 10, PART.body);
    box(shape, 11, 5, 12, 9, PART.body);
    box(shape, 10, 9, 10, 9, PART.body);
    line(shape, [8, 5], [8, 14], PART.mark);
    setCell(shape, 8, 3, PART.belly);
  },
  /** Aloe, agave, echeveria: a rosette of thick pointed leaves. */
  succulent: (shape: Shape) => {
    for (const [x, y] of [
      [3, 8],
      [6, 5],
      [10, 5],
      [13, 8],
      [8, 4],
    ] as const) {
      line(shape, [8, 14], [x, y], PART.body, 2);
      setCell(shape, x, y - 1, PART.belly);
    }
    ellipse(shape, 8, 13.6, 4, 1.6, PART.accent);
  },
  /** A banana, a pineapple, a taro: broad leaves from a short trunk, with fruit. */
  broad: (shape: Shape) => {
    box(shape, 7, 9, 8, 15, PART.accent);
    line(shape, [8, 9], [1, 4], PART.accent, 2);
    line(shape, [8, 9], [14, 3], PART.accent, 2);
    line(shape, [8, 9], [8, 1], PART.accent, 2);
    ellipse(shape, 10, 11, 1.6, 2, PART.body);
    setCell(shape, 10, 10, PART.belly);
  },
} as const;

/** The name of one plant family. */
export type Flora = keyof typeof FLORA;
