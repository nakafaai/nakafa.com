import {
  bankSheet,
  reedBeds,
  reedClump,
  SHORE_EXTENT,
} from "@repo/design-system/components/contents/physics/kinematics/river/shore";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Matter } from "@repo/design-system/components/three/matter/material";
import type { GroundSchema } from "@repo/design-system/components/three/stage/land";
import { GroundMaterial } from "@repo/design-system/components/three/stage/terrain";
import { BOAT_COLORS } from "@repo/design-system/lib/material/boat";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Object3D,
} from "three";

/** The two banks: 1 lies toward +z, -1 toward -z. */
const SIDES = [1, -1] as const;

/** Where the shore's bare earth is sampled behind the waterline, from the bed to under the turf. */
const EARTH = [-4, -2.8, -1.8, -1, -0.4, 0, 0.4, 0.9, 1.5, 2.2, 3.2];

/** Where the turf is sampled, from its lip over the shore to the far meadow. */
const TURF = [1.7, 2.2, 3, 4.5, 7, 11, 18, 30, 50, 90, 160, 300, SHORE_EXTENT];

/** How many places along each bank are tried for a clump of reeds. */
const BEDS = 520;

/** One layer of a bank as a geometry, freed with the bank. */
function useSheet(side: 1 | -1, half: number, backs: readonly number[]) {
  const geometry = useMemo(() => {
    const sheet = bankSheet(side, half, backs, backs === TURF ? 0.07 : 0);
    const built = new BufferGeometry();
    built.setAttribute(
      "position",
      new Float32BufferAttribute(sheet.positions, 3)
    );
    built.setAttribute("uv", new Float32BufferAttribute(sheet.uvs, 2));
    built.setIndex(sheet.indices);
    built.computeVertexNormals();
    return built;
  }, [backs, half, side]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** One layer of one bank, painted as the ground it is. */
function Layer({
  backs,
  half,
  kind,
  metres,
  side,
}: {
  readonly backs: readonly number[];
  readonly half: number;
  readonly kind: typeof GroundSchema.Type;
  /** How many metres one tile of the ground's grain covers. */
  readonly metres: number;
  readonly side: 1 | -1;
}) {
  const geometry = useSheet(side, half, backs);
  const tiles = (2 * SHORE_EXTENT) / metres;

  return (
    <mesh geometry={geometry} receiveShadow>
      <GroundMaterial kind={kind} repeat={[tiles, tiles]} />
    </mesh>
  );
}

/** How far to either side of a landing the bank is kept clear of reeds, in metres. */
const LANDING = 5;

/**
 * The reeds of both banks: one clump drawn at every bed, greener at the root
 * than at the tip. No reeds stand where a boat puts off from the near bank
 * or comes in on the far one.
 */
function Reeds({
  half,
  landings,
}: {
  readonly half: number;
  readonly landings: readonly [number, number];
}) {
  const reeds = useRef<InstancedMesh>(null);
  const [near, far] = landings;
  const beds = useMemo(
    () =>
      Arr.filter(
        Arr.flatMap(SIDES, (side) => reedBeds(side, half, BEDS)),
        (bed) => Math.abs(bed.x - (bed.z > 0 ? near : far)) > LANDING
      ),
    [far, half, near]
  );
  const geometry = useMemo(() => {
    const clump = reedClump();
    const built = new BufferGeometry();
    built.setAttribute(
      "position",
      new Float32BufferAttribute(clump.positions, 3)
    );
    built.setIndex(clump.indices);
    built.computeVertexNormals();
    return built;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = reeds.current;
    if (mesh === null) {
      return;
    }
    const place = new Object3D();
    Arr.forEach(beds, (bed, index) => {
      place.position.set(bed.x, bed.y, bed.z);
      place.rotation.set(0, bed.turn, 0);
      place.scale.setScalar(bed.scale);
      place.updateMatrix();
      mesh.setMatrixAt(index, place.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [beds]);

  return (
    <instancedMesh
      args={[geometry, undefined, beds.length]}
      castShadow
      key={beds.length}
      ref={reeds}
    >
      <Matter color={BOAT_COLORS.reed} of="paint" side={DoubleSide} />
    </instancedMesh>
  );
}

/**
 * The two banks of a river whose water lies at height zero, in metres: under
 * the water the bed falls away, the shore climbs a slope of wet earth with
 * reeds in its shallows, and turf laid over it rolls back into a meadow that
 * fades into the horizon. The river runs along x and each waterline wanders
 * as a natural bank does.
 *
 * @param landings - Where a boat puts off from the near bank and comes in on the far one, along the river, in metres
 * @param width - The river's width from waterline to waterline, in metres
 */
export function Banks({
  landings,
  width,
}: {
  readonly landings: readonly [number, number];
  readonly width: number;
}) {
  return (
    <CameraBounds exclude>
      {Arr.map(SIDES, (side) => (
        <group key={side}>
          <Layer
            backs={EARTH}
            half={width / 2}
            kind="soil"
            metres={3}
            side={side}
          />
          <Layer
            backs={TURF}
            half={width / 2}
            kind="grass"
            metres={7}
            side={side}
          />
        </group>
      ))}
      <Reeds half={width / 2} landings={landings} />
    </CameraBounds>
  );
}
