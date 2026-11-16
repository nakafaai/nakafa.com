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
import { DoubleSide, Vector2 } from "three";

/** The deepest rock, before the reservoir's heat warms its tone. */
const DEEP_ROCK = mix(MATERIAL.rock, getColor("BLACK"), 0.35);

/** The cutaway block's layers from the surface down: their tone and thickness in scene units. */
const LAYERS = [
  { tall: 0.25, tone: MATERIAL.grass },
  { tall: 1.4, tone: MATERIAL.soil },
  { tall: 2.6, tone: MATERIAL.rock },
  { tall: 2.2, tone: DEEP_ROCK },
] as const;

/** The block's width and depth, in scene units. */
const BLOCK = { deep: 6, wide: 12 } as const;

/** Where the two wells reach the surface, along the block. */
const WELLS = { cool: 2.4, hot: -2.4 } as const;

/** The plant hall: its middle, size and the height its gable rises above the walls. */
const HALL = { at: [0, 0.8, 1], gable: 0.5, size: [6.2, 1.6, 2.4] } as const;

/** The small cooling tower beside the hall, in scene units. */
const TOWER = { at: [-4.8, 0, 1.2], tall: 2.8 } as const;

/**
 * The tower's shell, base to rim: wide at the foot, pinched near the top and
 * flaring again, as a natural-draught tower is built.
 */
const TOWER_SHELL = Arr.makeBy(13, (step) => {
  const along = step / 12;
  const waist = (along - 0.72) / 0.72;
  return new Vector2(0.5 + 0.45 * waist * waist, along * TOWER.tall);
});

/**
 * A geothermal field cut open: grass, soil and rock above a reservoir of hot
 * rock, its tone warming as the slider heats it. Rock only starts to glow
 * near 525 °C, so at these temperatures it stays dark. Water rises hot up the
 * production well, gives its heat to the plant, and sinks again down the
 * injection well; the cooling tower breathes warm, moist air, and the power
 * line carries away as much electricity as the plant makes.
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
          color={mix(DEEP_ROCK, MATERIAL.roofTerracotta, 0.1 + warmth * 0.3)}
          roughness={0.9}
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
      <mesh castShadow position={[...HALL.at]} receiveShadow>
        <boxGeometry args={[...HALL.size]} />
        <meshStandardMaterial color={MATERIAL.concrete} roughness={0.8} />
      </mesh>
      <mesh
        castShadow
        position={[
          HALL.at[0],
          HALL.at[1] + HALL.size[1] / 2 + HALL.gable / 3,
          HALL.at[2],
        ]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[HALL.gable / ((HALL.size[2] + 0.3) * 0.866), 1, 1]}
      >
        <cylinderGeometry
          args={[
            (HALL.size[2] + 0.3) / 1.732,
            (HALL.size[2] + 0.3) / 1.732,
            HALL.size[0] + 0.3,
            3,
            1,
            false,
            Math.PI / 2,
          ]}
        />
        <MetalMaterial color={MATERIAL.roofZinc} roughness={0.5} />
      </mesh>
      {Arr.map([-2.2, -1.1, 0, 1.1, 2.2] as const, (x) => (
        <mesh
          key={x}
          position={[x, 1.05, HALL.at[2] + HALL.size[2] / 2 + 0.01]}
        >
          <boxGeometry args={[0.6, 0.35, 0.02]} />
          <meshStandardMaterial
            color={MATERIAL.tintedGlass}
            metalness={0.2}
            roughness={0.15}
          />
        </mesh>
      ))}
      {Arr.map([WELLS.hot, WELLS.cool] as const, (x) => (
        <group key={x}>
          <Pipe
            from={[x, 0.4, BLOCK.deep / 2 + 0.01]}
            radius={0.1}
            to={[x, 0.4, HALL.at[2] + HALL.size[2] / 2]}
          >
            <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.45} />
          </Pipe>
          <mesh castShadow position={[x, 0.4, BLOCK.deep / 2 + 0.01]}>
            <sphereGeometry args={[0.15, 20, 12]} />
            <MetalMaterial color={MATERIAL.castIron} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {Arr.map([-0.2, 0.2] as const, (offset) => (
        <Pipe
          from={[-HALL.size[0] / 2, 0.4, TOWER.at[2] + offset]}
          key={offset}
          radius={0.09}
          to={[TOWER.at[0] + 0.75, 0.4, TOWER.at[2] + offset]}
        >
          <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.45} />
        </Pipe>
      ))}
      <mesh castShadow position={[...TOWER.at]} receiveShadow>
        <latheGeometry args={[TOWER_SHELL, 40]} />
        <meshStandardMaterial
          color={MATERIAL.concrete}
          roughness={0.85}
          side={DoubleSide}
        />
      </mesh>
      <Puffs
        amount={0.4 + warmth * 0.6}
        at={[TOWER.at[0], TOWER.tall, TOWER.at[2]]}
        rise={2.4}
        size={0.4}
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
