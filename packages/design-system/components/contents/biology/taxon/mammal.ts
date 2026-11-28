import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import { attachForm } from "@repo/design-system/components/three/organism/form";
import type {
  Loft,
  Station,
} from "@repo/design-system/components/three/organism/loft";
import {
  finBody,
  loftBody,
} from "@repo/design-system/components/three/organism/loft";
import { Array as Arr } from "effect";

/**
 * A four-legged mammal by its real structure, standing with its head
 * towards +x. `trunk` runs from the rump through the neck and skull to the
 * nose. `fore` and `hind` are the left legs from shoulder and hip down to
 * the toes, and `tail` runs from its root to its tip: in each, `wide` is
 * the breadth fore and aft and `tall` the thickness from side to side. The
 * right legs and ear mirror the left. `ear` stands at `at`, `span` long
 * towards `up`, and `chord` broad. `coat` gives every part its colour.
 */
export interface Mammal {
  readonly belly: number;
  readonly coat: {
    readonly ear: Loft["paint"];
    readonly fore: Loft["paint"];
    readonly hind: Loft["paint"];
    readonly tail: Loft["paint"];
    readonly trunk: Loft["paint"];
  };
  readonly ear: {
    readonly at: readonly [number, number, number];
    readonly chord: number;
    readonly span: number;
    readonly up: readonly [number, number, number];
  };
  readonly fore: readonly Station[];
  readonly hind: readonly Station[];
  readonly relief: Loft["relief"];
  readonly seed: number;
  readonly square: number;
  readonly tail: readonly Station[];
  readonly trunk: readonly Station[];
}

/** One section of a leg or a tail at a place: its breadth fore and aft, then its thickness. */
export function joint(
  x: number,
  y: number,
  z: number,
  wide: number,
  tall: number
): Station {
  return { centre: [x, y, z], tall, wide };
}

/** The same sections on the animal's other side. */
function across(stations: readonly Station[]): readonly Station[] {
  return Arr.map(stations, (station) => ({
    ...station,
    centre: [station.centre[0], station.centre[1], -station.centre[2]],
  }));
}

/** One leg or tail lofted over its sections, round and tapering to its toes or its tip. */
function limb(
  stations: readonly Station[],
  paint: Loft["paint"],
  seed: number,
  detail: number
): Form {
  return loftBody({
    along: faces(96, detail),
    around: faces(48, detail),
    belly: 0,
    lump: 0.04,
    paint,
    relief: (along, around) =>
      along > 0.86 ? -0.14 * Math.max(0, Math.cos(around * 8 * Math.PI)) ** 6 : 0,
    seed,
    square: 2.2,
    stations,
    up: [0, 0, 1],
  });
}

/**
 * A four-legged mammal as one body: its trunk, neck and head lofted as one
 * skin, four legs, a tail and two ears.
 */
export function mammalForms(mammal: Mammal, detail: number): readonly Form[] {
  const ear = finBody({
    along: faces(16, detail),
    around: faces(16, detail),
    chord: mammal.ear.chord,
    paint: mammal.coat.ear,
    span: mammal.ear.span,
    sweep: 0,
    thick: mammal.ear.chord * 0.3,
  });
  const [x, y, z] = mammal.ear.at;
  const [upX, upY, upZ] = mammal.ear.up;
  return [
    loftBody({
      along: faces(320, detail),
      around: faces(176, detail),
      belly: mammal.belly,
      lump: 0.03,
      paint: mammal.coat.trunk,
      relief: mammal.relief,
      seed: mammal.seed,
      square: mammal.square,
      stations: mammal.trunk,
      up: [0, 1, 0],
    }),
    limb(mammal.fore, mammal.coat.fore, mammal.seed + 1, detail),
    limb(across(mammal.fore), mammal.coat.fore, mammal.seed + 2, detail),
    limb(mammal.hind, mammal.coat.hind, mammal.seed + 3, detail),
    limb(across(mammal.hind), mammal.coat.hind, mammal.seed + 4, detail),
    limb(mammal.tail, mammal.coat.tail, mammal.seed + 5, detail),
    attachForm(ear, [x, y, z], [upX, upY, upZ], [-1, 0, 0.45]),
    attachForm(ear, [x, y, -z], [upX, upY, -upZ], [-1, 0, -0.45]),
  ];
}
