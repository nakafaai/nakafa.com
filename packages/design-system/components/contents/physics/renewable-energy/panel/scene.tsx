import { mix } from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  cellTemperature,
  IRRADIANCE,
  panelBalance,
} from "@repo/design-system/components/contents/physics/renewable-energy/panel/balance";
import {
  Beam,
  Parcels,
  Pipe,
  Puffs,
} from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

/** The roof's pitch, in radians. */
const PITCH = (24 * Math.PI) / 180;

/** The thickest beam, drawn for 1600 W, in metres. */
const WIDEST = 0.16;

/** The house's gable roof in profile, extruded along the ridge. */
function useRoof() {
  return useMemo(() => {
    const gable = new Shape();
    gable.moveTo(-2.6, 0);
    gable.lineTo(0, Math.tan(PITCH) * 2.6);
    gable.lineTo(2.6, 0);
    gable.closePath();
    const roof = new ExtrudeGeometry(gable, { bevelEnabled: false, depth: 5 });
    roof.translate(0, 2.6, -2.5);
    return roof;
  }, []);
}

/**
 * A house with a solar panel on its sunny roof slope. Sunlight comes in as a
 * thick amber beam, a thin slate beam bounces off the glass, warm air
 * shimmers up from the cells as they heat, and the current runs down the
 * cable to the inverter: the three outputs always add back to the input.
 */
export function PanelScene({
  colors,
  irradiance,
}: {
  readonly colors: Readonly<{
    electric: string;
    heat: string;
    input: string;
    reflected: string;
  }>;
  readonly irradiance: number;
}) {
  const roof = useRoof();
  const balance = panelBalance(irradiance);
  const warmth =
    (cellTemperature(irradiance) - cellTemperature(IRRADIANCE.min)) /
    (cellTemperature(IRRADIANCE.max) - cellTemperature(IRRADIANCE.min));
  const width = (power: number) => Math.max((power / 1600) * WIDEST, 0.012);
  const slope = { x: -1.3, y: 2.6 + Math.tan(PITCH) * 1.3 };

  return (
    <group>
      <mesh castShadow position={[0, 1.3, 0]} receiveShadow>
        <boxGeometry args={[5, 2.6, 4.6]} />
        <meshStandardMaterial color={MATERIAL.wallPlaster} roughness={0.9} />
      </mesh>
      <mesh castShadow geometry={roof} receiveShadow>
        <meshStandardMaterial color={MATERIAL.roofTerracotta} roughness={0.8} />
      </mesh>
      <group position={[slope.x, slope.y + 0.06, 0]} rotation={[0, 0, PITCH]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.05, 1.75]} />
          <MetalMaterial color={MATERIAL.solarFrame} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.98, 0.012, 1.66]} />
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.05}
            color={mix(
              MATERIAL.solarCell,
              getColor("SLATE", 600),
              warmth * 0.25
            )}
            roughness={0.25}
          />
        </mesh>
      </group>
      <Beam
        color={colors.input}
        from={[-4.2, 6.6, 0]}
        radius={width(balance.input)}
        to={[slope.x - 0.1, slope.y + 0.2, 0]}
      />
      <Beam
        color={colors.reflected}
        from={[slope.x + 0.1, slope.y + 0.2, 0]}
        radius={width(balance.reflected)}
        to={[0.6, 5.6, 0.4]}
      />
      <Puffs
        amount={balance.heat / 1600}
        at={[slope.x, slope.y + 0.2, 0]}
        color={colors.heat}
        rise={1.8}
        size={0.22}
      />
      <Pipe
        from={[slope.x - 0.5, slope.y - 0.2, 0.9]}
        radius={0.02}
        to={[-2.55, 1.4, 0.9]}
      >
        <meshStandardMaterial color={MATERIAL.tyre} roughness={0.7} />
      </Pipe>
      <Parcels
        color={colors.electric}
        count={Math.max(2, Math.round((balance.electric / 274) * 6))}
        from={[slope.x - 0.5, slope.y - 0.2, 0.9]}
        pace={0.4}
        size={0.045}
        to={[-2.55, 1.4, 0.9]}
      />
      <mesh castShadow position={[-2.62, 1.2, 0.9]}>
        <boxGeometry args={[0.12, 0.45, 0.35]} />
        <meshStandardMaterial color={getColor("SLATE", 300)} roughness={0.6} />
      </mesh>
    </group>
  );
}
