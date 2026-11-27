import { useLump } from "@repo/design-system/components/contents/biology/cell/organic";
import type { Seat } from "@repo/design-system/components/contents/biology/chromosome/coil";
import {
  octamerOf,
  pathOf,
  seated,
  strandsOf,
} from "@repo/design-system/components/contents/biology/chromosome/coil";
import { facetsOf } from "@repo/design-system/components/three/molecule/ball";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Matrix4,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";

/** The axis a rung's cylinder is built along. */
const UP = new Vector3(0, 1, 0);

/** The rise of one base pair along the helix, in nanometres. */
const RISE = 0.34;

/** The four kinds of histone, H2A, H2B, H3 and H4, each in its own tone. */
const HISTONES = [
  GENETICS_COLORS.histoneCore,
  GENETICS_COLORS.histoneGroove,
  GENETICS_COLORS.histoneFold,
  GENETICS_COLORS.histoneTail,
] as const;

/** The colour of one drawn tube: each backbone its own where the strands show, one muted tone for the single thread. */
function threadColor(strands: boolean, index: number) {
  if (!strands) {
    return GENETICS_COLORS.chromatinThread;
  }
  return index === 0
    ? GENETICS_COLORS.dnaBackboneA
    : GENETICS_COLORS.dnaBackboneB;
}

/** The smooth curve through a list of points. */
function curveOf(points: readonly Point[]) {
  return new CatmullRomCurve3(
    Arr.map(points, ([x, y, z]) => new Vector3(x, y, z)),
    false,
    "centripetal"
  );
}

/**
 * One unbroken DNA threaded through a row of nucleosomes, in nanometres. With
 * `strands` it is drawn as the double helix it is: two sugar-phosphate
 * backbones winding around the path with a base pair between them every
 * 0.34 nm, the base pairs one instanced mesh. Without, at the scale of the
 * 30 nm fibre where the two strands can no longer be told apart, it is one
 * 2 nm thread.
 */
export function Thread({
  seats,
  strands,
}: {
  readonly seats: readonly Seat[];
  readonly strands: boolean;
}) {
  const { tier } = useStage();
  const rungs = useRef<InstancedMesh>(null);
  const built = useMemo(() => {
    const sides = facetsOf(tier).rod;
    const path = curveOf(pathOf(seats, 24));
    if (!strands) {
      const count = seats.length * 40;
      return {
        pairs: [],
        rung: new CylinderGeometry(1, 1, 1, 6, 1, true),
        tubes: [new TubeGeometry(path, count, 0.8, sides, false)],
      };
    }
    const count = Math.round(path.getLength() / RISE);
    const { first, second } = strandsOf(
      Arr.map(
        path.getSpacedPoints(count),
        (point) => [point.x, point.y, point.z] as const
      )
    );
    return {
      pairs: Arr.zip(first, second),
      rung: new CylinderGeometry(1, 1, 1, 6, 1, true),
      tubes: Arr.map(
        [first, second],
        (strand) =>
          new TubeGeometry(curveOf(strand), count * 2, 0.24, sides, false)
      ),
    };
  }, [seats, strands, tier]);
  useEffect(
    () => () => {
      built.rung.dispose();
      Arr.forEach(built.tubes, (tube) => tube.dispose());
    },
    [built]
  );

  useLayoutEffect(() => {
    const target = rungs.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const from = new Vector3();
    const along = new Vector3();
    const size = new Vector3();
    Arr.forEach(built.pairs, ([one, two], index) => {
      from.set(one[0], one[1], one[2]);
      along.set(two[0], two[1], two[2]).sub(from);
      const span = along.length();
      turn.setFromUnitVectors(UP, along.normalize());
      matrix.compose(
        from.addScaledVector(along, span / 2),
        turn,
        size.set(0.13, span, 0.13)
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [built]);

  return (
    <group>
      {Arr.map(built.tubes, (tube, index) => (
        <mesh
          castShadow
          geometry={tube}
          key={index === 0 ? "first" : "second"}
          receiveShadow
        >
          <SurfaceMaterial
            bump={0.3}
            coat={0.25}
            color={threadColor(strands, index)}
            repeat={[1, seats.length * 24]}
            roughness={0.58}
            surface="plastic"
          />
        </mesh>
      ))}
      {built.pairs.length > 0 && (
        <instancedMesh
          args={[built.rung, undefined, built.pairs.length]}
          castShadow
          key={built.pairs.length}
          ref={rungs}
        >
          <SurfaceMaterial
            color={GENETICS_COLORS.basePair}
            roughness={0.6}
            surface="plastic"
          />
        </instancedMesh>
      )}
    </group>
  );
}

/**
 * The histone octamer inside every nucleosome of a row, in nanometres: eight
 * knobbly proteins to an octamer, two of each kind, all of them one
 * instanced mesh of a shared lump.
 */
export function Octamers({ seats }: { readonly seats: readonly Seat[] }) {
  const mesh = useRef<InstancedMesh>(null);
  const lump = useLump(7, 0.2, [1, 1, 1], 0.4);
  const histones = useMemo(
    () =>
      Arr.flatMap(seats, (seat) =>
        Arr.map(octamerOf(), (histone) => ({
          at: seated(histone.at, seat),
          kind: histone.kind,
        }))
      ),
    [seats]
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const axis = new Vector3();
    const place = new Vector3();
    const size = new Vector3();
    const color = new Color();
    Arr.forEach(histones, (histone, index) => {
      axis.set(Math.sin(index * 1.7), Math.cos(index * 2.9), Math.sin(index));
      turn.setFromAxisAngle(axis.normalize(), index * 2.4);
      matrix.compose(
        place.set(histone.at[0], histone.at[1], histone.at[2]),
        turn,
        size.setScalar(1.95)
      );
      target.setMatrixAt(index, matrix);
      target.setColorAt(
        index,
        color.set(HISTONES[histone.kind] ?? HISTONES[0])
      );
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
    target.computeBoundingSphere();
  }, [histones]);

  return (
    <instancedMesh
      args={[lump, undefined, histones.length]}
      castShadow
      key={histones.length}
      receiveShadow
      ref={mesh}
    >
      <SurfaceMaterial
        bump={0.6}
        coat={0.2}
        color={getColor("WHITE")}
        repeat={[3, 2]}
        roughness={0.62}
        surface="tissue"
      />
    </instancedMesh>
  );
}
