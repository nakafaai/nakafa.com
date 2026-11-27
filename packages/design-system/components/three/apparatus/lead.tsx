import type { Lead as LeadAsk } from "@repo/design-system/components/three/apparatus/route";
import {
  FITTING,
  routeOf,
} from "@repo/design-system/components/three/apparatus/route";
import { Sweep } from "@repo/design-system/components/three/form/part";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useRequired } from "@repo/design-system/hooks/required";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { Match } from "effect";
import { createContext, useMemo } from "react";

/** The radius of a 4 mm test lead's silicone cable, in metres. */
const CABLE = 0.0019;

/** How far the two jaws of a crocodile clip open from its axis, in radians. */
const JAW = 0.13;

/** The colour of a lead's insulation, which its cable and the sleeves of its fittings share. */
const LeadColor = createContext<string | null>(null);

/** The moulded sleeve a fitting's cable leaves through: a barrel that tapers into a strain relief. */
function Sleeve({ height }: { readonly height: number }) {
  const color = useRequired(LeadColor, "Sleeve");

  return (
    <group>
      <mesh castShadow position={[0, height * 0.42, 0]}>
        <cylinderGeometry args={[0.0044, 0.0048, height * 0.56, 24]} />
        <SurfaceMaterial
          coat={0.3}
          color={color}
          repeat={[2, 1]}
          roughness={0.55}
          surface="plastic"
        />
      </mesh>
      <mesh castShadow position={[0, height * 0.85, 0]}>
        <cylinderGeometry args={[CABLE * 1.15, 0.0044, height * 0.3, 24]} />
        <SurfaceMaterial
          color={color}
          repeat={[2, 1]}
          roughness={0.7}
          surface="rubber"
        />
      </mesh>
    </group>
  );
}

/** A stackable 4 mm plug seated in a post: its sprung nickel pin's shoulder under its sleeve. */
function Plug() {
  return (
    <group>
      <mesh position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.0031, 0.0031, 0.006, 20]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          roughness={0.26}
          surface="brushed"
        />
      </mesh>
      <group position={[0, 0.003, 0]}>
        <Sleeve height={FITTING.plug - 0.003} />
      </group>
    </group>
  );
}

/**
 * A crocodile clip gripping a plate from above: two pressed nickel jaws that
 * meet below the place it grips, the pin they pivot on, and its sleeve.
 */
function Clip() {
  return (
    <group>
      <mesh castShadow position={[0, -0.001, 0.0012]} rotation={[JAW, 0, 0]}>
        <boxGeometry args={[0.0056, 0.024, 0.0009]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          repeat={[1, 3]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[0, -0.001, -0.0012]} rotation={[-JAW, 0, 0]}>
        <boxGeometry args={[0.0056, 0.024, 0.0009]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          repeat={[1, 3]}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0014, 0.0014, 0.0068, 12]} />
        <SurfaceMaterial
          color={LABWARE_COLORS.nickel}
          metalness={1}
          roughness={0.3}
          surface="brushed"
        />
      </mesh>
      <group position={[0, 0.008, 0]}>
        <Sleeve height={FITTING.clip - 0.008} />
      </group>
    </group>
  );
}

/** What a lead ends in, at the place it grips. */
function Fitting({
  kind,
  position,
}: {
  readonly kind: LeadAsk["ends"][number];
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      {Match.value(kind).pipe(
        Match.when("plug", () => <Plug />),
        Match.when("clip", () => <Clip />),
        Match.when("bare", () => null),
        Match.exhaustive
      )}
    </group>
  );
}

/**
 * A 4 mm test lead: a flexible silicone cable in its colour that hangs in
 * one easy curve between two places, with a stackable plug or a crocodile
 * clip at each end. `routeOf` gives the same line for whatever a lesson
 * shows moving along it.
 *
 * @example
 * <Lead color={red} ends={["clip", "plug"]} from={PLATE} lift={0.03} to={POST} />
 *
 * @param color - The colour of its insulation
 * @param ends - What it ends in at `from` and at `to`
 * @param from - The place its first fitting grips
 * @param lift - How far its middle stands above the line between its ends, in metres
 * @param to - The place its second fitting grips
 */
export function Lead({
  color,
  ends,
  from,
  lift,
  to,
}: LeadAsk & { readonly color: string }) {
  const path = useMemo(
    () => routeOf({ ends, from, lift, to }),
    [ends, from, lift, to]
  );

  return (
    <LeadColor value={color}>
      <mesh castShadow>
        <Sweep path={path} radius={CABLE} />
        <SurfaceMaterial
          color={color}
          repeat={[40, 1]}
          roughness={0.62}
          surface="rubber"
        />
      </mesh>
      <Fitting kind={ends[0]} position={from} />
      <Fitting kind={ends[1]} position={to} />
    </LeadColor>
  );
}
