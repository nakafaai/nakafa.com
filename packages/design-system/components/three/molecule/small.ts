import type { Element } from "@repo/design-system/components/three/molecule/element";
import type {
  Link,
  Named,
} from "@repo/design-system/components/three/molecule/nucleic";
import {
  bondsOf,
  partOf,
  residueOf,
} from "@repo/design-system/components/three/molecule/nucleic";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  aside,
  cross,
  dot,
  ORIGIN,
  scale,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import { saturate } from "@repo/design-system/components/three/molecule/saturate";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { WATER } from "@repo/design-system/components/three/molecule/water";
import { Array as Arr, Match, Schema } from "effect";

/** The small molecules of metabolism a model can be asked for by name. */
const SmallSchema = Schema.Literals([
  "atp",
  "carbonDioxide",
  "glucose",
  "nadph",
  "oxygen",
  "water",
]);
export type Small = typeof SmallSchema.Type;

/** Bond lengths in angstrom: phosphorus to oxygen, and carbon to oxygen, nitrogen and carbon. */
const P_O = 1.6;
const P_O_END = 1.5;
const C_O = 1.43;
const C_C = 1.52;

/** The P-O-P angle of a phosphoanhydride is 130 degrees, so each phosphate turns 50 degrees from the last; a phosphate ester's C-O-P angle is 120. */
const ANHYDRIDE = (50 * Math.PI) / 180;
const ESTER = (60 * Math.PI) / 180;

/** A molecule of named atoms and the bonds between them, with every hydrogen added; `part` gives each atom's part by its name. */
export function built(
  atoms: readonly Named[],
  links: readonly Link[],
  part: (name: string) => number
): Molecule {
  return saturate({
    atoms: Arr.map(atoms, ([name, element, x, y, z]) => ({
      at: [x, y, z] as const,
      element,
      part: part(name),
      spine: false,
    })),
    bonds: bondsOf(atoms, links, 0),
    ties: [],
    traces: [],
  });
}

/** Where the atom called `name` stands; the origin when the list lacks it. */
export function at(atoms: readonly Named[], name: string): Point {
  return Arr.reduce(atoms, ORIGIN, (found, atom) =>
    atom[0] === name ? [atom[2], atom[3], atom[4]] : found
  );
}

/** A named atom at a point. */
export function named(name: string, element: Element, [x, y, z]: Point): Named {
  return [name, element, x, y, z];
}

/**
 * A phosphate group hung on the oxygen at `anchor`, itself bonded to the
 * atom at `from`: the phosphorus, turned `bend` radians off the line through
 * the two, and its three other oxygens at the corners of its tetrahedron.
 * The atoms take `tag` in their names, and the first oxygen carries the
 * double bond.
 */
function phosphateOn(anchor: Point, from: Point, bend: number, tag: string) {
  const along = unit(sub(anchor, from));
  const lean = aside(along, [0.3, 0.5, 0.8]);
  const heading = unit(
    add(scale(along, Math.cos(bend)), scale(lean, Math.sin(bend)))
  );
  const side = aside(heading, lean);
  const third = cross(heading, side);
  const p = add(anchor, scale(heading, P_O));
  const oxygens = Arr.makeBy(3, (corner) => {
    const turn = (corner / 3) * Math.PI * 2;
    return named(
      `O${corner + 1}${tag}`,
      "O",
      add(
        p,
        scale(
          add(
            scale(heading, 1 / 3),
            scale(
              add(scale(side, Math.cos(turn)), scale(third, Math.sin(turn))),
              Math.sqrt(8) / 3
            )
          ),
          corner === 2 ? P_O : P_O_END
        )
      )
    );
  });
  return {
    atoms: [named(`P${tag}`, "P", p), ...oxygens],
    last: at(oxygens, `O3${tag}`),
    links: [
      [`P${tag}`, `O1${tag}`, 2],
      [`P${tag}`, `O2${tag}`, 1],
      [`P${tag}`, `O3${tag}`, 1],
    ] as const satisfies readonly Link[],
    p,
  };
}

/**
 * Adenosine triphosphate, the cell's energy carrier: adenine on ribose, and
 * on the ribose's 5' carbon a chain of three phosphates, each joined to the
 * next through one oxygen. Its phosphates are part 0, its ribose part 1 and
 * its adenine part 2.
 */
function atpOf(): Molecule {
  const core = residueOf("A", "ribose", true);
  const beta = phosphateOn(
    at(core.atoms, "OP3"),
    at(core.atoms, "P"),
    ANHYDRIDE,
    "B"
  );
  const gamma = phosphateOn(beta.last, beta.p, ANHYDRIDE, "G");
  return built(
    [...core.atoms, ...beta.atoms, ...gamma.atoms],
    [
      ...core.links,
      ...beta.links,
      ...gamma.links,
      ["OP3", "PB", 1],
      ["O3B", "PG", 1],
    ],
    partOf
  );
}

/** The atoms of the second half of NADPH carry this mark after their names. */
const SECOND = "N";

/**
 * The nicotinamide of NADPH on its ribose, in the frame of a pyrimidine
 * nucleotide: the reduced ring, a 1,4-dihydropyridine whose fourth carbon
 * carries the two hydrogens it gives away, with its amide on the third.
 */
function nicotinamideOf() {
  const sugar = residueOf("C", "ribose", false);
  const kept = Arr.filter(
    sugar.atoms,
    ([name]) => name !== "O2" && name !== "N4" && name !== "N3"
  );
  const ring = Arr.filter(
    kept,
    ([name]) => !(name.endsWith("'") || name.startsWith("O")) && name !== "P"
  );
  const middle = scale(
    Arr.reduce(
      [...Arr.map(ring, ([name]) => at(kept, name)), at(sugar.atoms, "N3")],
      ORIGIN,
      add
    ),
    1 / (ring.length + 1)
  );
  const c3 = at(sugar.atoms, "N3");
  const out = unit(sub(c3, middle));
  const turned = (angle: number): Point => [
    out[0] * Math.cos(angle) - out[1] * Math.sin(angle),
    out[0] * Math.sin(angle) + out[1] * Math.cos(angle),
    0,
  ];
  const c7 = add(c3, scale(out, C_C));
  const atoms: readonly Named[] = [
    ...kept,
    named("C3", "C", c3),
    named("C7", "C", c7),
    named("O7", "O", add(c7, scale(turned(Math.PI / 3), 1.23))),
    named("N7", "N", add(c7, scale(turned(-Math.PI / 3), 1.33))),
  ];
  const links: readonly Link[] = [
    ...Arr.filter(
      sugar.links,
      ([from, to]) =>
        !(
          Arr.contains(["O2", "N3", "N4", "OP3"], from) ||
          Arr.contains(["O2", "N3", "N4", "OP3"], to) ||
          (from === "C5" && to === "C6")
        )
    ),
    ["C2", "C3", 2],
    ["C3", "C4", 1],
    ["C5", "C6", 2],
    ["C3", "C7", 1],
    ["C7", "O7", 2],
    ["C7", "N7", 1],
  ];
  return { atoms, links };
}

/**
 * NADPH, the carrier of the light reactions' electrons: an adenine
 * nucleotide and a nicotinamide nucleotide joined through their phosphates,
 * with a third phosphate on the 2' oxygen of the adenine's ribose. The
 * second nucleotide is the first's frame turned half a turn about a line
 * through the oxygen the two phosphates share, which sets their P-O-P angle
 * to 130 degrees. Phosphates are part 0, riboses part 1, adenine part 2 and
 * nicotinamide part 3.
 */
function nadphOf(): Molecule {
  const first = residueOf("A", "ribose", true);
  const shared = at(first.atoms, "OP3");
  const toward = unit(sub(at(first.atoms, "P"), shared));
  const axis = unit(
    add(
      scale(toward, Math.cos((65 * Math.PI) / 180)),
      scale(aside(toward, [0, 0, 1]), Math.sin((65 * Math.PI) / 180))
    )
  );
  const second = nicotinamideOf();
  const extra = phosphateOn(
    at(first.atoms, "O2'"),
    at(first.atoms, "C2'"),
    ESTER,
    "X"
  );
  return built(
    [
      ...first.atoms,
      ...extra.atoms,
      ...Arr.map(second.atoms, ([name, element, x, y, z]) => {
        const from = sub([x, y, z], shared);
        return named(
          `${name}${SECOND}`,
          element,
          add(shared, sub(scale(axis, 2 * dot(axis, from)), from))
        );
      }),
    ],
    [
      ...first.links,
      ...extra.links,
      ["O2'", "PX", 1],
      ["OP3", `P${SECOND}`, 1],
      ...Arr.map(
        second.links,
        ([from, to, order]): Link => [
          `${from}${SECOND}`,
          `${to}${SECOND}`,
          order,
        ]
      ),
    ],
    (name) => {
      if (!name.endsWith(SECOND) || name === "PX") {
        return partOf(name);
      }
      const own = name.slice(0, -1);
      return partOf(own) === 2 ? 3 : partOf(own);
    }
  );
}

/** The six atoms of a pyranose ring in order, and whether each stands above or below the ring's mean plane in the chair. */
const RING = ["C1", "C2", "C3", "C4", "C5", "O5"] as const;

/**
 * Glucose as it is in water and in starch: beta-D-glucopyranose in its 4C1
 * chair, the ring numbered clockwise seen from above with carbon 4 up and
 * carbon 1 down, and every hydroxyl and the sixth carbon equatorial. The
 * chair is the ideal one, every ring bond 1.52 angstrom.
 */
function glucoseOf(): Molecule {
  const radius = Math.sqrt(C_C ** 2 - 0.5 ** 2);
  const seat = (index: number) => {
    const angle = (-index / 6) * Math.PI * 2;
    const up = index % 2 === 0 ? -1 : 1;
    return {
      out: unit([Math.cos(angle), Math.sin(angle), -up * 0.34]),
      place: [
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        up * 0.25,
      ] as const,
    };
  };
  const ring = Arr.map(RING, (name, index) => ({ name, ...seat(index) }));
  const c6 = add(seat(4).place, scale(seat(4).out, C_C));
  return built(
    [
      ...Arr.map(ring, (atom) =>
        named(atom.name, atom.name === "O5" ? "O" : "C", atom.place)
      ),
      ...Arr.makeBy(4, (index) =>
        named(
          `O${index + 1}`,
          "O",
          add(seat(index).place, scale(seat(index).out, C_O))
        )
      ),
      named("C6", "C", c6),
      named("O6", "O", add(c6, scale(unit([0.2, -0.5, 0.84]), C_O))),
    ],
    [
      ...Arr.map(
        Arr.zip(RING, [...Arr.drop(RING, 1), RING[0]]),
        ([from, to]): Link => [from, to, 1]
      ),
      ...Arr.makeBy(4, (index): Link => [`C${index + 1}`, `O${index + 1}`, 1]),
      ["C5", "C6", 1],
      ["C6", "O6", 1],
    ],
    () => 0
  );
}

/** A molecule of three atoms or fewer, given as its atoms and the order of the bonds from the first atom to each other one. */
function simple(atoms: readonly Named[], order: 1 | 2): Molecule {
  return {
    atoms: Arr.map(atoms, ([, element, x, y, z]) => ({
      at: [x, y, z] as const,
      element,
      part: 0,
      spine: false,
    })),
    bonds: Arr.makeBy(atoms.length - 1, (index) => ({
      from: 0,
      order,
      to: index + 1,
    })),
    ties: [],
    traces: [],
  };
}

/**
 * The small molecule called `name` as its real atoms and bonds, hydrogens
 * included: water, oxygen (O=O, 1.208 angstrom), carbon dioxide (O=C=O,
 * 1.163 angstrom), glucose, ATP and NADPH.
 */
export function smallOf(name: Small): Molecule {
  return Match.value(name).pipe(
    Match.when("water", () =>
      simple(
        Arr.map(WATER, ([element, x, y, z], index) =>
          named(`${element}${index}`, element, [x, y, z])
        ),
        1
      )
    ),
    Match.when("oxygen", () =>
      simple(
        [named("O1", "O", [-0.604, 0, 0]), named("O2", "O", [0.604, 0, 0])],
        2
      )
    ),
    Match.when("carbonDioxide", () =>
      simple(
        [
          named("C", "C", [0, 0, 0]),
          named("O1", "O", [-1.163, 0, 0]),
          named("O2", "O", [1.163, 0, 0]),
        ],
        2
      )
    ),
    Match.when("glucose", glucoseOf),
    Match.when("atp", atpOf),
    Match.when("nadph", nadphOf),
    Match.exhaustive
  );
}
