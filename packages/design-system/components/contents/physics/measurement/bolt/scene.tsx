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
import { Machined } from "@repo/design-system/components/three/instrument/machined";
import {
  PLATE_TOP,
  Plate,
} from "@repo/design-system/components/three/instrument/plate";
import {
  Patch,
  Sheath,
} from "@repo/design-system/components/three/instrument/region";
import { Rule } from "@repo/design-system/components/three/instrument/rule";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Match } from "effect";
import type { ReactNode } from "react";

/** One of the quantities the lab shows. */
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
      <Patch
        at={[SHANK_LENGTH + 0.6, 0, 0]}
        color={PLOT_COLORS.fuchsia}
        radius={SHANK}
        turn={[0, Math.PI / 2, 0]}
      />
    )),
    Match.when("mass", () => null),
    Match.orElse(() => (
      <Sheath
        at={[SHANK_LENGTH / 2, 0, 0]}
        color={PLOT_COLORS.violet}
        long={SHANK_LENGTH}
        radius={SHANK + 0.5}
        turn={[0, 0, Math.PI / 2]}
      />
    ))
  );
}

/**
 * The bolt lying where `at` puts the underside of its head, resting on a
 * flat of its head and on its thread. It is drawn in millimetres with its
 * axis along x, and its children are what is marked on it, placed along
 * that axis.
 */
function Bolt({
  at,
  children,
}: {
  readonly at: readonly [number, number, number];
  readonly children: ReactNode;
}) {
  return (
    <group
      position={[at[0], at[1] + HEAD_REACH.flats, at[2]]}
      rotation={[0, 0, -REST]}
    >
      <Machined faceted radius={headRadius} stations={HEAD_STATIONS}>
        <Zinc />
      </Machined>
      <Machined radius={shankRadius} stations={SHANK_STATIONS}>
        <Zinc />
      </Machined>
      <Numeral
        at={[-HEAD_REACH.thick - 0.03, 2.6, 0]}
        height={2.6}
        text="8.8"
        turn={[0, -Math.PI / 2, 0]}
      />
      {children}
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
          <Bolt at={[-SHANK_LENGTH / 2, 0, 6]}>
            <Mark quantity={quantity} />
          </Bolt>
        </Balance>
      </group>
    );
  }
  return (
    <group>
      <ReadingCamera
        key="rule"
        narrow={[-0.2, 1.02, 0.58]}
        surface={PLATE_TOP}
        target={[-0.04, 0.04, -0.02]}
        wide={[-0.24, 0.66, 0.54]}
      />
      <Plate deep={160} wide={240}>
        <group position={[-0.3, 0, -0.12]}>
          <group scale={MILLIMETRE}>
            <Bolt at={[0, 0, 0]}>
              <Mark quantity={quantity} />
            </Bolt>
          </group>
          <group position={[0, 0, 12 * MILLIMETRE]}>
            <Rule length={7} />
          </group>
        </group>
      </Plate>
    </group>
  );
}
