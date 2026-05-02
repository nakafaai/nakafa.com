import { Line, RoundedBox } from "@react-three/drei";
import {
  CHEMISTRY_PARTICLE_LABEL_CLOSE_SURFACE_OFFSET_RATIO,
  ChemistryParticleLabel,
  getChemistryParticleLabelFontSize,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/particle-label";
import {
  ATOM_MAP_MODE_ID,
  CATHODE_RAY_MODE_ID,
  GOLD_FOIL_MODE_ID,
  type SubatomicParticlesModeId,
  type SubatomicParticlesSceneLabels,
  type SubatomicSceneColors,
} from "@repo/design-system/components/contents/chemistry/subatomic-particles/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { THREE_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { Vector3 } from "three";

const PATH_POINT_COUNT = 48;
const CATHODE_RAY_POINTS = createPath(PATH_POINT_COUNT, getCathodeRayPoint);
const CATHODE_ELECTRON_POINTS = [0.08, 0.26, 0.48, 0.72].map(
  getCathodeRayPoint
);
const ALPHA_STRAIGHT_POINTS = createPath(
  PATH_POINT_COUNT,
  (progress) => new Vector3(-2.6 + 5.2 * progress, 0.62, 0)
);
const ALPHA_LOWER_POINTS = createPath(
  PATH_POINT_COUNT,
  (progress) => new Vector3(-2.6 + 5.2 * progress, -0.72, 0)
);
const ALPHA_DEFLECTED_POINTS = createQuadraticPath(
  new Vector3(-2.6, -0.02, 0),
  new Vector3(0.05, -0.08, 0),
  new Vector3(2.55, 0.82, 0)
);
const ALPHA_BACKSCATTER_POINTS = createQuadraticPath(
  new Vector3(-2.6, -0.02, 0.18),
  new Vector3(0.06, -0.04, 0.18),
  new Vector3(-1.25, 0.72, 0.18)
);
const ALPHA_MARKER_POINTS = createPath(
  3,
  (progress) => new Vector3(-2.35 + 1.4 * progress, -0.02, 0)
);
const GOLD_NUCLEUS_POINTER_POINTS = createPath(
  2,
  (progress) =>
    new Vector3(
      0.14 + 0.52 * progress,
      0.12 + 0.7 * progress,
      0.2 + 0.52 * progress
    )
);
const ELECTRON_POSITIONS = [
  [-1.15, 0.95, 0.15],
  [0.95, 0.74, 0.35],
  [1.45, -0.62, -0.05],
];
const NUCLEON_POSITIONS = [
  { kind: "proton", label: "p^+", position: [-0.48, 0.28, 0.16] },
  { kind: "neutron", label: "n^0", position: [0.48, 0.28, -0.06] },
  { kind: "neutron", label: "n^0", position: [-0.48, -0.34, 0.04] },
  { kind: "proton", label: "p^+", position: [0.48, -0.34, 0.16] },
];
const SUBATOMIC_LABEL_SIZE = THREE_FONT_SIZE.annotation;
const ATOM_MAP_SCALE = 1.1;

/**
 * Generates a fixed-resolution 3D path from a continuous point function.
 */
function createPath(
  pointCount: number,
  getPointAtProgress: (progress: number) => Vector3
) {
  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);

    return getPointAtProgress(progress);
  });
}

/**
 * Generates a smooth quadratic path for schematic beam deflections.
 */
function createQuadraticPath(start: Vector3, control: Vector3, end: Vector3) {
  return createPath(PATH_POINT_COUNT, (progress) => {
    const startWeight = (1 - progress) ** 2;
    const controlWeight = 2 * (1 - progress) * progress;
    const endWeight = progress ** 2;

    return start
      .clone()
      .multiplyScalar(startWeight)
      .add(control.clone().multiplyScalar(controlWeight))
      .add(end.clone().multiplyScalar(endWeight));
  });
}

/**
 * Places the cathode ray on a gentle S curve toward the positive plate.
 */
function getCathodeRayPoint(progress: number) {
  const x = -2.2 + 4.28 * progress;
  const bendProgress = smoothStep(0.35, 0.86, progress);
  const y = 0.58 * bendProgress;

  return new Vector3(x, y, 0);
}

/**
 * Eases a value from 0 to 1 between two edges.
 */
function smoothStep(edgeStart: number, edgeEnd: number, value: number) {
  const progress = Math.min(
    Math.max((value - edgeStart) / (edgeEnd - edgeStart), 0),
    1
  );

  return progress * progress * (3 - 2 * progress);
}

interface SubatomicParticlesSceneProps extends SceneProps {
  modeId: SubatomicParticlesModeId;
}

interface SceneProps {
  colors: SubatomicSceneColors;
  labels: SubatomicParticlesSceneLabels;
}

/**
 * Chooses the active 3D scene without mounting hidden experiments.
 */
export function SubatomicParticlesScene({
  colors,
  labels,
  modeId,
}: SubatomicParticlesSceneProps) {
  if (modeId === CATHODE_RAY_MODE_ID) {
    return <CathodeRayScene colors={colors} labels={labels} />;
  }

  if (modeId === GOLD_FOIL_MODE_ID) {
    return <GoldFoilScene colors={colors} labels={labels} />;
  }

  if (modeId === ATOM_MAP_MODE_ID) {
    return <AtomMapScene colors={colors} labels={labels} />;
  }

  return null;
}

/**
 * Shows a cathode ray bending toward the positive plate.
 */
function CathodeRayScene({ colors, labels }: SceneProps) {
  return (
    <group scale={1.05}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.82, 0.82, 5, 64, 1, true]} />
        <meshStandardMaterial
          color={colors.glass}
          depthWrite={false}
          opacity={0.12}
          roughness={0.2}
          transparent
        />
      </mesh>

      <Electrode
        color={colors.cathode}
        label={`${labels.cathode} -`}
        x={-2.1}
      />
      <Electrode color={colors.anode} label={`${labels.anode} +`} x={-0.95} />
      <Plate color={colors.positive} label={labels.positivePlate} y={0.9} />
      <Plate color={colors.negative} label={labels.negativePlate} y={-0.95} />

      <Line color={colors.ray} lineWidth={5} points={CATHODE_RAY_POINTS} />
      {CATHODE_ELECTRON_POINTS.map((point) => (
        <Particle
          color={colors.electron}
          key={`electron-${point.x}-${point.y}`}
          label="e^-"
          labelColor={colors.sphereText}
          position={point}
          radius={0.11}
        />
      ))}

      <SceneLabel
        color={colors.text}
        fontSize={SUBATOMIC_LABEL_SIZE}
        position={[1.25, 0, 0.35]}
      >
        {labels.cathodeRay}
      </SceneLabel>
    </group>
  );
}

/**
 * Shows the gold foil result: most alpha particles pass through, a few bend.
 */
function GoldFoilScene({ colors, labels }: SceneProps) {
  return (
    <group scale={1.05}>
      <RoundedBox args={[0.16, 2.65, 0.08]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color={colors.gold} roughness={0.45} />
      </RoundedBox>

      <Line color={colors.alpha} lineWidth={4} points={ALPHA_STRAIGHT_POINTS} />
      <Line color={colors.alpha} lineWidth={4} points={ALPHA_LOWER_POINTS} />
      <Line
        color={colors.alpha}
        lineWidth={5}
        points={ALPHA_DEFLECTED_POINTS}
      />
      <Line
        color={colors.alpha}
        lineWidth={5}
        points={ALPHA_BACKSCATTER_POINTS}
      />

      {ALPHA_MARKER_POINTS.map((point) => (
        <mesh key={`alpha-${point.x}`} position={point}>
          <sphereGeometry args={[0.1, 32, 32]} />
          <meshStandardMaterial color={colors.alpha} roughness={0.4} />
        </mesh>
      ))}

      <Particle
        color={colors.nucleus}
        label=""
        labelColor={colors.sphereText}
        position={new Vector3(0, 0, 0.1)}
        radius={0.16}
      />
      <Line
        color={colors.text}
        lineWidth={1}
        points={GOLD_NUCLEUS_POINTER_POINTS}
      />

      <SceneLabel
        color={colors.text}
        fontSize={SUBATOMIC_LABEL_SIZE}
        position={[-1.9, 0.9, 1.05]}
      >
        {labels.alphaParticle}
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize={SUBATOMIC_LABEL_SIZE}
        position={[0.88, 0.98, 0.76]}
      >
        {labels.nucleus}
      </SceneLabel>
    </group>
  );
}

/**
 * Shows a compact nucleus surrounded by a much larger electron region.
 */
function AtomMapScene({ colors, labels }: SceneProps) {
  return (
    <group>
      <group rotation={[-0.08, -0.25, 0]} scale={ATOM_MAP_SCALE}>
        <ElectronRegionRing colors={colors} rotation={[Math.PI / 2, 0, 0]} />
        <ElectronRegionRing
          colors={colors}
          rotation={[Math.PI / 2, 0, Math.PI / 2.8]}
        />
        <ElectronRegionRing
          colors={colors}
          rotation={[Math.PI / 2.6, 0, Math.PI / 5]}
        />

        {NUCLEON_POSITIONS.map((particle) => (
          <Particle
            color={particle.kind === "proton" ? colors.proton : colors.neutron}
            key={`${particle.kind}-${particle.position.join(",")}`}
            label={particle.label}
            labelColor={colors.sphereText}
            position={new Vector3(...particle.position)}
            radius={0.2}
          />
        ))}

        {ELECTRON_POSITIONS.map((position) => (
          <Particle
            color={colors.electron}
            key={`electron-${position.join(",")}`}
            label="e^-"
            labelColor={colors.sphereText}
            position={new Vector3(...position)}
            radius={0.16}
          />
        ))}
      </group>

      <SceneLabel
        color={colors.text}
        fontSize={SUBATOMIC_LABEL_SIZE}
        position={[-0.22, -0.72, 0.9]}
      >
        {labels.nucleus}
      </SceneLabel>
    </group>
  );
}

/**
 * Renders one charged electrode inside the cathode-ray tube.
 */
function Electrode({
  color,
  label,
  x,
}: {
  color: string;
  label: string;
  x: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      <RoundedBox args={[0.16, 0.95, 0.16]} radius={0.035} smoothness={3}>
        <meshStandardMaterial color={color} roughness={0.45} />
      </RoundedBox>
      <SceneLabel
        color={color}
        fontSize={THREE_FONT_SIZE.compact}
        position={[0, -0.66, 0.22]}
      >
        {label}
      </SceneLabel>
    </group>
  );
}

/**
 * Renders one electric plate that bends the cathode ray.
 */
function Plate({
  color,
  label,
  y,
}: {
  color: string;
  label: string;
  y: number;
}) {
  return (
    <group position={[0.9, y, 0]}>
      <RoundedBox args={[1.45, 0.12, 0.12]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color={color} roughness={0.4} />
      </RoundedBox>
      <SceneLabel
        color={color}
        fontSize={THREE_FONT_SIZE.compact}
        position={[0, y > 0 ? 0.27 : -0.27, 0.18]}
      >
        {label}
      </SceneLabel>
    </group>
  );
}

/**
 * Renders a thin guide for the electron region, not a fixed electron path.
 */
function ElectronRegionRing({
  colors,
  rotation,
}: {
  colors: SubatomicSceneColors;
  rotation: [number, number, number];
}) {
  return (
    <mesh rotation={rotation}>
      <torusGeometry args={[1.45, 0.008, 12, 96]} />
      <meshStandardMaterial color={colors.text} opacity={0.18} transparent />
    </mesh>
  );
}

/**
 * Renders one labeled particle with the label facing the camera.
 */
function Particle({
  color,
  label,
  labelColor,
  position,
  radius,
}: {
  color: string;
  label: string;
  labelColor: string;
  position: Vector3;
  radius: number;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      {label && (
        <ChemistryParticleLabel
          color={labelColor}
          fontSize={getChemistryParticleLabelFontSize(radius)}
          position={getChemistryParticleLabelPosition(
            radius,
            CHEMISTRY_PARTICLE_LABEL_CLOSE_SURFACE_OFFSET_RATIO
          )}
        >
          {label}
        </ChemistryParticleLabel>
      )}
    </group>
  );
}
