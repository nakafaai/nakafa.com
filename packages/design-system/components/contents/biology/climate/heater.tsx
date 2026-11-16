import { RoundedBox } from "@react-three/drei";
import { TANK } from "@repo/design-system/components/contents/biology/climate/tank";
import { useReading } from "@repo/design-system/components/contents/simulation/quantity";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

/**
 * The titanium heater: a rod 8 mm thick and 19 cm long that stands 2.2 cm
 * off the back glass in the tank's right corner, in metres.
 */
const ROD = { length: 0.19, radius: 0.008, x: 0.255, z: -0.15 };

/** The controller on the bench beside the tank: where it stands and how big it is. */
const CONTROLLER = { size: [0.08, 0.1, 0.03], x: 0.37, z: 0.05 } as const;

/** Where the glass's inner face of the back pane stands. */
const BACK = -TANK.depth / 2 + TANK.glass / 2;

/**
 * A suction-cup holder: the clear cup pressed to the back glass, its arm and
 * the ring that grips the rod, at height `y`.
 */
function Holder({ y }: { readonly y: number }) {
  const reach = ROD.z - ROD.radius - BACK;
  return (
    <group position={[ROD.x, y, 0]}>
      <mesh position={[0, 0, BACK + 0.0016]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.009, 0.0075, 0.0032, 24]} />
        <GlassMaterial color={MATERIAL.glass} opacity={0.55} />
      </mesh>
      <mesh position={[0, 0, BACK + reach / 2 + 0.0016]}>
        <boxGeometry args={[0.005, 0.006, reach - 0.0016]} />
        <GlassMaterial color={MATERIAL.glass} opacity={0.6} />
      </mesh>
      <mesh position={[0, 0, ROD.z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ROD.radius + 0.0014, 0.0013, 10, 28]} />
        <GlassMaterial color={MATERIAL.glass} opacity={0.6} />
      </mesh>
    </group>
  );
}

/**
 * The heater standing in the water from `base`, its black cap and its cable,
 * which climbs out over the back glass, drops behind the tank and runs over
 * the bench to the controller. The controller shows the water's temperature.
 */
export function Heater({
  base,
  temperature,
}: {
  readonly base: number;
  readonly temperature: number;
}) {
  const reading = useReading();
  const top = base + ROD.length;
  const cable = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(
          [
            [ROD.x, top + 0.02, ROD.z],
            [ROD.x, TANK.height + 0.004, ROD.z - 0.012],
            [ROD.x, TANK.height + 0.008, -TANK.depth / 2 - 0.012],
            [ROD.x + 0.01, TANK.height - 0.06, -TANK.depth / 2 - 0.022],
            [ROD.x + 0.025, 0.0018, -TANK.depth / 2 - 0.03],
            [CONTROLLER.x, 0.0018, -0.07],
            [CONTROLLER.x, 0.0018, CONTROLLER.z - 0.03],
            [CONTROLLER.x, 0.02, CONTROLLER.z - CONTROLLER.size[2] / 2],
          ] as const,
          ([x, y, z]) => new Vector3(x, y, z)
        )
      ),
    [top]
  );
  return (
    <group>
      <mesh castShadow position={[ROD.x, base + ROD.length / 2, ROD.z]}>
        <capsuleGeometry
          args={[ROD.radius, ROD.length - ROD.radius * 2, 8, 24]}
        />
        <MetalMaterial color={MATERIAL.probeSteel} roughness={0.36} />
      </mesh>
      <mesh castShadow position={[ROD.x, top + 0.006, ROD.z]}>
        <cylinderGeometry
          args={[ROD.radius + 0.0016, ROD.radius + 0.0016, 0.03, 24]}
        />
        <meshPhysicalMaterial color={MATERIAL.leadBlack} roughness={0.55} />
      </mesh>
      <mesh castShadow>
        <tubeGeometry args={[cable, 160, 0.0018, 8, false]} />
        <meshPhysicalMaterial color={MATERIAL.leadBlack} roughness={0.5} />
      </mesh>
      <Holder y={base + 0.04} />
      <Holder y={base + ROD.length - 0.04} />
      <group position={[CONTROLLER.x, CONTROLLER.size[1] / 2, CONTROLLER.z]}>
        <RoundedBox args={[...CONTROLLER.size]} castShadow radius={0.008}>
          <meshStandardMaterial color={MATERIAL.meterBody} roughness={0.5} />
        </RoundedBox>
        <ThreeLabel
          color={MATERIAL.meterInk}
          fontSize="compact"
          outlineColor={MATERIAL.meterHalo}
          outlineWidth={0.003}
          position={[0, 0.015, CONTROLLER.size[2] / 2 + 0.002]}
        >
          <span className="font-mono tabular-nums">
            {reading(temperature, 1)} °C
          </span>
        </ThreeLabel>
      </group>
    </group>
  );
}
