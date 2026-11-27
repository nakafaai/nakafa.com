import { RoundedBox } from "@react-three/drei";
import type { MaterialSchema } from "@repo/design-system/components/contents/physics/measurement/density/block";
import {
  BLOCK_SIDES,
  blockReading,
} from "@repo/design-system/components/contents/physics/measurement/density/block";
import { Balance } from "@repo/design-system/components/three/instrument/balance";
import { ReadingCamera } from "@repo/design-system/components/three/instrument/camera";
import { Extent } from "@repo/design-system/components/three/instrument/extent";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Match } from "effect";

/** One of the materials a block is cut from. */
type Material = typeof MaterialSchema.Type;

/** The block's sides, in millimetres: along the dial, up, and toward the reader. */
const SIDES = {
  deep: BLOCK_SIDES.width * 10,
  long: BLOCK_SIDES.length * 10,
  tall: BLOCK_SIDES.height * 10,
} as const;

/** How far a measured extent stands off the block's edge, in millimetres. */
const CLEAR = 6;

/** What the block is cut from: planed pine, or milled aluminium or brass. */
function Stock({ material }: { readonly material: Material }) {
  return Match.value(material).pipe(
    Match.when("pine", () => (
      <SurfaceMaterial
        color={INSTRUMENT_COLORS.pine}
        repeat={[1.4, 0.9]}
        roughness={0.62}
        surface="wood"
      />
    )),
    Match.when("aluminium", () => (
      <SurfaceMaterial
        bump={0.4}
        color={INSTRUMENT_COLORS.aluminium}
        metalness={0.6}
        repeat={[5, 5]}
        roughness={0.42}
        surface="brushed"
      />
    )),
    Match.orElse(() => (
      <SurfaceMaterial
        bump={0.4}
        color={INSTRUMENT_COLORS.brass}
        metalness={0.7}
        repeat={[5, 5]}
        roughness={0.36}
        surface="brushed"
      />
    ))
  );
}

/**
 * A block of one material on the pan of a dial balance, with the three
 * lengths a rule measures marked along its edges. Every block is the same
 * size, so only the needle tells the materials apart.
 *
 * @param material - What the block is cut from
 */
export function BlockScene({ material }: { readonly material: Material }) {
  return (
    <group>
      <ReadingCamera
        narrow={[0.6, 1.9, 4]}
        target={[0, 0.82, 0]}
        wide={[0.55, 1.75, 2.95]}
      />
      <Balance
        full={500}
        grams={blockReading(material).mass}
        major={100}
        minor={10}
      >
        <RoundedBox
          args={[SIDES.long, SIDES.tall, SIDES.deep]}
          castShadow
          position={[0, SIDES.tall / 2, 0]}
          radius={0.7}
          receiveShadow
          smoothness={3}
        >
          <Stock material={material} />
        </RoundedBox>
        <Extent
          color={PLOT_COLORS.orange}
          from={[-SIDES.long / 2, SIDES.tall + CLEAR, SIDES.deep / 2]}
          to={[SIDES.long / 2, SIDES.tall + CLEAR, SIDES.deep / 2]}
          weight={0.9}
        />
        <Extent
          color={PLOT_COLORS.violet}
          from={[-SIDES.long / 2 - CLEAR, 0, SIDES.deep / 2]}
          to={[-SIDES.long / 2 - CLEAR, SIDES.tall, SIDES.deep / 2]}
          weight={0.9}
        />
        <Extent
          color={PLOT_COLORS.teal}
          from={[SIDES.long / 2 + CLEAR, SIDES.tall, SIDES.deep / 2]}
          to={[SIDES.long / 2 + CLEAR, SIDES.tall, -SIDES.deep / 2]}
          weight={0.9}
        />
      </Balance>
    </group>
  );
}
