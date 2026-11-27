import { SaltBridge } from "@repo/design-system/components/three/apparatus/bridge";
import { Lead } from "@repo/design-system/components/three/apparatus/lead";
import {
  METER_POSTS,
  Meter,
} from "@repo/design-system/components/three/apparatus/meter";
import type { Lead as LeadAsk } from "@repo/design-system/components/three/apparatus/route";
import { routeOf } from "@repo/design-system/components/three/apparatus/route";
import {
  TILE_HEIGHT,
  Tile,
} from "@repo/design-system/components/three/apparatus/tile";
import { Vessel } from "@repo/design-system/components/three/apparatus/vessel";
import type { Path } from "@repo/design-system/components/three/form/path";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LABWARE_COLORS } from "@repo/design-system/lib/material/labware";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

export const LEFT_BEAKER_X = -0.155;
export const RIGHT_BEAKER_X = 0.155;
export const BEAKER_Z = 0.06;
export const ANODE_X = LEFT_BEAKER_X - 0.02;
export const CATHODE_X = RIGHT_BEAKER_X + 0.02;

/** Where the voltmeter stands, in front of the cell under the salt bridge, and how much larger than a bench meter a demonstration one is. */
export const METER_Z = 0.2;
const METER_SCALE = 1.2;

const PLATE = { half: 0.055, middle: 0.083 } as const;
const PLATE_TOP = PLATE.middle + PLATE.half;

/** The voltmeter's scale: 0 to 3 V, which holds the EMF of every cell the lab shows. */
const VOLTS = { from: 0, major: 1, minor: 0.25, to: 3 } as const;

/** Where one of the voltmeter's posts is on the bench. */
function postAt(post: (typeof METER_POSTS)[number]) {
  return [
    post[0] * METER_SCALE,
    post[1] * METER_SCALE,
    METER_Z + post[2] * METER_SCALE,
  ] as const;
}

/** The black lead from the anode's clip to the voltmeter's negative post, the way electrons leave the cell. */
const ANODE_LEAD: LeadAsk = {
  ends: ["clip", "plug"],
  from: [ANODE_X, PLATE_TOP, BEAKER_Z],
  lift: 0.05,
  to: postAt(METER_POSTS[0]),
};

/** The red lead from the voltmeter's positive post to the cathode's clip, the way electrons enter the cell. */
const CATHODE_LEAD: LeadAsk = {
  ends: ["plug", "clip"],
  from: postAt(METER_POSTS[1]),
  lift: 0.05,
  to: [CATHODE_X, PLATE_TOP, BEAKER_Z],
};

/** The lines the two leads follow, which the electrons ride. */
export const LEFT_LEAD: Path = routeOf(ANODE_LEAD);
export const RIGHT_LEAD: Path = routeOf(CATHODE_LEAD);

function createElectrodeGeometry() {
  const halfW = 0.0115;
  const shape = new Shape();
  shape.moveTo(-halfW, -PLATE.half);
  shape.lineTo(halfW, -PLATE.half);
  shape.lineTo(halfW, PLATE.half);
  shape.lineTo(-halfW, PLATE.half);
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.0006,
    bevelThickness: 0.0006,
    depth: 0.0016,
  });
  geo.translate(0, 0, -0.0008);
  return geo;
}

const LEFT_LEG = LEFT_BEAKER_X + 0.02;
const RIGHT_LEG = RIGHT_BEAKER_X - 0.02;

/** The inverted borosilicate U-tube salt bridge between the two electrolytes. */
export const SALT_BRIDGE: Path = [
  [LEFT_LEG, 0.044, BEAKER_Z],
  [LEFT_LEG, 0.114, BEAKER_Z],
  [LEFT_LEG + 0.032, 0.148, BEAKER_Z],
  [0, 0.156, BEAKER_Z],
  [RIGHT_LEG - 0.032, 0.148, BEAKER_Z],
  [RIGHT_LEG, 0.114, BEAKER_Z],
  [RIGHT_LEG, 0.044, BEAKER_Z],
];

/** A 400 mL half-cell beaker of electrolyte on a glazed white ceramic tile. */
export function HalfCellBeaker({
  liquidColor,
  strength,
  x,
}: {
  readonly liquidColor: string;
  readonly strength: number;
  readonly x: number;
}) {
  return (
    <group position={[x, 0, BEAKER_Z]}>
      <Tile side={0.126} />
      <group position={[0, TILE_HEIGHT, 0]}>
        <Vessel
          capacity={400}
          holds={{ color: liquidColor, strength, volume: 250 }}
          kind="beaker"
        />
      </group>
    </group>
  );
}

/** A strip of the electrode's own metal, cut from sheet and rubbed bright, standing in its electrolyte. */
export function ElectrodeAssembly({
  metalColor,
  x,
}: {
  readonly metalColor: string;
  readonly x: number;
}) {
  const plateGeo = useMemo(createElectrodeGeometry, []);
  useEffect(() => () => plateGeo.dispose(), [plateGeo]);

  return (
    <mesh
      castShadow
      geometry={plateGeo}
      position={[x, PLATE.middle, BEAKER_Z]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <SurfaceMaterial
        color={metalColor}
        metalness={1}
        repeat={[14, 60]}
        roughness={0.34}
        surface="brushed"
      />
    </mesh>
  );
}

/** Curved borosilicate inverted U-tube salt bridge with inner KNO3 agar gel and cotton-wool plugs. */
export function InvertedUTubeBridge() {
  return <SaltBridge path={SALT_BRIDGE} radius={0.0096} />;
}

/**
 * The cell's external circuit: a demonstration moving-coil voltmeter in front
 * of the beakers that reads the cell's EMF, a black lead from the anode's
 * crocodile clip to its negative post and a red lead from its positive post
 * to the cathode's.
 */
export function Circuit({ emfVolts }: { readonly emfVolts: number }) {
  return (
    <group>
      <group position={[0, 0, METER_Z]} scale={METER_SCALE}>
        <Meter reading={emfVolts} scale={VOLTS} unit="V" />
      </group>
      <Lead color={LABWARE_COLORS.leadBlack} {...ANODE_LEAD} />
      <Lead color={LABWARE_COLORS.leadRed} {...CATHODE_LEAD} />
    </group>
  );
}
