import { useFrame } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  CatmullRomCurve3,
  DoubleSide,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Benchtop Z plane for the saponification apparatus. */
export const KETTLE_Z = 0.06;

/** Inner/outer working radius of the steam-jacketed kettle in metres. */
export const KETTLE_RADIUS = 0.132;

const LEG_ANGLES = [0, 1, 2, 3] as const;
const BOLT_INDICES = Arr.range(0, 11);
const NOZZLE_INDICES = Arr.range(0, 11);

/** 240-degree dished stainless kettle wall leaving a 120-degree front cutaway facing +Z. */
function buildKettleShellGeometry(): LatheGeometry {
  const points = Arr.map(
    [
      [0.002, 0.088],
      [0.055, 0.09],
      [0.104, 0.104],
      [KETTLE_RADIUS, 0.128],
      [KETTLE_RADIUS + 0.008, 0.138],
      [KETTLE_RADIUS + 0.008, 0.255],
      [KETTLE_RADIUS, 0.262],
      [KETTLE_RADIUS, 0.338],
      [KETTLE_RADIUS + 0.012, 0.342],
      [KETTLE_RADIUS + 0.012, 0.35],
      [KETTLE_RADIUS - 0.004, 0.35],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(points, 48, Math.PI / 3, (4 * Math.PI) / 3);
}

/** Curved stainless NaOH alkali supply pipe from benchtop manifold over the kettle rim. */
function buildAlkaliPipeGeometry(): TubeGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.235, 0.015, KETTLE_Z),
    new Vector3(-0.235, 0.35, KETTLE_Z),
    new Vector3(-0.21, 0.395, KETTLE_Z),
    new Vector3(-0.125, 0.392, KETTLE_Z),
    new Vector3(-0.072, 0.355, KETTLE_Z),
  ]);
  return new TubeGeometry(curve, 44, 0.0075, 14, false);
}

/** Curved twin anchor-blade stirring paddle inside the dished kettle. */
function buildAnchorBladeGeometry(): TubeGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.095, 0.145, 0),
    new Vector3(-0.102, 0.06, 0),
    new Vector3(-0.068, 0.012, 0),
    new Vector3(0, 0.002, 0),
    new Vector3(0.068, 0.012, 0),
    new Vector3(0.102, 0.06, 0),
    new Vector3(0.095, 0.145, 0),
  ]);
  return new TubeGeometry(curve, 44, 0.006, 12, false);
}

/**
 * Steam-jacketed stainless saponification kettle with 120-degree borosilicate
 * cutaway window, quad support legs, copper steam ring, top motor bridge,
 * and left NaOH alkali feed pipe with brass valve wheel.
 */
export function KettleVessel() {
  const shellGeo = useMemo(buildKettleShellGeometry, []);
  const pipeGeo = useMemo(buildAlkaliPipeGeometry, []);

  useEffect(
    () => () => {
      shellGeo.dispose();
      pipeGeo.dispose();
    },
    [pipeGeo, shellGeo]
  );

  return (
    <group>
      <group position={[0, 0, KETTLE_Z]}>
        {Arr.map(LEG_ANGLES, (index) => {
          const angle = (index * Math.PI) / 2 + Math.PI / 4;
          const x = Math.cos(angle) * 0.118;
          const z = Math.sin(angle) * 0.118;
          return (
            <group key={index}>
              <mesh castShadow position={[x, 0.068, z]} receiveShadow>
                <cylinderGeometry args={[0.008, 0.0095, 0.136, 14]} />
                <MetalMaterial color={CAR_COLORS.castIron} roughness={0.45} />
              </mesh>
              <mesh position={[x, 0.004, z]} receiveShadow>
                <cylinderGeometry args={[0.015, 0.016, 0.008, 16]} />
                <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.6} />
              </mesh>
            </group>
          );
        })}
        <mesh position={[0, 0.044, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.088, 0.009, 14, 40]} />
          <MetalMaterial color={INSTRUMENT_COLORS.copper} roughness={0.32} />
        </mesh>
        {Arr.map(NOZZLE_INDICES, (index) => {
          const angle = (index / NOZZLE_INDICES.length) * Math.PI * 2;
          return (
            <mesh
              key={index}
              position={[
                Math.cos(angle) * 0.088,
                0.056,
                Math.sin(angle) * 0.088,
              ]}
            >
              <sphereGeometry args={[0.0048, 10, 8]} />
              <meshStandardMaterial
                color={BENCH_COLORS.coalGlow}
                emissive={BENCH_COLORS.coalGlow}
                emissiveIntensity={1.4}
                roughness={0.3}
              />
            </mesh>
          );
        })}
        <mesh castShadow geometry={shellGeo} receiveShadow>
          <meshPhysicalMaterial
            color={BENCH_COLORS.panSteel}
            metalness={0.92}
            roughness={0.28}
            side={DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.348, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[KETTLE_RADIUS + 0.006, 0.007, 12, 48]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.36} />
        </mesh>
        {Arr.map(BOLT_INDICES, (index) => {
          const angle = (index / BOLT_INDICES.length) * Math.PI * 2;
          return (
            <mesh
              key={index}
              position={[
                Math.cos(angle) * (KETTLE_RADIUS + 0.006),
                0.356,
                Math.sin(angle) * (KETTLE_RADIUS + 0.006),
              ]}
            >
              <cylinderGeometry args={[0.0035, 0.0035, 0.005, 6]} />
              <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.232, 0]}>
          <cylinderGeometry
            args={[
              KETTLE_RADIUS - 0.001,
              KETTLE_RADIUS - 0.001,
              0.224,
              32,
              1,
              true,
              -Math.PI / 3,
              (2 * Math.PI) / 3,
            ]}
          />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.18} />
        </mesh>
        <mesh castShadow position={[0, 0.362, 0]}>
          <boxGeometry args={[0.29, 0.014, 0.036]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[0, 0.405, 0]}>
          <cylinderGeometry args={[0.028, 0.03, 0.072, 24]} />
          <MetalMaterial color={CAR_COLORS.carPaintDark} roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.445, 0]}>
          <cylinderGeometry args={[0.022, 0.028, 0.014, 24]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[-0.235, 0.008, KETTLE_Z]} receiveShadow>
        <cylinderGeometry args={[0.026, 0.03, 0.016, 20]} />
        <MetalMaterial color={CAR_COLORS.rimDark} roughness={0.55} />
      </mesh>
      <mesh castShadow geometry={pipeGeo}>
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.26} />
      </mesh>
      <group position={[-0.175, 0.412, KETTLE_Z]}>
        <mesh position={[0, -0.009, 0]}>
          <cylinderGeometry args={[0.0035, 0.0035, 0.016, 10]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.014, 0.0025, 8, 20]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.026, 0.0025, 0.0025]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
      </group>
    </group>
  );
}

/** Rotating chrome drive shaft and curved anchor-blade stirring paddles. */
export function AnchorAgitator({
  playing,
  spinning,
}: {
  readonly playing: boolean;
  readonly spinning: boolean;
}) {
  const rotorRef = useRef<Group>(null);
  const bladeGeo = useMemo(buildAnchorBladeGeometry, []);

  useEffect(() => () => bladeGeo.dispose(), [bladeGeo]);

  useFrame((_, delta) => {
    if (!(playing && spinning) || rotorRef.current === null) {
      return;
    }
    rotorRef.current.rotation.y += simulationStep(delta) * 2.1;
  });

  return (
    <group position={[0, 0.125, KETTLE_Z]} ref={rotorRef}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.24, 16]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
      </mesh>
      <mesh geometry={bladeGeo}>
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.095, 0]}>
        <boxGeometry args={[0.19, 0.009, 0.006]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.24} />
      </mesh>
    </group>
  );
}
