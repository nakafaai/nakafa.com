import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Converts [radius, height] pairs into LatheGeometry Vector2 control points. */
function lathePoints(pairs: readonly (readonly [number, number])[]) {
  return Arr.map(pairs, ([radius, height]) => new Vector2(radius, height));
}

/** 120-degree front cutaway outer stainless steel calorimeter jacket. */
function buildOuterJacketGeometry() {
  const points = lathePoints([
    [0.062, 0.008],
    [0.067, 0.008],
    [0.068, 0.013],
    [0.068, 0.144],
    [0.066, 0.148],
    [0.062, 0.148],
    [0.062, 0.014],
    [0.062, 0.008],
  ]);
  return new LatheGeometry(points, 56, Math.PI / 3, (4 * Math.PI) / 3);
}

/** 104-degree front cutaway inner expanded polystyrene insulating cup. */
function buildInnerCupGeometry() {
  const points = lathePoints([
    [0.049, 0.016],
    [0.056, 0.016],
    [0.058, 0.14],
    [0.055, 0.143],
    [0.049, 0.143],
    [0.048, 0.022],
    [0.049, 0.016],
  ]);
  return new LatheGeometry(points, 56, 0.91, Math.PI * 2 - 1.82);
}

/** Beveled insulated dark neoprene calorimeter lid profile. */
function buildLidGeometry() {
  const points = lathePoints([
    [0.0006, 0],
    [0.065, 0],
    [0.071, 0.004],
    [0.071, 0.013],
    [0.067, 0.016],
    [0.0006, 0.016],
  ]);
  return new LatheGeometry(points, 56);
}

/** Tapered borosilicate laboratory thermometer stem and submerged bulb. */
function buildThermometerGlassGeometry() {
  const points = lathePoints([
    [0.0004, 0],
    [0.0038, 0.002],
    [0.0052, 0.008],
    [0.0052, 0.022],
    [0.0036, 0.029],
    [0.0038, 0.268],
    [0.0028, 0.274],
    [0.0004, 0.276],
  ]);
  return new LatheGeometry(points, 28);
}

/** Stainless-steel wire ring stirrer shaft looping into a circular stirring ring. */
function buildStirrerWireGeometry() {
  const ringY = 0.044;
  const ringR = 0.029;
  const segments = 20;
  const points = [
    new Vector3(0.029, 0.242, 0),
    new Vector3(0.029, 0.12, 0),
    new Vector3(0.029, ringY + 0.012, 0),
    ...Arr.makeBy(segments + 1, (step) => {
      const theta = (step / segments) * Math.PI * 2;
      return new Vector3(
        Math.cos(theta) * ringR,
        ringY,
        Math.sin(theta) * ringR
      );
    }),
  ];
  const curve = new CatmullRomCurve3(points);
  return new TubeGeometry(curve, 64, 0.0017, 10, false);
}

/** Sculpted 3D lathe thermal heat-transfer arrow pointing along +Y (rotate to aim). */
function buildHeatArrowGeometry() {
  const points = lathePoints([
    [0.0004, 0],
    [0.0075, 0],
    [0.0068, 0.006],
    [0.0054, 0.04],
    [0.0135, 0.04],
    [0.014, 0.043],
    [0.0004, 0.072],
  ]);
  return new LatheGeometry(points, 28);
}

/** Double-walled cutaway calorimeter vessel: stainless jacket, foam cup, neoprene lid. */
export function CalorimeterVessel() {
  const jacketGeo = useMemo(buildOuterJacketGeometry, []);
  const cupGeo = useMemo(buildInnerCupGeometry, []);
  const lidGeo = useMemo(buildLidGeometry, []);

  useEffect(
    () => () => {
      jacketGeo.dispose();
      cupGeo.dispose();
      lidGeo.dispose();
    },
    [cupGeo, jacketGeo, lidGeo]
  );

  const jacketEdges = [Math.PI / 3, -Math.PI / 3] as const;
  const cupEdges = [0.91, -0.91] as const;

  return (
    <group>
      {/* Rubber non-slip bench ring */}
      <mesh castShadow position={[0, 0.004, 0]} receiveShadow>
        <cylinderGeometry args={[0.068, 0.07, 0.008, 48]} />
        <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.85} />
      </mesh>
      {/* Solid inner cup floor */}
      <mesh position={[0, 0.014, 0]} receiveShadow>
        <cylinderGeometry args={[0.063, 0.063, 0.01, 48]} />
        <meshStandardMaterial
          color={PROCESS_COLORS.ceramicIvory}
          roughness={0.86}
        />
      </mesh>
      {/* Outer brushed stainless protective jacket with 120 deg cutaway */}
      <mesh castShadow geometry={jacketGeo} receiveShadow>
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.34} />
      </mesh>
      {Arr.map(jacketEdges, (angle) => (
        <mesh
          key={`j-${angle}`}
          position={[Math.sin(angle) * 0.065, 0.078, Math.cos(angle) * 0.065]}
          rotation={[0, angle, 0]}
        >
          <boxGeometry args={[0.002, 0.14, 0.006]} />
          <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.42} />
        </mesh>
      ))}
      {/* Inner expanded polystyrene insulating cup with cutaway */}
      <mesh castShadow geometry={cupGeo} receiveShadow>
        <meshStandardMaterial
          color={PROCESS_COLORS.ceramicIvory}
          roughness={0.88}
        />
      </mesh>
      {Arr.map(cupEdges, (angle) => (
        <mesh
          key={`c-${angle}`}
          position={[Math.sin(angle) * 0.053, 0.08, Math.cos(angle) * 0.053]}
          rotation={[0, angle, 0]}
        >
          <boxGeometry args={[0.002, 0.127, 0.008]} />
          <meshStandardMaterial color={BENCH_COLORS.dish} roughness={0.9} />
        </mesh>
      ))}
      {/* Insulated dark neoprene lid with two brass grommets */}
      <mesh castShadow geometry={lidGeo} position={[0, 0.143, 0]} receiveShadow>
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.78} />
      </mesh>
      {Arr.map(
        [
          [-0.02, 0.006],
          [0.029, 0],
        ] as const,
        ([gx, gz]) => (
          <group key={`${gx}-${gz}`} position={[gx, 0.159, gz]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.0068, 0.002, 12, 28]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
            </mesh>
            <mesh position={[0, -0.002, 0]}>
              <cylinderGeometry args={[0.0062, 0.0062, 0.005, 20]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.32} />
            </mesh>
          </group>
        )
      )}
    </group>
  );
}

/** Calibrated glass mercury/alcohol thermometer with enamel scale ticks. */
export function CalibratedThermometer({
  columnColor,
  columnTopY,
}: {
  readonly columnColor: string;
  readonly columnTopY: number;
}) {
  const glassGeo = useMemo(buildThermometerGlassGeometry, []);
  useEffect(() => () => glassGeo.dispose(), [glassGeo]);

  const ticks = Arr.makeBy(11, (index) => ({
    key: index,
    major: index % 2 === 0,
    y: 0.142 + index * 0.011,
  }));
  const columnHeight = Math.max(0.02, columnTopY - 0.022);

  return (
    <group>
      {/* Borosilicate glass bulb and stem */}
      <mesh castShadow geometry={glassGeo}>
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={BENCH_COLORS.glass}
          depthWrite={false}
          ior={1.473}
          opacity={0.32}
          roughness={0.06}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {/* Bulb fluid reservoir */}
      <mesh position={[0, 0.014, 0]}>
        <cylinderGeometry args={[0.004, 0.0036, 0.019, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={columnColor}
          roughness={0.14}
        />
      </mesh>
      {/* Capillary liquid column responding to temperature */}
      <mesh position={[0, 0.022 + columnHeight / 2, 0.0005]}>
        <cylinderGeometry args={[0.0014, 0.0014, columnHeight, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={columnColor}
          emissive={columnColor}
          emissiveIntensity={0.22}
          roughness={0.16}
        />
      </mesh>
      {/* White enamel backing strip behind the scale */}
      <mesh position={[0, 0.197, -0.0016]}>
        <boxGeometry args={[0.0052, 0.12, 0.0008]} />
        <meshStandardMaterial
          color={BENCH_COLORS.schellbachWhite}
          roughness={0.55}
        />
      </mesh>
      {/* Crisp graduation ticks on the enamel scale */}
      {Arr.map(ticks, (tick) => (
        <mesh key={tick.key} position={[0, tick.y, 0.0022]}>
          <boxGeometry args={[tick.major ? 0.0052 : 0.0032, 0.0008, 0.0004]} />
          <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
        </mesh>
      ))}
    </group>
  );
}

/** Reciprocating stainless-steel wire ring stirrer with knurled insulated grip. */
export function WireRingStirrer() {
  const wireGeo = useMemo(buildStirrerWireGeometry, []);
  useEffect(() => () => wireGeo.dispose(), [wireGeo]);

  return (
    <group>
      <mesh castShadow geometry={wireGeo}>
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.24} />
      </mesh>
      {/* Brass ferrule */}
      <mesh position={[0.029, 0.244, 0]}>
        <cylinderGeometry args={[0.0042, 0.0032, 0.008, 16]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>
      {/* Knurled insulated handle */}
      <mesh castShadow position={[0.029, 0.262, 0]}>
        <cylinderGeometry args={[0.0062, 0.0058, 0.03, 16]} />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.78} />
      </mesh>
      <mesh position={[0.029, 0.277, 0]}>
        <sphereGeometry args={[0.0062, 16, 12]} />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.74} />
      </mesh>
    </group>
  );
}

/** Sculpted 3D glowing thermal arrow scaled by enthalpy magnitude. */
export function ThermalArrow({
  color,
  emissiveIntensity,
  pointing,
  scale,
}: {
  readonly color: string;
  readonly emissiveIntensity: number;
  readonly pointing: "left" | "right";
  readonly scale: number;
}) {
  const geo = useMemo(buildHeatArrowGeometry, []);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <mesh
      castShadow
      geometry={geo}
      rotation={[0, 0, pointing === "right" ? -Math.PI / 2 : Math.PI / 2]}
      scale={scale}
    >
      <meshPhysicalMaterial
        clearcoat={0.65}
        clearcoatRoughness={0.18}
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.26}
      />
    </mesh>
  );
}
