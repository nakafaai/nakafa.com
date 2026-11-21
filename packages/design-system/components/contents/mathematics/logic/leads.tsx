import { useFrame } from "@react-three/fiber";
import type {
  Layout,
  LeadColor,
} from "@repo/design-system/components/contents/mathematics/logic/circuit";
import {
  CLIP,
  WIRE_RADIUS,
} from "@repo/design-system/components/contents/mathematics/logic/rig";
import {
  clipPose,
  leadPath,
  marksAlong,
} from "@repo/design-system/components/contents/mathematics/logic/route";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LOGIC_COLORS } from "@repo/design-system/lib/material/logic";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { CatmullRomCurve3, Object3D, TubeGeometry, Vector3 } from "three";

/** The most marks of current the board shows at once. */
const MAX_MARKS = 160;

/** The smooth centre line of one lead, through the points of its path. */
function leadCurve(layout: Layout, lead: number) {
  return new CatmullRomCurve3(
    Arr.map(leadPath(layout, lead), ([x, y, z]) => new Vector3(x, y, z)),
    false,
    "centripetal"
  );
}

/**
 * A steel crocodile clip biting a post, its jaws at the post and its PVC boot,
 * in the lead's colour, pointing along +x toward where the lead comes in.
 */
function CrocodileClip({ color }: { readonly color: string }) {
  return (
    <group>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[0.0058, side * 0.0012, 0]}
          rotation={[0, 0, side * 0.1]}
        >
          <boxGeometry args={[0.0136, 0.0008, 0.0042]} />
          <MetalMaterial color={LOGIC_COLORS.clipSteel} roughness={0.28} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0.0125 + (CLIP.length - 0.0125) / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0022, 0.0033, CLIP.length - 0.0125, 18]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          color={color}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/** One lead: its PVC insulation along its path and a clip on each post. */
export function Lead({
  color,
  index,
  layout,
}: {
  readonly color: LeadColor;
  readonly index: number;
  readonly layout: Layout;
}) {
  const geometry = useMemo(
    () => new TubeGeometry(leadCurve(layout, index), 160, WIRE_RADIUS, 10),
    [index, layout]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const shade = LOGIC_COLORS[color];

  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.5}
          clearcoatRoughness={0.25}
          color={shade}
          roughness={0.38}
        />
      </mesh>
      {Arr.map(["from", "to"] as const, (end) => {
        const pose = clipPose(layout, index, end);
        return (
          <group key={end} position={pose.jaw} rotation={[0, pose.heading, 0]}>
            <CrocodileClip color={shade} />
          </group>
        );
      })}
    </group>
  );
}

/**
 * Small bright marks that run along every live lead in the direction of
 * conventional current, from the positive post round to the negative one.
 * A lead with no current carries none, so a broken circuit stands still.
 */
export function CurrentMarks({
  layout,
  live,
}: {
  readonly layout: Layout;
  readonly live: readonly number[];
}) {
  const marks = useRef<InstancedMesh>(null);
  const time = useRef(0);
  const curves = useMemo(
    () =>
      Arr.map(live, (lead) => {
        const curve = leadCurve(layout, lead);
        return { curve, length: curve.getLength() };
      }),
    [layout, live]
  );
  const place = useMemo(() => new Object3D(), []);
  const point = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const mesh = marks.current;
    if (mesh === null) {
      return;
    }
    time.current += Math.min(delta, 0.1);
    let count = 0;
    for (const { curve, length } of curves) {
      for (const share of marksAlong(length, time.current)) {
        if (count >= MAX_MARKS) {
          break;
        }
        curve.getPointAt(share, point);
        place.position.set(point.x, point.y + WIRE_RADIUS * 0.85, point.z);
        place.updateMatrix();
        mesh.setMatrixAt(count, place.matrix);
        count += 1;
      }
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <SimulationTicker running={live.length > 0} />
      <instancedMesh args={[undefined, undefined, MAX_MARKS]} ref={marks}>
        <sphereGeometry args={[0.0009, 10, 8]} />
        <meshStandardMaterial
          color={LOGIC_COLORS.current}
          emissive={LOGIC_COLORS.current}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
}
