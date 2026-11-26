import { sampleBoltzmann } from "@repo/design-system/components/contents/chemistry/collision/model";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  ShapeGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

const HOTPLATE_FEET = [
  [-0.082, 0.088],
  [0.082, 0.088],
  [-0.082, -0.088],
  [0.082, -0.088],
] as const;

const BEAKER_GRADUATIONS = [
  { major: true, y: 0.026 },
  { major: false, y: 0.039 },
  { major: true, y: 0.052 },
  { major: false, y: 0.065 },
  { major: true, y: 0.078 },
  { major: false, y: 0.091 },
  { major: true, y: 0.104 },
] as const;

const PLOT_W = 0.22;
const PLOT_H = 0.125;
const EA_RATIO = 0.62;

/** Builds the sloped housing of a benchtop magnetic-stirrer hotplate. */
function createHotplateHousing() {
  const side = new Shape();
  side.moveTo(-0.112, 0);
  side.lineTo(0.112, 0);
  side.lineTo(0.112, 0.022);
  side.lineTo(0.058, 0.06);
  side.lineTo(-0.112, 0.06);
  side.closePath();
  const geometry = new ExtrudeGeometry(side, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    depth: 0.198,
  });
  geometry.translate(0, 0, -0.099);
  return geometry;
}

/** Builds a 250 mL graduated borosilicate beaker with flared pouring lip. */
function createBeakerGeometry() {
  const profile = Arr.map(
    [
      [0.0008, 0],
      [0.045, 0],
      [0.0485, 0.0045],
      [0.0485, 0.125],
      [0.0518, 0.131],
      [0.051, 0.1325],
      [0.0468, 0.126],
      [0.0468, 0.0055],
      [0.0435, 0.0025],
      [0.0008, 0.0025],
    ] as const,
    ([radius, y]) => new Vector2(radius, y)
  );
  return new LatheGeometry(profile, 64);
}

/**
 * A benchtop magnetic-stirrer hotplate standing on y = 0: sloped enameled body,
 * recessed ceramic heating deck glowing proportionally with `heatNorm`,
 * rotating temperature knob, stir speed dial, and green power LED.
 */
export function Hotplate({
  heatNorm,
  playing,
}: {
  readonly heatNorm: number;
  readonly playing: boolean;
}) {
  const body = useMemo(createHotplateHousing, []);
  useEffect(() => () => body.dispose(), [body]);

  const tempKnobAngle = (-0.7 + heatNorm * 1.4) * Math.PI;
  const stirKnobAngle = playing ? 0.55 * Math.PI : -0.55 * Math.PI;

  return (
    <group>
      {Arr.map(HOTPLATE_FEET, ([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.003, z]}>
          <cylinderGeometry args={[0.01, 0.012, 0.006, 16]} />
          <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.85} />
        </mesh>
      ))}
      <mesh
        castShadow
        geometry={body}
        position={[0, 0.008, 0]}
        receiveShadow
        rotation={[0, -Math.PI / 2, 0]}
      >
        <meshPhysicalMaterial
          clearcoat={0.25}
          clearcoatRoughness={0.35}
          color={BENCH_COLORS.hotplateBody}
          roughness={0.48}
        />
      </mesh>
      {/* Recessed ceramic top plate surround */}
      <mesh castShadow position={[0, 0.068, -0.02]} receiveShadow>
        <cylinderGeometry args={[0.072, 0.074, 0.006, 48]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.42} />
      </mesh>
      {/* Glowing ceramic heating disc */}
      <mesh position={[0, 0.0715, -0.02]} receiveShadow>
        <cylinderGeometry args={[0.066, 0.066, 0.003, 48]} />
        <meshStandardMaterial
          color={BENCH_COLORS.ceramicTile}
          emissive={BENCH_COLORS.coalGlow}
          emissiveIntensity={0.04 + heatNorm * 1.35}
          roughness={0.35}
        />
      </mesh>
      {/* Inner heating ring glow indicator */}
      <mesh position={[0, 0.0732, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.044, 0.0022, 10, 48]} />
        <meshStandardMaterial
          color={BENCH_COLORS.coals}
          emissive={BENCH_COLORS.coalGlow}
          emissiveIntensity={heatNorm * 2.1}
          roughness={0.4}
        />
      </mesh>
      {/* Sloped front control console */}
      <group position={[0, 0.047, 0.088]} rotation={[0.62, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.168, 0.004, 0.044]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.55} />
        </mesh>
        {/* Left stir knob */}
        <group position={[-0.048, 0.009, 0]} rotation={[0, -stirKnobAngle, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.011, 0.0125, 0.014, 24]} />
            <meshStandardMaterial color={CAR_COLORS.hub} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.0074, -0.0045]}>
            <boxGeometry args={[0.0022, 0.0014, 0.008]} />
            <meshStandardMaterial
              color={BENCH_COLORS.ceramicTile}
              roughness={0.3}
            />
          </mesh>
        </group>
        {/* Right temperature knob */}
        <group position={[0.048, 0.009, 0]} rotation={[0, -tempKnobAngle, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.011, 0.0125, 0.014, 24]} />
            <meshStandardMaterial color={CAR_COLORS.hub} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.0074, -0.0045]}>
            <boxGeometry args={[0.0022, 0.0014, 0.008]} />
            <meshStandardMaterial
              color={BENCH_COLORS.coalGlow}
              emissive={BENCH_COLORS.coalGlow}
              emissiveIntensity={0.25 + heatNorm * 0.9}
              roughness={0.3}
            />
          </mesh>
        </group>
        {/* Power LED */}
        <mesh position={[0, 0.004, 0.002]}>
          <sphereGeometry args={[0.0032, 12, 12]} />
          <meshStandardMaterial
            color={BENCH_COLORS.phosphorGlow}
            emissive={BENCH_COLORS.phosphorGlow}
            emissiveIntensity={playing ? 1.5 : 0.45}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

/** A 250 mL graduated borosilicate beaker with enamel volume ticks. */
export function GraduatedBeaker() {
  const glass = useMemo(createBeakerGeometry, []);
  useEffect(() => () => glass.dispose(), [glass]);

  return (
    <group>
      <mesh castShadow geometry={glass} renderOrder={2}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.27} />
      </mesh>
      {Arr.map(BEAKER_GRADUATIONS, (tick) => (
        <mesh
          key={tick.y}
          position={[-0.014, tick.y, 0.0472]}
          rotation={[0, -0.28, 0]}
        >
          <boxGeometry args={[tick.major ? 0.013 : 0.0075, 0.0011, 0.0005]} />
          <meshBasicMaterial color={BENCH_COLORS.schellbachWhite} />
        </mesh>
      ))}
      <mesh position={[0.018, 0.066, 0.0458]} rotation={[0, 0.36, 0]}>
        <boxGeometry args={[0.016, 0.022, 0.0005]} />
        <meshStandardMaterial
          color={BENCH_COLORS.schellbachWhite}
          opacity={0.72}
          roughness={0.7}
          transparent
        />
      </mesh>
    </group>
  );
}

/**
 * Compact dark-anodised benchtop spectrometer display stand rendering a live
 * 3D Maxwell-Boltzmann kinetic energy distribution tube, activation energy rod,
 * and translucent shaded tail region for E >= Ea.
 */
export function BoltzmannStand({
  heatNorm,
  temperatureK,
}: {
  readonly heatNorm: number;
  readonly temperatureK: number;
}) {
  const { curveGeo, tailGeo } = useMemo(() => {
    const samples = sampleBoltzmann(temperatureK, 48);
    // Flatten peak slightly at higher T to keep area intuition clear.
    const heightScale = 0.72 + (1 - heatNorm) * 0.28;
    const x0 = -PLOT_W / 2;
    const y0 = -PLOT_H / 2 + 0.004;

    const points = Arr.map(
      samples,
      (pt) =>
        new Vector3(
          x0 + pt.energy * PLOT_W,
          y0 + pt.density * (PLOT_H - 0.014) * heightScale,
          0.0045
        )
    );
    const curve = new CatmullRomCurve3(points);
    const tube = new TubeGeometry(curve, 64, 0.0024, 10, false);

    const tail = Arr.filter(samples, (pt) => pt.aboveEa);
    const tailShape = new Shape();
    const eaX = x0 + EA_RATIO * PLOT_W;
    tailShape.moveTo(eaX, y0);
    for (const pt of tail) {
      tailShape.lineTo(
        x0 + pt.energy * PLOT_W,
        y0 + pt.density * (PLOT_H - 0.014) * heightScale
      );
    }
    tailShape.lineTo(x0 + PLOT_W, y0);
    tailShape.closePath();
    const shaded = new ShapeGeometry(tailShape);

    return { curveGeo: tube, tailGeo: shaded };
  }, [heatNorm, temperatureK]);

  useEffect(
    () => () => {
      curveGeo.dispose();
      tailGeo.dispose();
    },
    [curveGeo, tailGeo]
  );

  const eaX = -PLOT_W / 2 + EA_RATIO * PLOT_W;
  const gridY = [-0.02, 0.015, 0.05] as const;

  return (
    <group>
      {/* Weighted anodised base */}
      <mesh castShadow position={[0, 0.007, 0]} receiveShadow>
        <boxGeometry args={[0.24, 0.014, 0.088]} />
        <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.46} />
      </mesh>
      {/* Side support pillars */}
      {Arr.map([-0.085, 0.085] as const, (x) => (
        <mesh castShadow key={x} position={[x, 0.032, -0.006]}>
          <cylinderGeometry args={[0.005, 0.006, 0.044, 16]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
        </mesh>
      ))}
      {/* Tilted dark spectrometer screen bezel */}
      <group position={[0, 0.122, -0.004]} rotation={[-0.08, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.272, 0.172, 0.014]} />
          <MetalMaterial color={CAR_COLORS.dashboard} roughness={0.44} />
        </mesh>
        {/* Brushed aluminium top & bottom trim bars */}
        <mesh position={[0, 0.087, 0]}>
          <boxGeometry args={[0.274, 0.004, 0.016]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
        <mesh position={[0, -0.087, 0]}>
          <boxGeometry args={[0.274, 0.004, 0.016]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
        {/* Recessed screen face */}
        <mesh position={[0, 0, 0.0072]}>
          <planeGeometry args={[0.25, 0.15]} />
          <meshStandardMaterial
            color={BENCH_COLORS.meterHalo}
            roughness={0.35}
          />
        </mesh>
        {/* Subtle horizontal reference grid lines */}
        {Arr.map(gridY, (y) => (
          <mesh key={y} position={[0, y, 0.0078]}>
            <boxGeometry args={[PLOT_W, 0.0008, 0.0004]} />
            <meshBasicMaterial color={BENCH_COLORS.meterBody} />
          </mesh>
        ))}
        {/* Axes */}
        <mesh position={[0, -PLOT_H / 2 + 0.004, 0.0085]}>
          <boxGeometry args={[PLOT_W + 0.008, 0.0022, 0.0018]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.35} />
        </mesh>
        <mesh position={[-PLOT_W / 2, 0.002, 0.0085]}>
          <boxGeometry args={[0.0022, PLOT_H, 0.0018]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.35} />
        </mesh>
        {/* Shaded E >= Ea tail area */}
        <mesh geometry={tailGeo} position={[0, 0, 0.0082]}>
          <meshStandardMaterial
            color={KINETICS_COLORS.shadedArea}
            emissive={KINETICS_COLORS.shadedArea}
            emissiveIntensity={0.28}
            opacity={0.58}
            roughness={0.35}
            side={DoubleSide}
            transparent
          />
        </mesh>
        {/* Live Maxwell-Boltzmann tube curve */}
        <mesh geometry={curveGeo} position={[0, 0, 0.0065]}>
          <meshStandardMaterial
            color={KINETICS_COLORS.reactant}
            emissive={KINETICS_COLORS.reactant}
            emissiveIntensity={0.32}
            roughness={0.25}
          />
        </mesh>
        {/* Vertical amber activation-energy threshold rod */}
        <mesh position={[eaX, 0.002, 0.011]}>
          <cylinderGeometry args={[0.0018, 0.0018, PLOT_H + 0.004, 12]} />
          <meshStandardMaterial
            color={KINETICS_COLORS.activationLine}
            emissive={KINETICS_COLORS.activationLine}
            emissiveIntensity={0.5}
            roughness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}
