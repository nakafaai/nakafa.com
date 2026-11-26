import type { IsomerCompound } from "@repo/design-system/components/contents/chemistry/isomer/model";
import { evaluateIsomerGeometry } from "@repo/design-system/components/contents/chemistry/isomer/model";
import { Array as Arr, Match } from "effect";
import {
  ExtrudeGeometry,
  LatheGeometry,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from "three";

export const MODEL_ORIGIN = [-0.055, 0, 0.01] as const;
export const BROMINE_ORIGIN = [0.185, 0, 0.015] as const;

const UP = new Vector3(0, 1, 0);
const CH_LENGTH = 0.042;
const DOUBLE_BOND_OFFSET = 0.0056;

function carbonZ(compound: IsomerCompound, index: number): number {
  return Match.value(compound).pipe(
    Match.when("butane", () => (index % 2 === 0 ? -0.011 : 0.011)),
    Match.when("methylpropane", () => (index === 1 ? 0.014 : -0.011)),
    Match.when("but1ene", () =>
      Match.value(index).pipe(
        Match.when(2, () => 0.012),
        Match.when(3, () => -0.01),
        Match.orElse(() => 0)
      )
    ),
    Match.when("but2ene", () =>
      Match.value(index).pipe(
        Match.when(0, () => -0.011),
        Match.when(3, () => 0.011),
        Match.orElse(() => 0)
      )
    ),
    Match.exhaustive
  );
}

function bondPairsFor(
  compound: IsomerCompound
): readonly (readonly [number, number])[] {
  return compound === "methylpropane"
    ? [
        [0, 1],
        [1, 2],
        [1, 3],
      ]
    : [
        [0, 1],
        [1, 2],
        [2, 3],
      ];
}

function cylinderOrientation(from: Vector3, to: Vector3) {
  const delta = new Vector3().subVectors(to, from);
  const length = delta.length();
  const dir = delta.clone().normalize();
  const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5);
  const quaternion = new Quaternion().setFromUnitVectors(UP, dir);
  return {
    dir,
    length,
    midpoint: [mid.x, mid.y, mid.z] as const,
    quaternion,
  };
}

function hydrogenDirections(
  neighborDirs: readonly Vector3[],
  count: number,
  hasDoubleBond: boolean
): readonly Vector3[] {
  const sum = Arr.reduce(neighborDirs, new Vector3(0, 0, 0), (acc, dir) =>
    acc.add(dir)
  );
  const away =
    sum.lengthSq() > 1e-6
      ? sum.multiplyScalar(-1).normalize()
      : new Vector3(0, 1, 0);

  const refAxis =
    Math.abs(away.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
  const uAxis = new Vector3().crossVectors(away, refAxis).normalize();
  const vAxis = new Vector3().crossVectors(away, uAxis).normalize();

  return Match.value(count).pipe(
    Match.when(1, () => [away]),
    Match.when(2, () => {
      if (hasDoubleBond) {
        const splay = new Vector3()
          .crossVectors(away, new Vector3(0, 0, 1))
          .normalize();
        return [
          away
            .clone()
            .multiplyScalar(0.5)
            .addScaledVector(splay, 0.866)
            .normalize(),
          away
            .clone()
            .multiplyScalar(0.5)
            .addScaledVector(splay, -0.866)
            .normalize(),
        ];
      }
      const first = neighborDirs[0];
      const second = neighborDirs[1];
      const planeNormal =
        first !== undefined && second !== undefined
          ? new Vector3().crossVectors(first, second)
          : new Vector3(0, 0, 1);
      const splay =
        planeNormal.lengthSq() > 1e-4
          ? planeNormal.normalize()
          : new Vector3(0, 0, 1);
      return [
        away
          .clone()
          .multiplyScalar(0.574)
          .addScaledVector(splay, 0.819)
          .normalize(),
        away
          .clone()
          .multiplyScalar(0.574)
          .addScaledVector(splay, -0.819)
          .normalize(),
      ];
    }),
    Match.orElse(() =>
      Arr.makeBy(3, (slot) => {
        const angle = (slot / 3) * Math.PI * 2 + 0.45;
        return away
          .clone()
          .multiplyScalar(0.334)
          .addScaledVector(uAxis, Math.cos(angle) * 0.943)
          .addScaledVector(vAxis, Math.sin(angle) * 0.943)
          .normalize();
      })
    )
  );
}

/** Build full bench-scale 3D ball-and-stick coordinates for a C4 alkane/alkene isomer. */
export function buildMolecularRig(compound: IsomerCompound) {
  const geom = evaluateIsomerGeometry(compound);
  const carbons = Arr.map(geom.carbons, (atom, index) => ({
    id: atom.id,
    pos: new Vector3(
      atom.x * 0.145,
      0.044 + atom.y * 0.148,
      carbonZ(compound, index)
    ),
  }));

  const pairs = bondPairsFor(compound);
  const ccBonds = Arr.flatMap(pairs, ([aIdx, bIdx], bondIndex) => {
    const a = carbons[aIdx];
    const b = carbons[bIdx];
    if (a === undefined || b === undefined) {
      return [];
    }
    const isDouble = geom.unsaturated && bondIndex === geom.doubleBondIndex;
    const orient = cylinderOrientation(a.pos, b.pos);
    const perp = new Vector3()
      .crossVectors(orient.dir, new Vector3(0, 0, 1))
      .normalize()
      .multiplyScalar(DOUBLE_BOND_OFFSET);
    return [
      {
        id: `cc-${a.id}-${b.id}`,
        isDouble,
        length: orient.length,
        midpoint: orient.midpoint,
        perpOffset: [perp.x, perp.y, perp.z] as const,
        quaternion: orient.quaternion,
      },
    ];
  });

  const hydrogens = Arr.flatMap(carbons, (carbon, cIdx) => {
    const incident = Arr.flatMap(pairs, ([aIdx, bIdx], bondIndex) => {
      const otherIdx = Match.value(cIdx).pipe(
        Match.when(aIdx, () => bIdx),
        Match.when(bIdx, () => aIdx),
        Match.orElse(() => -1)
      );
      if (otherIdx < 0) {
        return [];
      }
      const other = carbons[otherIdx];
      if (other === undefined) {
        return [];
      }
      return [
        {
          dir: new Vector3().subVectors(other.pos, carbon.pos).normalize(),
          order: geom.unsaturated && bondIndex === geom.doubleBondIndex ? 2 : 1,
        },
      ];
    });

    const usedValence = Arr.reduce(
      incident,
      0,
      (acc, item) => acc + item.order
    );
    const hasDouble = Arr.some(incident, (item) => item.order === 2);
    const hCount = Math.max(0, 4 - usedValence);
    const dirs = hydrogenDirections(
      Arr.map(incident, (item) => item.dir),
      hCount,
      hasDouble
    );

    return Arr.map(dirs, (dir, hIdx) => {
      const hPos = carbon.pos.clone().addScaledVector(dir, CH_LENGTH);
      const orient = cylinderOrientation(carbon.pos, hPos);
      return {
        bondLength: orient.length,
        bondMidpoint: orient.midpoint,
        bondQuaternion: orient.quaternion,
        id: `h-${carbon.id}-${hIdx}`,
        position: [hPos.x, hPos.y, hPos.z] as const,
      };
    });
  });

  const rightSupportIdx = compound === "but1ene" ? 3 : 2;
  const supportTargets = [
    carbons[0]?.pos,
    carbons[rightSupportIdx]?.pos,
  ] as const;

  const supports = Arr.flatMap(supportTargets, (target, idx) => {
    if (target === undefined) {
      return [];
    }
    const base = new Vector3(idx === 0 ? -0.022 : 0.022, 0.032, 0);
    const orient = cylinderOrientation(base, target);
    return [
      {
        id: `fork-${idx}`,
        length: orient.length,
        midpoint: orient.midpoint,
        quaternion: orient.quaternion,
      },
    ];
  });

  return {
    carbons,
    ccBonds,
    hydrogens,
    supports,
    unsaturated: geom.unsaturated,
  };
}

/** Dark anodised beveled rectangular specimen plinth resting on LabBench y = 0. */
export function createPlinthGeometry() {
  const halfW = 0.122;
  const halfD = 0.056;
  const r = 0.008;
  const shape = new Shape();
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
  shape.lineTo(halfW, halfD - r);
  shape.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
  shape.lineTo(-halfW + r, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
  shape.lineTo(-halfW, -halfD + r);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);

  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    depth: 0.015,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.003, 0);
  return geo;
}

/** Turned round-bottom borosilicate bromine-water test tube (y = 0.010..0.168). */
export function createBromineTubeGeometry() {
  const outerR = 0.0165;
  const innerR = 0.0149;
  const centerY = 0.0265;
  const outerArc = Arr.makeBy(10, (index) => {
    const theta = (index / 9) * (Math.PI / 2);
    return new Vector2(
      Math.max(0.0004, Math.sin(theta) * outerR),
      centerY - Math.cos(theta) * outerR
    );
  });
  const innerArc = Arr.makeBy(10, (index) => {
    const theta = ((9 - index) / 9) * (Math.PI / 2);
    return new Vector2(
      Math.max(0.0004, Math.sin(theta) * innerR),
      centerY - Math.cos(theta) * innerR
    );
  });
  const lip = [
    new Vector2(outerR, 0.163),
    new Vector2(0.0195, 0.167),
    new Vector2(0.0185, 0.1685),
    new Vector2(innerR, 0.164),
  ];
  return new LatheGeometry([...outerArc, ...lip, ...innerArc], 48);
}

/** Turned borosilicate dropper tip positioned above the bromine test tube (local y = 0..0.068). */
export function createDropperGeometry() {
  const profile = Arr.map(
    [
      [0.0014, 0],
      [0.002, 0.01],
      [0.0048, 0.026],
      [0.0056, 0.064],
      [0.0072, 0.067],
      [0.0044, 0.064],
      [0.004, 0.025],
      [0.0009, 0.002],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 32);
}

/** Turned bromine droplet teardrop geometry. */
export function createBromineDropGeometry() {
  const profile = Arr.map(
    [
      [0.0002, -0.005],
      [0.0028, -0.0042],
      [0.0042, -0.002],
      [0.0038, 0.0008],
      [0.0022, 0.0036],
      [0.0008, 0.006],
      [0.0002, 0.0072],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 22);
}
