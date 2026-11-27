import {
  HEAD_REACH,
  HEAD_STATIONS,
  headRadius,
  SHANK_STATIONS,
  shankRadius,
} from "@repo/design-system/components/contents/physics/measurement/bolt/form";
import type { BoltQuantitySchema } from "@repo/design-system/components/contents/physics/measurement/bolt/quantities";
import {
  boltQuantities,
  SHANK_DIAMETER,
  SHANK_LENGTH,
} from "@repo/design-system/components/contents/physics/measurement/bolt/quantities";
import { Balance } from "@repo/design-system/components/three/instrument/balance";
import { ReadingCamera } from "@repo/design-system/components/three/instrument/camera";
import { Extent } from "@repo/design-system/components/three/instrument/extent";
import { Numeral } from "@repo/design-system/components/three/instrument/ink";
import { Rule } from "@repo/design-system/components/three/instrument/rule";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { Turned } from "@repo/design-system/components/three/instrument/turned";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Match } from "effect";

type Quantity = typeof BoltQuantitySchema.Type;

/** The shank's radius, in millimetres. */
const SHANK = SHANK_DIAMETER / 2;

/** How far the bolt's tip drops as it rests on a flat of its head and on its thread, as an angle. */
const REST = Math.asin((HEAD_REACH.flats - SHANK) / (SHANK_LENGTH + 3));

/** The bright zinc plating of the bolt. */
function Zinc() {
  return (
    <SurfaceMaterial
      bump={0.25}
      color={INSTRUMENT_COLORS.zinc}
      metalness={1}
      repeat={[5, 0.25]}
      roughness={0.34}
      surface="brushed"
    />
  );
}

/** A glowing, see-through mark in the lesson's colour. */
function Tint({ color }: { readonly color: string }) {
  return (
    <meshStandardMaterial
      color={color}
      depthWrite={false}
      emissive={color}
      emissiveIntensity={0.4}
      opacity={0.42}
      roughness={0.5}
      transparent
    />
  );
}

/** What the quantity in view marks on the bolt, in millimetres along its axis from under its head. */
function Mark({ quantity }: { readonly quantity: Quantity }) {
  return Match.value(quantity).pipe(
    Match.when("length", () => (
      <Extent
        color={PLOT_COLORS.orange}
        from={[0, 12.5, 0]}
        to={[SHANK_LENGTH, 12.5, 0]}
        weight={0.45}
      />
    )),
    Match.when("diameter", () => (
      <Extent
        color={PLOT_COLORS.teal}
        from={[12, -SHANK, SHANK + 1.6]}
        to={[12, SHANK, SHANK + 1.6]}
        weight={0.4}
      />
    )),
    Match.when("area", () => (
      <mesh position={[SHANK_LENGTH + 0.6, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[SHANK, 64]} />
        <Tint color={PLOT_COLORS.fuchsia} />
      </mesh>
    )),
    Match.when("mass", () => null),
    Match.orElse(() => (
      <mesh
        position={[SHANK_LENGTH / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[SHANK + 0.5, SHANK + 0.5, SHANK_LENGTH, 64]} />
        <Tint color={PLOT_COLORS.violet} />
      </mesh>
    ))
  );
}

/**
 * The bolt lying where `at` puts the underside of its head, resting on a
 * flat of its head and on its thread, with the quantity in view marked on
 * it. It is drawn in millimetres with its axis along x.
 */
function Bolt({
  at,
  quantity,
}: {
  readonly at: readonly [number, number, number];
  readonly quantity: Quantity;
}) {
  return (
    <group
      position={[at[0], at[1] + HEAD_REACH.flats, at[2]]}
      rotation={[0, 0, -REST]}
    >
      <Turned faceted radius={headRadius} stations={HEAD_STATIONS}>
        <Zinc />
      </Turned>
      <Turned radius={shankRadius} stations={SHANK_STATIONS}>
        <Zinc />
      </Turned>
      <Numeral
        at={[-HEAD_REACH.thick - 0.03, 2.6, 0]}
        height={2.6}
        text="8.8"
        turn={[0, -Math.PI / 2, 0]}
      />
      <Mark quantity={quantity} />
    </group>
  );
}

/**
 * An M10 bolt on the bench with the quantity in view marked on it. Its
 * length and diameter are read against a steel rule laid along it; its mass
 * and density put it on the pan of a dial balance.
 *
 * @param quantity - The quantity in view
 */
export function BoltScene({ quantity }: { readonly quantity: Quantity }) {
  if (quantity === "mass" || quantity === "density") {
    return (
      <group>
        <ReadingCamera
          key="balance"
          narrow={[0.5, 1.9, 4.4]}
          target={[0, 0.84, 0]}
          wide={[0.6, 1.75, 3.1]}
        />
        <Balance
          full={100}
          grams={boltQuantities().mass.value * 1000}
          major={20}
          minor={2}
        >
          <Bolt at={[-SHANK_LENGTH / 2, 0, 6]} quantity={quantity} />
        </Balance>
      </group>
    );
  }
  return (
    <group>
      <ReadingCamera
        key="rule"
        narrow={[0.1, 1.02, 0.7]}
        target={[0.26, 0.04, 0.1]}
        wide={[0.06, 0.66, 0.66]}
      />
      <group scale={MILLIMETRE}>
        <Bolt at={[0, 0, 0]} quantity={quantity} />
      </group>
      <group position={[0, 0, 12 * MILLIMETRE]}>
        <Rule length={7} />
      </group>
    </group>
  );
}
