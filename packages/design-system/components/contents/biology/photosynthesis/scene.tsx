import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  BenchLamp,
  FlatRule,
  GlassTube,
} from "@repo/design-system/components/contents/biology/glassware";
import { leafSurface } from "@repo/design-system/components/contents/biology/leaf";
import type { Reading } from "@repo/design-system/components/contents/biology/photosynthesis/light";
import {
  bubbleInterval,
  bubblesAt,
} from "@repo/design-system/components/contents/biology/photosynthesis/light";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr } from "effect";
import { createRef, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh, Mesh } from "three";
import {
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Object3D,
  Vector2,
  Vector3,
} from "three";

/** Where the plant stands on the bench, in metres: the beaker's middle. */
const BEAKER_X = 0.2;

/** The water bath: a 600 mL beaker, its inner radius, height and water level, in metres. */
const BATH = { height: 0.125, level: 0.1, radius: 0.044 } as const;

/** The boiling tube in the bath, its radius, foot and top, in metres. */
const TUBE = { bottom: 0.012, radius: 0.0125, top: 0.16, water: 0.14 } as const;

/** Where the sprig's cut end gives off its bubbles, in metres above the bench. */
const STEM_TOP = 0.11;

/** How fast a bubble rises through the water, in metres a second. */
const RISE = 0.012;

/** The most bubbles the tube holds at once. */
const POOL = 8;

/**
 * The bench, the water bath, the Hydrilla tube, the lamp at the reading's
 * distance, and the bubbles rising from the cut stem in real time.
 */
export function PhotosynthesisScene({
  reading,
}: {
  readonly reading: Reading;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const time = useRef(bubbleInterval(reading.bubbles) * 0.4);
  const bubbles = useMemo(
    () => Arr.map(Arr.range(1, POOL), (id) => ({ id, ref: createRef<Mesh>() })),
    []
  );
  const lampX = BEAKER_X - reading.distance / 100;

  useFrame((_, delta) => {
    if (playing) {
      time.current += simulationStep(delta);
    }
    const rises = bubblesAt(
      reading.bubbles,
      time.current,
      RISE,
      TUBE.water - STEM_TOP
    );
    Arr.forEach(bubbles, (bubble, index) => {
      const mesh = bubble.ref.current;
      if (mesh === null) {
        return;
      }
      const rise = rises[index];
      mesh.visible = rise !== undefined;
      mesh.position.set(
        BEAKER_X + Math.sin((rise ?? 0) * 300) * 0.0008,
        STEM_TOP + (rise ?? 0),
        0
      );
      mesh.scale.setScalar(1 + (rise ?? 0) * 8);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <LabBench />
      <group position={[0, 0, 0.12]}>
        <Bath />
        <Hydrilla />
        {Arr.map(bubbles, (bubble) => (
          <mesh key={bubble.id} ref={bubble.ref}>
            <sphereGeometry args={[0.0011, 12, 8]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={BIOLOGY_COLORS.bubble}
              emissive={BIOLOGY_COLORS.bubble}
              emissiveIntensity={0.3}
              roughness={0.05}
            />
          </mesh>
        ))}
        <group position={[lampX, 0, 0]}>
          <BenchLamp target={[BEAKER_X - lampX, STEM_TOP, 0]} />
        </group>
        <group position={[BEAKER_X - 0.25, 0, 0.07]}>
          <FlatRule length={0.5} step={10} zero="right" />
        </group>
        {reading.bicarbonate === true && <BicarbonateTag />}
      </group>
    </group>
  );
}

/** The beaker of the water bath, its water, and the thermometer that shows it stays steady. */
function Bath() {
  const wall = useMemo(
    () => [
      new Vector2(0.001, 0),
      new Vector2(BATH.radius, 0),
      new Vector2(BATH.radius + 0.0015, 0.003),
      new Vector2(BATH.radius + 0.0015, BATH.height),
      new Vector2(BATH.radius + 0.003, BATH.height + 0.002),
    ],
    []
  );
  return (
    <group position={[BEAKER_X, 0, 0]}>
      <mesh castShadow>
        <latheGeometry args={[wall, 48]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.14} />
      </mesh>
      <mesh position={[0, BATH.level / 2 + 0.002, 0]}>
        <cylinderGeometry
          args={[BATH.radius - 0.001, BATH.radius - 0.001, BATH.level, 48]}
        />
        <LiquidMaterial color={BIOLOGY_COLORS.pondWater} opacity={0.1} />
      </mesh>
      <GlassTube
        end={[0, TUBE.top, 0]}
        opacity={0.12}
        radius={TUBE.radius}
        start={[0, TUBE.bottom, 0]}
      />
      <mesh position={[0, TUBE.bottom, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry
          args={[TUBE.radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.3} />
      </mesh>
      <mesh position={[0, (TUBE.bottom + TUBE.water) / 2, 0]}>
        <cylinderGeometry
          args={[
            TUBE.radius - 0.0012,
            TUBE.radius - 0.0012,
            TUBE.water - TUBE.bottom,
            28,
          ]}
        />
        <LiquidMaterial color={BIOLOGY_COLORS.pondWater} opacity={0.08} />
      </mesh>
      <group position={[0.026, 0, -0.022]} rotation={[0, 0, -0.12]}>
        <GlassTube end={[0, 0.2, 0]} radius={0.003} start={[0, 0.02, 0]} />
        <mesh position={[0, 0.022, 0]}>
          <sphereGeometry args={[0.0035, 16, 12]} />
          <meshStandardMaterial color={BIOLOGY_COLORS.dye} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.065, 0]}>
          <cylinderGeometry args={[0.0009, 0.0009, 0.085, 8]} />
          <meshStandardMaterial color={BIOLOGY_COLORS.dye} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A sprig of Hydrilla, cut end up as the experiment stands it: a stem with
 * whorls of four narrow leaves, a paper clip weighting its foot.
 */
function Hydrilla() {
  const leaves = useRef<InstancedMesh>(null);
  const stem = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.02, 0),
        new Vector3(0.002, 0.05, 0.001),
        new Vector3(-0.002, 0.08, -0.001),
        new Vector3(0, STEM_TOP, 0),
      ]),
    []
  );
  const blade = useMemo(() => {
    const surface = leafSurface({
      columns: 4,
      droop: 0.05,
      length: 1,
      rows: 8,
      width: 0.22,
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(surface.positions, 3)
    );
    geometry.setIndex(surface.indices);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => blade.dispose(), [blade]);
  const whorls = 14;
  const count = whorls * 4;

  useLayoutEffect(() => {
    const mesh = leaves.current;
    if (mesh === null) {
      return;
    }
    const holder = new Object3D();
    const matrix = new Matrix4();
    Arr.forEach(Arr.range(0, count - 1), (index) => {
      const whorl = Math.floor(index / 4);
      const point = stem.getPointAt(0.04 + (whorl / whorls) * 0.94);
      holder.position.copy(point);
      holder.rotation.set(
        0,
        (index % 4) * (Math.PI / 2) + whorl * 0.7,
        0.9 - whorl * 0.02
      );
      holder.scale.setScalar(0.014 - whorl * 0.0002);
      holder.updateMatrix();
      mesh.setMatrixAt(index, matrix.copy(holder.matrix));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[BEAKER_X, 0, 0]}>
      <mesh castShadow>
        <tubeGeometry args={[stem, 40, 0.0014, 8, false]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.hydrilla} roughness={0.6} />
      </mesh>
      <instancedMesh args={[blade, undefined, count]} castShadow ref={leaves}>
        <meshPhysicalMaterial
          color={BIOLOGY_COLORS.hydrilla}
          roughness={0.5}
          side={DoubleSide}
        />
      </instancedMesh>
      <mesh position={[0, 0.019, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0035, 0.0005, 6, 20]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** A tag on the tube that names the sodium hydrogen carbonate added to its water. */
function BicarbonateTag() {
  const ink = useLabelInk();
  return (
    <ThreeLabel
      color={ink}
      fontSize="compact"
      position={[BEAKER_X + 0.03, TUBE.top + 0.02, 0]}
    >
      <InlineMath math="+\,\mathrm{NaHCO_3}" />
    </ThreeLabel>
  );
}

/**
 * Looks at the lamp and the bath from the front and a little above, far
 * enough back to hold the farthest lamp of the experiment, and farther on a
 * narrow card.
 */
export function PhotosynthesisCamera({
  farthest,
}: {
  readonly farthest: number;
}) {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const span = farthest / 100 + 0.1;
  const distance = span * (narrow ? 1.5 : 1.1);
  return (
    <CameraControls
      cameraPosition={[
        BEAKER_X + distance * 0.42,
        0.1 + distance * 0.4,
        0.12 + distance * 0.78,
      ]}
      cameraTarget={[BEAKER_X - span * 0.42, 0.07, 0.12]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.15}
    />
  );
}
