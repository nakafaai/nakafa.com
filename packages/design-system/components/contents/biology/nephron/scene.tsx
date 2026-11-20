import { useFrame, useThree } from "@react-three/fiber";
import type { Solute } from "@repo/design-system/components/contents/biology/nephron/filtration";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { createRef, useMemo, useRef } from "react";
import type { Mesh } from "three";
import { CatmullRomCurve3, DoubleSide, Vector3 } from "three";

/** A point of the nephron's drawing, in its own units of about a tenth of a millimetre. */
type Point = readonly [number, number, number];

/** Builds a smooth curve through `points`. */
function curve(points: readonly Point[]) {
  return new CatmullRomCurve3(
    Arr.map(points, (point) => new Vector3(...point)),
    false,
    "centripetal"
  );
}

/** Where the Bowman's capsule sits. */
const CAPSULE: Point = [-1.6, 1.6, 0];

/**
 * The path filtrate takes, from the capsule through the proximal convoluted
 * tubule, down the loop of Henle into the medulla and back up, through the
 * distal convoluted tubule, and down the collecting duct.
 */
const TUBULE: readonly Point[] = [
  [-1.6, 1.15, 0],
  [-1.15, 0.95, 0.35],
  [-0.7, 1.35, 0.5],
  [-0.95, 1.85, 0.1],
  [-0.45, 2.1, -0.35],
  [0, 1.7, -0.2],
  [-0.3, 1.25, 0.15],
  [0.15, 0.95, 0.3],
  [0.35, 0.3, 0.1],
  [0.38, -0.8, 0],
  [0.42, -1.9, 0],
  [0.62, -2.35, 0],
  [0.85, -1.9, 0],
  [0.9, -0.8, 0],
  [0.92, 0.6, -0.1],
  [0.6, 1.25, 0.45],
  [0.25, 1.55, 0.2],
  [0.7, 1.95, -0.2],
  [1.25, 1.75, 0],
  [1.7, 1.5, 0],
  [1.75, 0.2, 0],
  [1.75, -1.2, 0],
  [1.75, -2.8, 0],
];

/** Where along the tubule the proximal convoluted tubule ends, as a share of its length. */
const PROXIMAL = 0.3;

/** The blood: in along the afferent arteriole, round the glomerulus, out along the efferent one, and alongside the tubule. */
const VESSEL: readonly Point[] = [
  [-3.2, 2.4, 0.2],
  [-2.3, 1.9, 0.1],
  [-1.85, 1.7, 0.05],
];
const EFFERENT: readonly Point[] = [
  [-1.4, 1.95, -0.1],
  [-1.0, 2.35, -0.5],
  [-0.4, 2.45, -0.75],
  [0.2, 2.1, -0.6],
  [0.25, 1.2, -0.3],
  [0.15, 0.4, -0.25],
  [0.1, -1.2, -0.3],
  [0.62, -2.6, -0.35],
  [1.15, -1.2, -0.3],
  [1.2, 0.6, -0.4],
  [2.4, 1.4, -0.5],
];

/** How many particles of each solute the scene keeps moving. */
const POOL = 36;

/** How many seconds a particle takes to pass the whole tubule. */
const TRANSIT = 9;

/**
 * One nephron, its blood supply and the filtrate inside it. Glucose (gold)
 * is filtered in proportion to the plasma glucose; the proximal tubule takes
 * each grain back into the blood until it works at its maximum, and the rest
 * runs on into the urine. Urea (green) is filtered and kept, and bunches up
 * along the duct as the tubule takes water back.
 *
 * @param share - The share of filtered glucose the tubule reabsorbs, 0 to 1
 * @param amount - How much glucose is filtered against the most the lab shows, 0 to 1
 */
export function NephronScene({
  amount,
  share,
  solute,
}: {
  readonly amount: number;
  readonly share: number;
  readonly solute: Solute;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const tubule = useMemo(() => curve(TUBULE), []);
  const afferent = useMemo(() => curve(VESSEL), []);
  const efferent = useMemo(() => curve(EFFERENT), []);
  const time = useRef(TRANSIT * 0.55);
  const grains = useMemo(
    () => Arr.map(Arr.range(1, POOL), (id) => ({ id, ref: createRef<Mesh>() })),
    []
  );
  const point = useMemo(() => new Vector3(), []);
  const blood = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    if (playing) {
      time.current += simulationStep(delta);
    }
    Arr.forEach(grains, (grain, index) => {
      const mesh = grain.ref.current;
      if (mesh === null) {
        return;
      }
      const shown = solute === "urea" || hashUnit(index, 41) < amount;
      const run = (time.current / TRANSIT + index / POOL) % 1;
      // Urea slows as water leaves the tubule, so it crowds the duct.
      const along = solute === "urea" ? 1 - (1 - run) ** 1.6 : run;
      tubule.getPointAt(along, point);
      const taken = solute === "glucose" && hashUnit(index, 7) < share;
      const leaves = PROXIMAL * (0.25 + 0.7 * hashUnit(index, 11));
      if (taken && along > leaves) {
        const away = Math.min(1, (along - leaves) * 12);
        tubule.getPointAt(leaves, point);
        efferent.getPointAt(0.32 + 0.1 * hashUnit(index, 3), blood);
        point.lerp(blood, away);
        mesh.visible = shown && away < 1;
      } else {
        mesh.visible = shown;
      }
      mesh.position.copy(point);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <NephronCamera />
      <mesh position={CAPSULE} rotation={[0, 0, -0.5]}>
        <sphereGeometry
          args={[0.5, 40, 24, 0, Math.PI * 2, 0.55, Math.PI - 0.55]}
        />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={BIOLOGY_COLORS.tubule}
          depthWrite={false}
          opacity={0.45}
          roughness={0.4}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={CAPSULE}>
        <torusKnotGeometry args={[0.24, 0.055, 220, 12, 3, 7]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.blood} roughness={0.45} />
      </mesh>
      <mesh>
        <tubeGeometry args={[tubule, 360, 0.12, 16, false]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={BIOLOGY_COLORS.tubule}
          depthWrite={false}
          opacity={0.42}
          roughness={0.35}
          transparent
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[afferent, 40, 0.085, 12, false]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.blood} roughness={0.45} />
      </mesh>
      <mesh>
        <tubeGeometry args={[efferent, 240, 0.055, 10, false]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.bloodDark}
          roughness={0.45}
        />
      </mesh>
      {Arr.map(grains, (grain) => (
        <mesh key={grain.id} ref={grain.ref}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial
            color={
              solute === "glucose"
                ? BIOLOGY_COLORS.glucose
                : BIOLOGY_COLORS.urea
            }
            emissive={
              solute === "glucose"
                ? BIOLOGY_COLORS.glucose
                : BIOLOGY_COLORS.urea
            }
            emissiveIntensity={0.35}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Looks at the whole nephron from the front, farther back on a narrow card. */
function NephronCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 14 : 10.2;
  return (
    <CameraControls
      cameraPosition={[0.6, 0.5, distance]}
      cameraTarget={[0, -0.1, 0]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={2}
    />
  );
}
