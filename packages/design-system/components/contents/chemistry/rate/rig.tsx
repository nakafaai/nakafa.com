import { GLASS_WALL } from "@repo/design-system/components/contents/chemistry/bench";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import {
  MetalMaterial,
  VesselGlassMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr } from "effect";

/** The gas syringe: how high its axis lies, its barrel's length and radius, and how far it starts from the flask. */
export const SYRINGE = {
  gap: 0.05,
  length: 0.15,
  radius: 0.015,
  y: 0.2,
} as const;

/** A rubber bung, tapered to seat in a flask's neck, with its rim rounded. */
const BUNG = [
  [0.0012, 0],
  [0.0152, 0],
  [0.0162, 0.0014],
  [0.0186, 0.0206],
  [0.0176, 0.022],
  [0.0012, 0.022],
] as const;

/** The scale marks printed along the barrel: how many, and every which one is long. */
const MARKS = { count: 11, long: 5 } as const;

/** A tapered rubber bung in a flask's neck, its base at y = 0. */
export function Bung() {
  return (
    <mesh castShadow>
      <Turn profile={BUNG} />
      <meshStandardMaterial color={BENCH_COLORS.stopper} roughness={0.82} />
    </mesh>
  );
}

/**
 * A glass delivery tube from the bung of a flask at the origin up and over
 * to a syringe's nozzle, `reach` metres to the side at `rise` metres up,
 * bent in one smooth elbow as a glassblower bends it.
 */
export function DeliveryTube({
  reach,
  rise,
}: {
  readonly reach: number;
  readonly rise: number;
}) {
  return (
    <mesh castShadow renderOrder={2}>
      <Sweep
        ends="open"
        path={{
          bend: 0.018,
          kind: "route",
          points: [
            [0, -0.012, 0],
            [0, rise, 0],
            [reach, rise, 0],
          ],
        }}
        radius={0.0032}
      />
      <VesselGlassMaterial
        color={BENCH_COLORS.glass}
        thickness={GLASS_WALL}
        tint={BENCH_COLORS.glassEdge}
      />
    </mesh>
  );
}

/**
 * A 100 mL glass gas syringe lying along x from its nozzle at the origin,
 * pointing `side`: a ground-glass barrel with a printed scale and a finger
 * flange, and a glass plunger pushed out `filled` of its travel, from 0
 * empty to 1 full, as the gas collects.
 */
export function GasSyringe({
  filled,
  side,
}: {
  readonly filled: number;
  readonly side: -1 | 1;
}) {
  const travel = 0.012 + filled * (SYRINGE.length - 0.03);
  const stem = SYRINGE.length - 0.004;
  return (
    <group scale={[side, 1, 1]}>
      <mesh position={[0.007, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0034, 0.0034, 0.014, 24]} />
        <meshStandardMaterial color={BENCH_COLORS.stopper} roughness={0.8} />
      </mesh>
      <mesh position={[0.019, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[SYRINGE.radius, 0.0036, 0.01, 40, 1, true]} />
        <VesselGlassMaterial
          color={BENCH_COLORS.glass}
          thickness={GLASS_WALL}
          tint={BENCH_COLORS.glassEdge}
        />
      </mesh>
      <mesh
        castShadow
        position={[0.024 + SYRINGE.length / 2, 0, 0]}
        renderOrder={2}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry
          args={[SYRINGE.radius, SYRINGE.radius, SYRINGE.length, 48, 1, true]}
        />
        <VesselGlassMaterial
          color={BENCH_COLORS.glass}
          thickness={GLASS_WALL}
          tint={BENCH_COLORS.glassEdge}
        />
      </mesh>
      {Arr.makeBy(MARKS.count, (index) => {
        const long = index % MARKS.long === 0;
        return (
          <mesh
            key={index}
            position={[
              0.034 + (index / (MARKS.count - 1)) * (SYRINGE.length - 0.03),
              0,
              0,
            ]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <torusGeometry
              args={[
                SYRINGE.radius + 0.0002,
                0.000_35,
                6,
                24,
                long ? Math.PI * 0.9 : Math.PI * 0.45,
              ]}
            />
            <meshStandardMaterial
              color={BENCH_COLORS.syringeScale}
              roughness={0.6}
            />
          </mesh>
        );
      })}
      <mesh
        position={[0.024 + SYRINGE.length, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <torusGeometry args={[SYRINGE.radius + 0.004, 0.0022, 12, 48]} />
        <VesselGlassMaterial
          color={BENCH_COLORS.glass}
          thickness={GLASS_WALL}
          tint={BENCH_COLORS.glassEdge}
        />
      </mesh>
      <group position={[0.024 + travel, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[SYRINGE.radius - 0.0012, SYRINGE.radius - 0.0012, 0.008, 40]}
          />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={BENCH_COLORS.ptfe}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[stem / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[
              SYRINGE.radius - 0.0026,
              SYRINGE.radius - 0.0026,
              stem,
              40,
              1,
              true,
            ]}
          />
          <VesselGlassMaterial
            color={BENCH_COLORS.glass}
            thickness={GLASS_WALL}
            tint={BENCH_COLORS.glassEdge}
          />
        </mesh>
        <mesh position={[stem + 0.002, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0185, 0.0185, 0.004, 48]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={BENCH_COLORS.ptfe}
            roughness={0.35}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A retort stand behind a syringe whose axis passes over the origin at
 * `height`: a cast-iron base, a chrome rod, a bosshead, and a clamp whose
 * cork-lined jaws grip the barrel.
 */
export function SyringeStand({ height }: { readonly height: number }) {
  const back = -0.075;
  return (
    <group>
      <mesh castShadow position={[0, 0.006, back + 0.03]} receiveShadow>
        <boxGeometry args={[0.1, 0.012, 0.15]} />
        <MetalMaterial color={BENCH_COLORS.standIron} roughness={0.62} />
      </mesh>
      <mesh castShadow position={[0, (height + 0.08) / 2, back]}>
        <cylinderGeometry args={[0.005, 0.005, height + 0.08, 24]} />
        <MetalMaterial color={BENCH_COLORS.standChrome} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0, height, back]}>
        <boxGeometry args={[0.02, 0.022, 0.02]} />
        <MetalMaterial color={BENCH_COLORS.standIron} roughness={0.5} />
      </mesh>
      <mesh position={[0.015, height, back]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0045, 0.0045, 0.012, 16]} />
        <MetalMaterial color={BENCH_COLORS.standChrome} roughness={0.28} />
      </mesh>
      <mesh
        castShadow
        position={[0, height, (back - SYRINGE.radius) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.0034, 0.0034, -back - SYRINGE.radius, 16]} />
        <MetalMaterial color={BENCH_COLORS.standChrome} roughness={0.22} />
      </mesh>
      <mesh position={[0, height, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[SYRINGE.radius + 0.0026, 0.0026, 12, 40]} />
        <meshStandardMaterial color={BENCH_COLORS.clampCork} roughness={0.9} />
      </mesh>
    </group>
  );
}
