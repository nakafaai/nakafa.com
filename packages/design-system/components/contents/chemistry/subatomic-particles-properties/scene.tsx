import { Billboard, Line, RoundedBox, Text } from "@react-three/drei";
import {
  CHARGE_MODE_ID,
  LOCATION_MODE_ID,
  MASS_MODE_ID,
  type SubatomicParticlePropertiesColors,
  type SubatomicParticlePropertiesModeId,
  type SubatomicParticlePropertiesSceneLabels,
} from "@repo/design-system/components/contents/chemistry/subatomic-particles-properties/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import {
  getThreeParticleLabelFontSize,
  MONO_FONT_PATH,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";
import { Vector3 } from "three";

const PATH_POINT_COUNT = 44;
const PARTICLE_LABEL_SURFACE_OFFSET_RATIO = 1.04;

const ELECTRON_PATH = createQuadraticPath(
  new Vector3(-2.35, 0, 0),
  new Vector3(-0.25, 0.12, 0),
  new Vector3(2.3, 0.82, 0)
);
const NEUTRON_PATH = createPath(
  PATH_POINT_COUNT,
  (progress) => new Vector3(-2.35 + 4.65 * progress, 0, 0)
);
const PROTON_PATH = createQuadraticPath(
  new Vector3(-2.35, 0, 0),
  new Vector3(-0.25, -0.12, 0),
  new Vector3(2.3, -0.82, 0)
);

const CHARGE_PARTICLES = [
  { color: "electron", label: "e^-", path: ELECTRON_PATH, progress: 0.62 },
  { color: "neutral", label: "n^0", path: NEUTRON_PATH, progress: 0.52 },
  { color: "proton", label: "p^+", path: PROTON_PATH, progress: 0.62 },
] satisfies {
  color: keyof Pick<
    SubatomicParticlePropertiesColors,
    "electron" | "neutral" | "proton"
  >;
  label: string;
  path: Vector3[];
  progress: number;
}[];

const MASS_BARS = [
  { color: "proton", height: 1.16, label: "proton", x: -1.45 },
  { color: "neutron", height: 1.18, label: "neutron", x: 0 },
  { color: "electron", height: 0.16, label: "electron", x: 1.45 },
] satisfies {
  color: keyof Pick<
    SubatomicParticlePropertiesColors,
    "electron" | "neutron" | "proton"
  >;
  height: number;
  label: keyof Pick<
    SubatomicParticlePropertiesSceneLabels,
    "electron" | "neutron" | "proton"
  >;
  x: number;
}[];

const NUCLEUS_PARTICLES = [
  { color: "proton", label: "p^+", position: new Vector3(-0.38, 0.26, 0.15) },
  { color: "neutron", label: "n^0", position: new Vector3(0.38, 0.26, -0.05) },
  { color: "neutron", label: "n^0", position: new Vector3(-0.38, -0.3, 0) },
  { color: "proton", label: "p^+", position: new Vector3(0.38, -0.3, 0.15) },
] satisfies {
  color: keyof Pick<SubatomicParticlePropertiesColors, "neutron" | "proton">;
  label: string;
  position: Vector3;
}[];

const ELECTRON_POSITIONS = [
  new Vector3(-1.2, 0.92, 0.2),
  new Vector3(1.18, 0.68, 0.1),
  new Vector3(1.3, -0.76, -0.12),
];

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
 * Generates a smooth schematic path for electric-field deflection.
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
 * Chooses the active 3D scene without mounting hidden property views.
 */
export function SubatomicParticlePropertiesScene({
  colors,
  labels,
  modeId,
}: {
  colors: SubatomicParticlePropertiesColors;
  labels: SubatomicParticlePropertiesSceneLabels;
  modeId: SubatomicParticlePropertiesModeId;
}) {
  if (modeId === CHARGE_MODE_ID) {
    return <ChargeScene colors={colors} labels={labels} />;
  }

  if (modeId === MASS_MODE_ID) {
    return <MassScene colors={colors} labels={labels} />;
  }

  if (modeId === LOCATION_MODE_ID) {
    return <LocationScene colors={colors} labels={labels} />;
  }

  return null;
}

/**
 * Shows how charge sign controls deflection in an electric field.
 */
function ChargeScene({
  colors,
  labels,
}: {
  colors: SubatomicParticlePropertiesColors;
  labels: SubatomicParticlePropertiesSceneLabels;
}) {
  return (
    <group>
      <Plate color={colors.positivePlate} label={labels.positivePlate} y={1} />
      <Plate color={colors.negativePlate} label={labels.negativePlate} y={-1} />

      <Line color={colors.electronPath} lineWidth={5} points={ELECTRON_PATH} />
      <Line color={colors.text} lineWidth={3} points={NEUTRON_PATH} />
      <Line color={colors.protonPath} lineWidth={5} points={PROTON_PATH} />

      {CHARGE_PARTICLES.map((particle) => (
        <Particle
          color={colors[particle.color]}
          key={particle.label}
          label={particle.label}
          labelColor={colors.sphereText}
          position={getPathPoint(particle.path, particle.progress)}
          radius={0.14}
        />
      ))}

      <SceneLabel
        color={colors.text}
        fontSize={THREE_FONT_SIZE.compact}
        position={[2.48, 0.82, 0.24]}
      >
        {labels.electron}
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize={THREE_FONT_SIZE.compact}
        position={[2.48, 0.08, 0.24]}
      >
        {labels.neutron}
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize={THREE_FONT_SIZE.compact}
        position={[2.48, -0.82, 0.24]}
      >
        {labels.proton}
      </SceneLabel>
    </group>
  );
}

/**
 * Shows proton and neutron masses as nearly equal, with electron mass far lower.
 */
function MassScene({
  colors,
  labels,
}: {
  colors: SubatomicParticlePropertiesColors;
  labels: SubatomicParticlePropertiesSceneLabels;
}) {
  return (
    <group position={[0, -0.15, 0]}>
      {MASS_BARS.map((bar) => (
        <group key={bar.label} position={[bar.x, 0, 0]}>
          <RoundedBox
            args={[0.52, bar.height, 0.52]}
            position={[0, bar.height / 2 - 0.48, 0]}
            radius={0.08}
            smoothness={4}
          >
            <meshStandardMaterial color={colors[bar.color]} roughness={0.42} />
          </RoundedBox>
          <SceneLabel
            color={colors.text}
            fontSize={THREE_FONT_SIZE.compact}
            position={[0, -0.88, 0.38]}
          >
            {labels[bar.label]}
          </SceneLabel>
        </group>
      ))}
    </group>
  );
}

/**
 * Shows the compact nucleus and the wider electron region.
 */
function LocationScene({
  colors,
  labels,
}: {
  colors: SubatomicParticlePropertiesColors;
  labels: SubatomicParticlePropertiesSceneLabels;
}) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.48, 48, 24]} />
        <meshStandardMaterial
          color={colors.electron}
          opacity={0.08}
          transparent
          wireframe
        />
      </mesh>
      <ElectronRegionRing colors={colors} rotation={[Math.PI / 2, 0, 0]} />
      <ElectronRegionRing
        colors={colors}
        rotation={[Math.PI / 2.5, 0, Math.PI / 3.2]}
      />

      {NUCLEUS_PARTICLES.map((particle) => (
        <Particle
          color={colors[particle.color]}
          key={`${particle.color}-${particle.position.x}-${particle.position.y}`}
          label={particle.label}
          labelColor={colors.sphereText}
          position={particle.position}
          radius={0.18}
        />
      ))}

      {ELECTRON_POSITIONS.map((position) => (
        <Particle
          color={colors.electron}
          key={`electron-${position.x}-${position.y}`}
          label="e^-"
          labelColor={colors.sphereText}
          position={position}
          radius={0.14}
        />
      ))}

      <SceneLabel
        color={colors.text}
        fontSize={THREE_FONT_SIZE.compact}
        position={[0, -0.74, 0.82]}
      >
        {labels.nucleus}
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize={THREE_FONT_SIZE.compact}
        position={[0, 1.7, 0.18]}
      >
        {labels.electronRegion}
      </SceneLabel>
    </group>
  );
}

/**
 * Renders one electric plate with a clear label.
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
    <group position={[0, y, 0]}>
      <RoundedBox args={[2.35, 0.14, 0.14]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={color} roughness={0.4} />
      </RoundedBox>
      <SceneLabel
        color={color}
        fontSize={THREE_FONT_SIZE.compact}
        position={[0, y > 0 ? 0.28 : -0.28, 0.2]}
      >
        {label}
      </SceneLabel>
    </group>
  );
}

/**
 * Renders a thin guide for the electron region, not a fixed orbit.
 */
function ElectronRegionRing({
  colors,
  rotation,
}: {
  colors: SubatomicParticlePropertiesColors;
  rotation: [number, number, number];
}) {
  return (
    <mesh rotation={rotation}>
      <torusGeometry args={[1.48, 0.01, 12, 96]} />
      <meshStandardMaterial color={colors.text} opacity={0.2} transparent />
    </mesh>
  );
}

/**
 * Reads a representative point from a generated path.
 */
function getPathPoint(path: Vector3[], progress: number) {
  const index = Math.round((path.length - 1) * progress);

  return path[index];
}

/**
 * Renders one labeled particle with the symbol on the camera-facing surface.
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
      <Billboard>
        <Text
          anchorX="center"
          anchorY="middle"
          color={labelColor}
          font={MONO_FONT_PATH}
          fontSize={getThreeParticleLabelFontSize(radius)}
          position={[0, 0, radius * PARTICLE_LABEL_SURFACE_OFFSET_RATIO]}
          renderOrder={10}
        >
          {label}
          <meshBasicMaterial
            color={labelColor}
            depthTest={false}
            toneMapped={false}
          />
        </Text>
      </Billboard>
    </group>
  );
}
