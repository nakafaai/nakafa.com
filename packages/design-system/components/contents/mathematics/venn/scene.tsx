import { useFrame, useThree } from "@react-three/fiber";
import {
  hoopCentres,
  MAT,
  restingPlaces,
  TRAY_Z,
  trayPlaces,
} from "@repo/design-system/components/contents/mathematics/venn/layout";
import {
  Hoops,
  MAT_TOP,
  Mat,
  RegionTint,
  TRAY_FLOOR,
  Tray,
} from "@repo/design-system/components/contents/mathematics/venn/mat";
import {
  OBJECT_REACH,
  VennObjectModel,
} from "@repo/design-system/components/contents/mathematics/venn/objects";
import type {
  VennObject,
  VennOperation,
} from "@repo/design-system/components/contents/mathematics/venn/sets";
import { selects } from "@repo/design-system/components/contents/mathematics/venn/sets";
import {
  carried,
  carryAt,
  settled,
  sortEnd,
} from "@repo/design-system/components/contents/mathematics/venn/sort";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { VENN_COLORS } from "@repo/design-system/lib/material/venn";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Color, Group } from "three";
import { Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

/** How high a chosen object rises off the mat once it is set down, in metres. */
const RISE = 0.014;

/** How much darker an object the operation leaves out becomes. */
const DIM = 0.45;

/** How bright the ring of light round a chosen object shines at full strength. */
const HALO = 0.9;

/**
 * Darkens every surface of one object by `dim`, so an object the operation
 * leaves out recedes and keeps its own colour. Each material keeps its own
 * colour the first time it is shaded, so shading never drifts.
 */
function shade(object: Group, dim: number) {
  object.traverse((part) => {
    if (
      !(part instanceof Mesh && part.material instanceof MeshStandardMaterial)
    ) {
      return;
    }
    const material = part.material;
    const own: Color = material.userData.own ?? material.color.clone();
    material.userData.own = own;
    material.color.copy(own).multiplyScalar(1 - DIM * dim);
  });
}

/**
 * The set-sorting scene on a studio floor: the canvas mat that is the
 * universal set, its hula hoops, the tint over the region the chosen
 * operation selects, and the tray in front. Playing carries the objects one
 * by one from the tray to their regions; still, the scene shows them sorted.
 * An object the operation selects rises in a ring of light on the mat, so
 * its own colour stays true; the rest darken.
 */
export function VennScene({
  objects,
  operation,
  regions,
  sets,
}: {
  readonly objects: readonly VennObject[];
  readonly operation: VennOperation;
  readonly regions: readonly number[];
  readonly sets: number;
}) {
  const { advance, playing } = useTimeline(0, sortEnd(objects.length));
  const centres = useMemo(() => hoopCentres(sets), [sets]);
  const rests = useMemo(
    () => restingPlaces(regions, centres),
    [centres, regions]
  );
  const waits = useMemo(() => trayPlaces(objects.length), [objects.length]);
  const holders = useRef<(Group | null)[]>([]);
  const halos = useRef<(Mesh | null)[]>([]);

  useFrame((_, delta) => {
    const time = advance(delta);
    Arr.forEach(objects, (_object, index) => {
      const holder = holders.current[index];
      const halo = halos.current[index];
      if (!(holder && halo)) {
        return;
      }
      const from = { ...Arr.getUnsafe(waits, index), y: TRAY_FLOOR };
      const to = { ...Arr.getUnsafe(rests, index), y: MAT_TOP };
      const point = carryAt(from, to, carried(time, index));
      const landed = settled(time, index);
      const chosen = selects(operation, Arr.getUnsafe(regions, index));
      holder.position.set(
        point.x,
        point.y + (chosen ? RISE * landed : 0),
        point.z
      );
      shade(holder, chosen ? 0 : landed);
      halo.position.set(point.x, MAT_TOP + 0.0012, point.z);
      halo.visible = chosen && landed > 0;
      if (halo.material instanceof MeshBasicMaterial) {
        halo.material.opacity = HALO * landed;
      }
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <VennCamera />
      <Mat />
      <RegionTint centres={centres} operation={operation} />
      <Hoops centres={centres} />
      <Tray />
      {Arr.map(objects, (object, index) => (
        <group key={object}>
          <group
            ref={(holder) => {
              holders.current[index] = holder;
            }}
          >
            <VennObjectModel object={object} />
          </group>
          <mesh
            ref={(halo) => {
              halos.current[index] = halo;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry
              args={[
                OBJECT_REACH[object] + 0.004,
                OBJECT_REACH[object] + 0.016,
                48,
              ]}
            />
            <meshBasicMaterial
              color={VENN_COLORS.glow}
              depthWrite={false}
              opacity={0}
              toneMapped={false}
              transparent
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Looks down on the mat and the tray from in front and above, so every
 * region and every object shows; farther back on a narrow card.
 */
function VennCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 3.1 : 2.6;
  const elevation = narrow ? 1.08 : 1.02;
  const target = [0, 0, (TRAY_Z - MAT.depth / 2) / 2 + 0.3] as const;
  return (
    <CameraControls
      cameraPosition={[
        0,
        distance * Math.sin(elevation),
        target[2] + distance * Math.cos(elevation),
      ]}
      cameraTarget={target}
      fov={36}
      maxDistance={distance * 1.6}
      maxPolarAngle={Math.PI / 2 - 0.12}
      minDistance={0.4}
    />
  );
}
