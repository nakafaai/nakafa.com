import type { Named } from "@repo/design-system/components/three/molecule/nucleic";
import {
  bondsOf,
  LinkSchema,
  NamedSchema,
} from "@repo/design-system/components/three/molecule/nucleic";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  aside,
  cross,
  dot,
  grown,
  length,
  ORIGIN,
  scale,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import { saturate } from "@repo/design-system/components/three/molecule/saturate";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Option, Schema } from "effect";

/** The sugar units a carbohydrate of the lessons is built from. */
export const UnitSchema = Schema.Literals(["fructose", "galactose", "glucose"]);
export type Unit = typeof UnitSchema.Type;

/** Which way the hydroxyl of a sugar's anomeric carbon points: alpha below the ring of a D sugar, beta above. */
const AnomerSchema = Schema.Literals(["alpha", "beta"]);
type Anomer = typeof AnomerSchema.Type;

/** The hydroxyl oxygens another sugar can join. */
const HostSchema = Schema.Literals(["O2", "O4", "O6"]);
type Host = typeof HostSchema.Type;

/**
 * One sugar joined to a sugar already there: its kind and anomer, the unit
 * it joins by that unit's number and the oxygen it takes there, and the two
 * torsions of the glycosidic bond in degrees. `phi` turns about the bond
 * from the anomeric carbon to the bridging oxygen, measured from the ring
 * oxygen to the host's carbon; `psi` turns about the bond from that oxygen
 * to the host's carbon, measured from the anomeric carbon to the host's
 * next ring atom down (carbon 3 at oxygen 4, carbon 5 at oxygen 6, the ring
 * oxygen at a fructose's oxygen 2).
 */
export const JoinSchema = Schema.Struct({
  anomer: AnomerSchema,
  host: Schema.Finite,
  oxygen: HostSchema,
  phi: Schema.Finite,
  psi: Schema.Finite,
  unit: UnitSchema,
});
export type Join = typeof JoinSchema.Type;

/** Bond lengths in angstrom, and the C-O-C angle of a glycosidic bond in radians. */
const C_C = 1.52;
const C_O = 1.43;
const BRIDGE = (117 * Math.PI) / 180;

/** How far a chair's atoms stand above and below its mean plane, and how far an equatorial bond tilts back toward it. */
const CHAIR = 0.25;
const TILT = 0.34;

/** A furanose ring: the distance of its atoms from its middle, and how far its envelope puckers. */
const FURANOSE = 1.27;
const PUCKER = 0.22;

/** The share of a furanose substituent's bond that points out of the ring, and up or down from it. */
const LEAN = [0.55, 0.835] as const;

/** The names of the carbons a ring can hold. */
const RING = /^C[1-5]$/u;

/** One sugar before it is joined: its named atoms, its bonds, and its anomeric oxygen, anomeric carbon and ring oxygen. */
const ResidueSchema = Schema.Struct({
  anomeric: Schema.Tuple([Schema.String, Schema.String, Schema.String]),
  atoms: Schema.Array(NamedSchema),
  links: Schema.Array(LinkSchema),
});
type Residue = typeof ResidueSchema.Type;

/** The carbon that carries each host oxygen, and the ring atom `psi` is measured to. */
const HOSTS: Record<Host, readonly [string, string]> = {
  O2: ["C2", "O5"],
  O4: ["C4", "C3"],
  O6: ["C6", "C5"],
};

/** A named carbon or oxygen at a point. */
function atom(name: string, [x, y, z]: Point): Named {
  return [name, name.startsWith("C") ? "C" : "O", x, y, z];
}

/** Where the atom called `name` of a residue stands; the origin when it lacks one. */
function place(residue: Residue, name: string): Point {
  return Arr.reduce(residue.atoms, ORIGIN, (found, each) =>
    each[0] === name ? [each[2], each[3], each[4]] : found
  );
}

/** The direction of a bond that makes the tetrahedral angle with the bond back along `stem`, leaning toward `toward`. */
function branch(stem: Point, toward: Point): Point {
  return add(scale(stem, 1 / 3), scale(aside(stem, toward), Math.sqrt(8) / 3));
}

/**
 * A pyranose in its 4C1 chair, the ring numbered clockwise seen from above
 * with carbon 4 up and carbon 1 down, every ring bond 1.52 angstrom: glucose
 * with every hydroxyl and its sixth carbon equatorial, or galactose, whose
 * fourth hydroxyl stands axial. The alpha anomer's first hydroxyl is axial,
 * the beta anomer's equatorial.
 */
function pyranoseOf(kind: "galactose" | "glucose", anomer: Anomer): Residue {
  const radius = Math.sqrt(C_C ** 2 - (CHAIR * 2) ** 2);
  const seat = (index: number) => {
    const angle = (-index / 6) * Math.PI * 2;
    const up = index % 2 === 0 ? -1 : 1;
    const at: Point = [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      up * CHAIR,
    ];
    const level = unit([Math.cos(angle), Math.sin(angle), -up * TILT]);
    const axial: Point = [0, 0, up];
    return { at, axial, level };
  };
  const hydroxyl = (index: number, upright: boolean) =>
    add(
      seat(index).at,
      scale(upright ? seat(index).axial : seat(index).level, C_O)
    );
  const c6 = add(seat(4).at, scale(seat(4).level, C_C));
  return {
    anomeric: ["O1", "C1", "O5"],
    atoms: [
      ...Arr.makeBy(5, (index) => atom(`C${index + 1}`, seat(index).at)),
      atom("O5", seat(5).at),
      atom("O1", hydroxyl(0, anomer === "alpha")),
      atom("O2", hydroxyl(1, false)),
      atom("O3", hydroxyl(2, false)),
      atom("O4", hydroxyl(3, kind === "galactose")),
      atom("C6", c6),
      atom("O6", add(c6, scale(unit([0.2, -0.5, 0.84]), C_O))),
    ],
    links: [
      ["C1", "C2", 1],
      ["C2", "C3", 1],
      ["C3", "C4", 1],
      ["C4", "C5", 1],
      ["C5", "O5", 1],
      ["O5", "C1", 1],
      ["C1", "O1", 1],
      ["C2", "O2", 1],
      ["C3", "O3", 1],
      ["C4", "O4", 1],
      ["C5", "C6", 1],
      ["C6", "O6", 1],
    ],
  };
}

/**
 * Beta-D-fructofuranose, the five-membered ring fructose takes in sucrose:
 * carbons 2 to 5 and the ring oxygen, numbered clockwise seen from above, in
 * an envelope. The anomeric carbon 2 carries its hydroxyl above the ring and
 * carbon 1 below; the hydroxyl of carbon 3 is above, that of carbon 4 below
 * and carbon 6 above.
 */
function furanoseOf(): Residue {
  const seat = (index: number) => {
    const angle = (-index / 5) * Math.PI * 2;
    const out: Point = [Math.cos(angle), Math.sin(angle), 0];
    const at: Point = [
      out[0] * FURANOSE,
      out[1] * FURANOSE,
      PUCKER * Math.cos(((index * 4) / 5) * Math.PI + 2.2),
    ];
    const arm = (side: 1 | -1) =>
      unit([out[0] * LEAN[0], out[1] * LEAN[0], side * LEAN[1]]);
    return { arm, at, out };
  };
  const c1 = add(seat(0).at, scale(seat(0).arm(-1), C_C));
  const c6 = add(seat(3).at, scale(seat(3).arm(1), C_C));
  return {
    anomeric: ["O2", "C2", "O5"],
    atoms: [
      ...Arr.makeBy(4, (index) => atom(`C${index + 2}`, seat(index).at)),
      atom("O5", seat(4).at),
      atom("O2", add(seat(0).at, scale(seat(0).arm(1), C_O))),
      atom("C1", c1),
      atom("O1", add(c1, scale(branch(seat(0).arm(-1), seat(0).out), C_O))),
      atom("O3", add(seat(1).at, scale(seat(1).arm(1), C_O))),
      atom("O4", add(seat(2).at, scale(seat(2).arm(-1), C_O))),
      atom("C6", c6),
      atom("O6", add(c6, scale(branch(seat(3).arm(1), seat(3).out), C_O))),
    ],
    links: [
      ["C2", "C3", 1],
      ["C3", "C4", 1],
      ["C4", "C5", 1],
      ["C5", "O5", 1],
      ["O5", "C2", 1],
      ["C2", "O2", 1],
      ["C2", "C1", 1],
      ["C1", "O1", 1],
      ["C3", "O3", 1],
      ["C4", "O4", 1],
      ["C5", "C6", 1],
      ["C6", "O6", 1],
    ],
  };
}

/** One free sugar: a pyranose of the given anomer, or fructose as its beta furanose. */
function residueOf(kind: Unit, anomer: Anomer): Residue {
  return kind === "fructose" ? furanoseOf() : pyranoseOf(kind, anomer);
}

/** The three axes of the frame that stands on three points: along the first two, and at right angles to the plane of all three. */
function axesOf(first: Point, second: Point, third: Point) {
  const along = unit(sub(second, first));
  const normal = unit(cross(along, sub(third, first)));
  return [along, cross(normal, along), normal] as const;
}

/**
 * A residue moved as a rigid body so that its anomeric oxygen, anomeric
 * carbon and ring oxygen land on the three given points.
 */
function moved(
  residue: Residue,
  onto: readonly [Point, Point, Point]
): Residue {
  const [oxygen, carbon, ring] = residue.anomeric;
  const start = place(residue, oxygen);
  const from = axesOf(start, place(residue, carbon), place(residue, ring));
  const to = axesOf(onto[0], onto[1], onto[2]);
  return {
    ...residue,
    atoms: Arr.map(residue.atoms, ([name, element, x, y, z]) => {
      const offset = sub([x, y, z], start);
      const [px, py, pz] = Arr.reduce(
        Arr.zip(from, to),
        onto[0],
        (sum, [axis, turned]) => add(sum, scale(turned, dot(offset, axis)))
      );
      return [name, element, px, py, pz] as const;
    }),
  };
}

/**
 * The sugar of `join` standing where its glycosidic bond puts it: its
 * anomeric carbon 1.43 angstrom from the host's oxygen at the bridge angle,
 * turned by `psi` and `phi`, with its own anomeric oxygen on the host's. A
 * join that names a unit not yet there leaves the sugar where it was built.
 */
function joined(residues: readonly Residue[], join: Join): Residue {
  const free = residueOf(join.unit, join.anomer);
  return Option.match(Arr.get(residues, join.host), {
    onNone: () => free,
    onSome: (host) => {
      const [carrier, next] = HOSTS[join.oxygen];
      const [oxygen, carbon, ring] = free.anomeric;
      const bridge = place(host, join.oxygen);
      const anomeric = grown(
        bridge,
        place(host, carrier),
        place(host, next),
        C_O,
        BRIDGE,
        (join.psi * Math.PI) / 180
      );
      const apex = place(free, carbon);
      const toRing = sub(place(free, ring), apex);
      const ringAt = grown(
        anomeric,
        bridge,
        place(host, carrier),
        length(toRing),
        Math.acos(dot(unit(toRing), unit(sub(place(free, oxygen), apex)))),
        (join.phi * Math.PI) / 180
      );
      return moved(free, [bridge, anomeric, ringAt]);
    },
  });
}

/** The atoms and bonds of residues as one molecule with every hydrogen, the atoms of residue `n` as part `first + n`. */
function builtOf(
  residues: readonly Residue[],
  bridges: readonly Readonly<{ from: number; to: number }>[],
  first: number
): Molecule {
  return saturate({
    atoms: Arr.flatMap(residues, (residue, index) =>
      Arr.map(residue.atoms, ([, element, x, y, z]) => ({
        at: [x, y, z] as const,
        element,
        part: first + index,
        spine: false,
      }))
    ),
    bonds: [
      ...Arr.flatMap(
        Arr.zip(residues, offsetsOf(residues)),
        ([residue, offset]) => bondsOf(residue.atoms, residue.links, offset)
      ),
      ...Arr.map(bridges, (bridge) => ({ ...bridge, order: 1 as const })),
    ],
    ties: [],
    traces: [],
  });
}

/** Where the atoms of each residue start in the molecule built of them all. */
function offsetsOf(residues: readonly Residue[]) {
  return Arr.scan(residues, 0, (sum, residue) => sum + residue.atoms.length);
}

/** Where the atom called `name` of a seated residue is in the molecule. */
function indexIn([residue, offset]: readonly [Residue, number], name: string) {
  return Option.map(
    Arr.findFirstIndex(residue.atoms, (each) => each[0] === name),
    (index) => offset + index
  );
}

/** The middle of the ring of a residue. */
function middleOf(residue: Residue): Point {
  const ring = Arr.filter(
    residue.atoms,
    (each) =>
      each[0] === "O5" ||
      (RING.test(each[0]) && (residue.anomeric[1] === "C1" || each[0] !== "C1"))
  );
  return scale(
    Arr.reduce(ring, ORIGIN, (sum, each) =>
      add(sum, [each[2], each[3], each[4]])
    ),
    1 / ring.length
  );
}

/**
 * A carbohydrate as its real atoms, hydrogens included: the sugar `root`
 * and every sugar joined after it, each by a glycosidic bond to a unit
 * already there. Unit `n` is part `n` of the molecule, the root part 0, and
 * a bridging oxygen belongs to the unit that kept it. `bridges` gives each
 * join's oxygen, `centers` the middle of each unit's ring, and `free` each
 * unit as the whole sugar hydrolysis would release, standing where it does
 * in the carbohydrate, as part `n` too.
 */
export function glycanOf(
  root: Readonly<{ anomer: Anomer; unit: Unit }>,
  joins: readonly Join[]
) {
  const whole = Arr.reduce(
    joins,
    Arr.of(residueOf(root.unit, root.anomer)),
    (placed, join) => Arr.append(placed, joined(placed, join))
  );
  const residues = Arr.map(whole, (residue, index) =>
    index === 0
      ? residue
      : {
          ...residue,
          atoms: Arr.filter(
            residue.atoms,
            (each) => each[0] !== residue.anomeric[0]
          ),
        }
  );
  const seated = Arr.zip(residues, offsetsOf(residues));
  const bonds = Arr.flatMap(joins, (join, index) =>
    Option.toArray(
      Option.all({
        from: Option.flatMap(Arr.get(seated, join.host), (host) =>
          indexIn(host, join.oxygen)
        ),
        to: Option.flatMap(Arr.get(seated, index + 1), (seat) =>
          indexIn(seat, seat[0].anomeric[1])
        ),
      })
    )
  );
  return {
    bridges: Arr.flatMap(joins, (join) =>
      Arr.map(Option.toArray(Arr.get(whole, join.host)), (host) =>
        place(host, join.oxygen)
      )
    ),
    centers: Arr.map(whole, middleOf),
    free: Arr.map(whole, (residue, index) => builtOf([residue], [], index)),
    molecule: builtOf(residues, bonds, 0),
  };
}
