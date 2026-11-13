import { mix } from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  electricPower,
  RESERVOIR,
} from "@repo/design-system/components/contents/physics/renewable-energy/geothermal/loop";
import {
  Parcels,
  Pipe,
  Puffs,
} from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";

/** The cutaway block's layers from the surface down: their tone and thickness in scene units. */
const LAYERS = [
  { tall: 0.25, tone: MATERIAL.grass },
  { tall: 1.4, tone: MATERIAL.soil },
  { tall: 2.6, tone: MATERIAL.rock },
  { tall: 2.2, tone: mix(MATERIAL.rock, getColor("BLACK"), 0.35) },
] as const;

/** The block's width and depth, in scene units. */
const BLOCK = { deep: 6, wide: 12 } as const;

/** Where the two wells reach the surface, along the block. */
const WELLS = { cool: 2.4, hot: -2.4 } as const;

/**
 * A geothermal field cut open: grass, soil and rock above a hot reservoir
 * that glows as hot as the slider sets it. Water rises hot up the production
 * well, gives its heat to the plant, and sinks again down the injection
 * well; the cooling fans breathe warm air, and the power line carries away
 * as much electricity as the plant makes.
 */
export function GeothermalScene({
  colors,
  reservoir,
}: {
  readonly colors: Readonly<{ cool: string; hot: string; spark: string }>;
  readonly reservoir: number;
}) {
  const warmth = (reservoir - RESERVOIR.min) / (RESERVOIR.max - RESERVOIR.min);
  const share = electricPower(reservoir) / electricPower(RESERVOIR.max);
  const bottom = -Arr.reduce(LAYERS, 0, (sum, layer) => sum + layer.tall);
  let top = 0;

  return (
    <group>
      {Arr.map(LAYERS, (layer) => {
        const middle = top - layer.tall / 2;
        top -= layer.tall;
        return (
          <mesh key={layer.tone} position={[0, middle, 0]} receiveShadow>
            <boxGeometry args={[BLOCK.wide, layer.tall, BLOCK.deep]} />
            <meshStandardMaterial color={layer.tone} roughness={0.95} />
          </mesh>
        );
      })}
      <mesh position={[0, bottom - 0.5, 0]}>
        <boxGeometry args={[BLOCK.wide, 1, BLOCK.deep]} />
        <meshStandardMaterial
          color={mix(MATERIAL.rock, MATERIAL.coalGlow, 0.3 + warmth * 0.4)}
          emissive={MATERIAL.coalGlow}
          emissiveIntensity={0.25 + warmth * 1.4}
        />
      </mesh>
      {Arr.map(
        [
          { color: colors.hot, rising: true, x: WELLS.hot },
          { color: colors.cool, rising: false, x: WELLS.cool },
        ] as const,
        (well) => (
          <group key={well.x}>
            <Pipe
              from={[well.x, 0.4, BLOCK.deep / 2 + 0.01]}
              radius={0.14}
              to={[well.x, bottom - 0.4, BLOCK.deep / 2 + 0.01]}
            >
              <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.5} />
            </Pipe>
            <Parcels
              color={well.color}
              count={8}
              from={[
                well.x,
                well.rising ? bottom - 0.4 : 0.3,
                BLOCK.deep / 2 + 0.17,
              ]}
              pace={0.18}
              size={0.09}
              to={[
                well.x,
                well.rising ? 0.3 : bottom - 0.4,
                BLOCK.deep / 2 + 0.17,
              ]}
            />
          </group>
        )
      )}
      <mesh castShadow position={[0, 0.8, 1]} receiveShadow>
        <boxGeometry args={[6.2, 1.6, 2.4]} />
        <meshStandardMaterial color={MATERIAL.concrete} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.55, -1.6]}>
        <boxGeometry args={[4, 1.1, 1.4]} />
        <meshStandardMaterial color={getColor("SLATE", 300)} roughness={0.6} />
      </mesh>
      <Puffs
        amount={0.4 + warmth * 0.6}
        at={[0, 1.2, -1.6]}
        rise={2.4}
        size={0.45}
      />
      {Arr.map([-1, 1] as const, (side) => (
        <Pipe
          from={[4.6 + side * 0.35, 0, -0.5]}
          key={side}
          radius={0.05}
          to={[4.6, 3.6, -0.5]}
        >
          <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.4} />
        </Pipe>
      ))}
      <Parcels
        color={colors.spark}
        count={2 + Math.round(share * 6)}
        from={[3.1, 1.4, 0]}
        pace={0.35}
        size={0.07}
        to={[4.6, 3.5, -0.5]}
      />
    </group>
  );
}
