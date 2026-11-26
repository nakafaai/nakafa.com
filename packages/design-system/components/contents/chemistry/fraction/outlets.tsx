import {
  Flask,
  FlaskLiquid,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  ALL_FRACTIONS,
  benchTrayY,
  COLUMN_RADIUS,
  fractionHex,
  RIG_Z,
} from "@repo/design-system/components/contents/chemistry/fraction/furnace";
import type { PetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import { evaluatePetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/** Curved stainless outlet pipe exiting one tray level with a brass valve wheel. */
function TrayOutletPipe({
  active,
  fraction,
  y,
}: {
  readonly active: boolean;
  readonly fraction: PetroleumFraction;
  readonly y: number;
}) {
  const hex = fractionHex(fraction);
  const pipeGeo = useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(COLUMN_RADIUS - 0.002, y, RIG_Z),
      new Vector3(0.14, y, RIG_Z),
      new Vector3(0.185, y - 0.008, RIG_Z),
      new Vector3(0.215, y - 0.018, RIG_Z),
    ]);
    return new TubeGeometry(curve, 24, active ? 0.0072 : 0.0052, 12, false);
  }, [active, y]);

  useEffect(() => () => pipeGeo.dispose(), [pipeGeo]);

  return (
    <group>
      <mesh castShadow geometry={pipeGeo}>
        <MetalMaterial
          color={active ? BENCH_COLORS.panSteel : CAR_COLORS.castIron}
          roughness={active ? 0.22 : 0.38}
        />
      </mesh>
      <mesh
        position={[COLUMN_RADIUS + 0.005, y, RIG_Z]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.013, 0.013, 0.006, 16]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.44} />
      </mesh>
      <mesh position={[0.182, y - 0.007, RIG_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0095, 0.0095, 0.014, 16]} />
        <meshStandardMaterial
          color={hex}
          emissive={active ? hex : CAR_COLORS.dashboard}
          emissiveIntensity={active ? 0.7 : 0}
          roughness={0.3}
        />
      </mesh>
      <group position={[0.145, y + 0.014, RIG_Z]}>
        <mesh position={[0, -0.006, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.014, 10]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.012, 0.0022, 8, 20]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.022, 0.0022, 0.0022]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.022, 0.0022, 0.0022]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Five flanged condenser outlet pipes with brass valve handwheels plus a
 * curved condensing feed line into the benchtop receiver Erlenmeyer flask.
 */
export function OutletRack({
  activeFraction,
}: {
  readonly activeFraction: PetroleumFraction;
}) {
  const activeLevel = evaluatePetroleumFraction(activeFraction);
  const activeY = benchTrayY(activeLevel.trayY);
  const activeHex = fractionHex(activeFraction);

  const dropTubeGeo = useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(0.214, activeY - 0.018, RIG_Z),
      new Vector3(0.262, activeY - 0.032, RIG_Z),
      new Vector3(0.288, Math.max(0.175, activeY - 0.075), RIG_Z),
      new Vector3(0.292, 0.146, RIG_Z),
    ]);
    return new TubeGeometry(curve, 32, 0.0046, 12, false);
  }, [activeY]);

  useEffect(() => () => dropTubeGeo.dispose(), [dropTubeGeo]);

  return (
    <group>
      {Arr.map(ALL_FRACTIONS, (id) => {
        const level = evaluatePetroleumFraction(id);
        return (
          <TrayOutletPipe
            active={id === activeFraction}
            fraction={id}
            key={id}
            y={benchTrayY(level.trayY)}
          />
        );
      })}
      <mesh geometry={dropTubeGeo}>
        <meshPhysicalMaterial
          clearcoat={1}
          color={activeHex}
          emissive={activeHex}
          emissiveIntensity={0.35}
          opacity={0.85}
          roughness={0.14}
          transparent
        />
      </mesh>
      <group position={[0.292, 0, RIG_Z]}>
        <mesh position={[0, 0.003, 0]} receiveShadow>
          <boxGeometry args={[0.125, 0.006, 0.125]} />
          <meshStandardMaterial
            color={BENCH_COLORS.ceramicTile}
            roughness={0.4}
          />
        </mesh>
        <group position={[0, 0.006, 0]}>
          <Flask />
          <FlaskLiquid color={activeHex} level={0.058} opacity={0.82} />
        </group>
      </group>
    </group>
  );
}
