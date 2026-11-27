import { useFrame, useThree } from "@react-three/fiber";
import type { QuotientDirection } from "@repo/design-system/components/contents/chemistry/quotient/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { Turn } from "@repo/design-system/components/three/form/part";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { TABLE_COLORS } from "@repo/design-system/lib/material/table";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** A bell jar's glass in section: a ground foot, a straight wall, a dome, and the knob it is lifted by. */
const BELL_JAR = [
  [0.56, 0.08],
  [0.56, 0.1],
  [0.5, 0.115],
  [0.5, 0.82],
  [0.47, 0.96],
  [0.38, 1.07],
  [0.24, 1.14],
  [0.09, 1.17],
  [0.045, 1.19],
  [0.075, 1.225],
  [0.09, 1.26],
  [0.06, 1.295],
  [0, 1.3],
] as const;

/** The jar's turned hardwood base, with a groove the jar's foot seats in. */
const JAR_BASE = [
  [0, 0],
  [0.64, 0],
  [0.665, 0.012],
  [0.665, 0.05],
  [0.64, 0.075],
  [0.6, 0.082],
  [0, 0.082],
] as const;

/** The balance's turned brass column, from its foot to the fork that carries the beam. */
const COLUMN = [
  [0, 0.08],
  [0.11, 0.08],
  [0.115, 0.1],
  [0.075, 0.125],
  [0.05, 0.16],
  [0.042, 0.42],
  [0.058, 0.44],
  [0.058, 0.46],
  [0.04, 0.48],
  [0.034, 0.8],
  [0.05, 0.83],
  [0.05, 0.86],
  [0, 0.87],
] as const;

/** A balance pan in section: a shallow spun brass dish with a rolled rim. */
const PAN = [
  [0, 0],
  [0.16, 0.002],
  [0.205, 0.022],
  [0.215, 0.034],
  [0.208, 0.04],
  [0.19, 0.024],
  [0.15, 0.012],
  [0, 0.01],
] as const;

/** A turned brass weight with a knob, standing on a pan. */
const WEIGHT = [
  [0, 0],
  [0.07, 0],
  [0.075, 0.008],
  [0.075, 0.085],
  [0.068, 0.095],
  [0.03, 0.1],
  [0.022, 0.115],
  [0.036, 0.135],
  [0.03, 0.155],
  [0, 0.16],
] as const;

/** The polished brass of the balance. */
function Brass() {
  return (
    <MetalMaterial color={EQUILIBRIUM_COLORS.beamBrass} roughness={0.26} />
  );
}

/** How far each pan hangs from the beam's middle, and how far below the beam. */
const ARM = 0.54;
const DROP = 0.34;

function QuotientCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.1, 4.7] : [0, 1.5, 3.25]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.5}
    />
  );
}

export function QuotientBalanceScene({
  direction,
  productLabel,
  productRatio,
  reactantLabel,
  reactantRatio,
  tiltRad,
}: {
  readonly direction: QuotientDirection;
  readonly productLabel: string;
  readonly productRatio: number;
  readonly reactantLabel: string;
  readonly reactantRatio: number;
  readonly tiltRad: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const beamRef = useRef<Group>(null);
  const leftPan = useRef<Group>(null);
  const rightPan = useRef<Group>(null);
  const phaseRef = useRef(0);

  const reactantDots = useMemo(
    () =>
      Arr.makeBy(Math.max(1, Math.round(reactantRatio * 14)), (index) => ({
        id: `reactant-${index}`,
        x: Math.cos(index * 2.3) * 0.24,
        y: 0.2 + (index % 6) * 0.12,
        z: Math.sin(index * 2.3) * 0.24,
      })),
    [reactantRatio]
  );
  const productDots = useMemo(
    () =>
      Arr.makeBy(Math.round(productRatio * 14), (index) => ({
        id: `product-${index}`,
        x: Math.cos(index * 2.1 + 1.1) * 0.26,
        y: 0.24 + (index % 6) * 0.12,
        z: Math.sin(index * 2.1 + 1.1) * 0.26,
      })),
    [productRatio]
  );

  useFrame((_, delta) => {
    const beam = beamRef.current;
    if (beam === null) {
      return;
    }
    const dt = simulationStep(delta);
    if (playing) {
      phaseRef.current += dt * 2.2;
    }
    const wobble = playing ? Math.sin(phaseRef.current) * 0.035 : 0;
    beam.rotation.z +=
      (tiltRad + wobble - beam.rotation.z) * Math.min(1, dt * 8);
    // Each pan hangs from its knife edge, so it stays level as the beam tips.
    leftPan.current?.rotation.set(0, 0, -beam.rotation.z);
    rightPan.current?.rotation.set(0, 0, -beam.rotation.z);
  });

  const shiftColor = Match.value(direction).pipe(
    Match.when("equilibrium", () => EQUILIBRIUM_COLORS.balancedGlow),
    Match.when("forward", () => EQUILIBRIUM_COLORS.forwardArrow),
    Match.when("reverse", () => EQUILIBRIUM_COLORS.reverseArrow),
    Match.exhaustive
  );

  const pans = [
    { color: EQUILIBRIUM_COLORS.qcMarker, name: "Q_c", ref: leftPan, x: -ARM },
    { color: EQUILIBRIUM_COLORS.kcMarker, name: "K_c", ref: rightPan, x: ARM },
  ] as const;

  return (
    <group>
      <SimulationTicker running={playing} />
      <QuotientCamera />

      {/* The sealed reaction vessel: a bell jar on its base, holding the gas mixture. */}
      <group position={[-0.92, 0, 0]}>
        <mesh castShadow receiveShadow>
          <Turn profile={JAR_BASE} />
          <SurfaceMaterial
            bump={0.02}
            coat={0.6}
            color={TABLE_COLORS.walnut}
            repeat={[2, 1]}
            roughness={0.42}
            surface="wood"
          />
        </mesh>
        {Arr.map(reactantDots, (dot) => (
          <group
            key={dot.id}
            position={[dot.x, dot.y, dot.z]}
            rotation={[dot.y * 3, dot.x * 9, dot.z * 7]}
          >
            {Arr.map([-0.034, 0.034] as const, (x) => (
              <mesh castShadow key={x} position={[x, 0, 0]}>
                <sphereGeometry args={[0.046, 32, 24]} />
                <meshPhysicalMaterial
                  clearcoat={0.8}
                  clearcoatRoughness={0.1}
                  color={EQUILIBRIUM_COLORS.reactant}
                  roughness={0.28}
                />
              </mesh>
            ))}
          </group>
        ))}
        {Arr.map(productDots, (dot) => (
          <mesh castShadow key={dot.id} position={[dot.x, dot.y, dot.z]}>
            <sphereGeometry args={[0.05, 32, 24]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              clearcoatRoughness={0.1}
              color={EQUILIBRIUM_COLORS.product}
              roughness={0.28}
            />
          </mesh>
        ))}
        <mesh castShadow renderOrder={2}>
          <Turn profile={BELL_JAR} />
          <GlassMaterial color={EQUILIBRIUM_COLORS.vesselGlass} opacity={0.2} />
        </mesh>
        <ThreeLabel
          anchorY="bottom"
          color={EQUILIBRIUM_COLORS.reactant}
          fontSize="compact"
          gap={0.012}
          position={[0.2, 1.48, 0]}
        >
          {reactantLabel}
        </ThreeLabel>
        <ThreeLabel
          anchorY="top"
          color={EQUILIBRIUM_COLORS.product}
          fontSize="compact"
          gap={0.012}
          position={[0.2, 1.48, 0]}
        >
          {productLabel}
        </ThreeLabel>
      </group>

      {/* The two-pan balance that weighs the quotient against the constant. */}
      <group position={[0.72, 0, 0]}>
        <mesh castShadow position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[0.92, 0.08, 0.5]} />
          <SurfaceMaterial
            bump={0.02}
            coat={0.6}
            color={TABLE_COLORS.walnut}
            repeat={[1.4, 0.8]}
            roughness={0.42}
            surface="wood"
          />
        </mesh>
        <mesh castShadow>
          <Turn profile={COLUMN} />
          <Brass />
        </mesh>
        <group position={[0, 0.9, 0]} ref={beamRef}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.018, 0.018, ARM * 2 + 0.08, 24]} />
            <Brass />
          </mesh>
          <mesh castShadow position={[0, -0.012, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.045, 0.07, 4]} />
            <MetalMaterial
              color={EQUILIBRIUM_COLORS.panSteel}
              roughness={0.2}
            />
          </mesh>
          <mesh castShadow position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.004, 0.012, 0.14, 12]} />
            <MetalMaterial
              color={EQUILIBRIUM_COLORS.panSteel}
              roughness={0.2}
            />
          </mesh>
          {Arr.map(pans, (pan) => (
            <group key={pan.name} position={[pan.x, 0, 0]} ref={pan.ref}>
              <mesh castShadow>
                <sphereGeometry args={[0.026, 24, 16]} />
                <Brass />
              </mesh>
              {Arr.map([0, 1, 2] as const, (wire) => {
                const angle = (wire / 3) * Math.PI * 2 + 0.5;
                const out = 0.2;
                return (
                  <mesh
                    castShadow
                    key={wire}
                    position={[
                      (Math.cos(angle) * out) / 2,
                      -DROP / 2,
                      (Math.sin(angle) * out) / 2,
                    ]}
                    rotation={[
                      Math.atan2(out, DROP) * Math.sin(angle),
                      0,
                      Math.atan2(out, DROP) * Math.cos(angle),
                    ]}
                  >
                    <cylinderGeometry
                      args={[0.0035, 0.0035, Math.hypot(out, DROP), 8]}
                    />
                    <Brass />
                  </mesh>
                );
              })}
              <group position={[0, -DROP - 0.03, 0]}>
                <mesh castShadow receiveShadow>
                  <Turn profile={PAN} />
                  <Brass />
                </mesh>
                <mesh castShadow position={[0, 0.012, 0]}>
                  <Turn profile={WEIGHT} />
                  <meshPhysicalMaterial
                    clearcoat={0.9}
                    clearcoatRoughness={0.12}
                    color={pan.color}
                    roughness={0.3}
                  />
                </mesh>
              </group>
              <ThreeLabel
                anchorY="bottom"
                color={EQUILIBRIUM_COLORS.labelInk}
                maximumFontSize={26}
                minimumFontSize={22}
                position={[0, 0.1, 0]}
              >
                <InlineMath math={pan.name} />
              </ThreeLabel>
            </group>
          ))}
        </group>
        <mesh position={[0, 0.082, 0.19]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.05, 0.012, 16, 40]} />
          <Brass />
        </mesh>
        <mesh position={[0, 0.085, 0.19]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[0.046, 32, 20]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={shiftColor}
            emissive={shiftColor}
            emissiveIntensity={0.9}
            roughness={0.15}
          />
        </mesh>
      </group>
    </group>
  );
}
