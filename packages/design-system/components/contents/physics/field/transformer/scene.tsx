import { useFrame } from "@react-three/fiber";
import { Bulb } from "@repo/design-system/components/contents/physics/bench/bulb";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import {
  SUPPLY_SOCKETS,
  Supply,
} from "@repo/design-system/components/contents/physics/bench/cell";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Matter } from "@repo/design-system/components/three/matter/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Path,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

/** The core: half its width and height, how thick its limbs are, how high it stands, and how its laminations stack. */
const HALF_WIDTH = 0.8;
const HALF_HEIGHT = 0.65;
const LIMB = 0.28;
const LIFT = 0.12;
const SHEETS = 12;
const SHEET = 0.03;
const CENTRE = LIFT + HALF_HEIGHT;
const LIMB_X = HALF_WIDTH - LIMB / 2;
/** How many turns the larger coil is drawn with, and how tall each winding is. */
const MOST_TURNS = 44;
const WOUND = 0.58;
/** How many markers of flux ride round the core. */
const FLUX_MARKERS = 12;
const SUPPLY_AT = [-1.85, 0, 0.1] as const;
const BULB_AT = [1.6, 0, 0.25] as const;

type Point = readonly [number, number, number];

/** One lamination of the core: a rectangular ring stamped from sheet iron. */
function stamp() {
  const sheet = new Shape();
  sheet.moveTo(-HALF_WIDTH, -HALF_HEIGHT);
  sheet.lineTo(HALF_WIDTH, -HALF_HEIGHT);
  sheet.lineTo(HALF_WIDTH, HALF_HEIGHT);
  sheet.lineTo(-HALF_WIDTH, HALF_HEIGHT);
  sheet.closePath();
  const window = new Path();
  window.moveTo(-HALF_WIDTH + LIMB, -HALF_HEIGHT + LIMB);
  window.lineTo(-HALF_WIDTH + LIMB, HALF_HEIGHT - LIMB);
  window.lineTo(HALF_WIDTH - LIMB, HALF_HEIGHT - LIMB);
  window.lineTo(HALF_WIDTH - LIMB, -HALF_HEIGHT + LIMB);
  window.closePath();
  sheet.holes = [window];
  return new ExtrudeGeometry(sheet, {
    bevelEnabled: false,
    depth: SHEET * 0.86,
  });
}

/** A coil of `turns` of enamelled wire wound round a vertical limb, as one tube along a helix. */
function wind(turns: number) {
  const steps = turns * 16;
  const points = Arr.makeBy(steps + 1, (index) => {
    const share = index / steps;
    const angle = share * turns * Math.PI * 2;
    return new Vector3(
      Math.cos(angle) * 0.29,
      (share - 0.5) * WOUND,
      Math.sin(angle) * 0.29
    );
  });
  return new TubeGeometry(
    new CatmullRomCurve3(points),
    steps,
    Math.min(0.03, (WOUND / turns) * 0.46),
    8
  );
}

/** The path the flux takes round the core, along the middle of its limbs, just in front of its face. */
function fluxPath() {
  const x = LIMB_X;
  const y = HALF_HEIGHT - LIMB / 2;
  const z = (SHEETS * SHEET) / 2 + 0.012;
  return new CatmullRomCurve3(
    [
      new Vector3(-x, -y + 0.1, z),
      new Vector3(-x, y - 0.1, z),
      new Vector3(-x + 0.1, y, z),
      new Vector3(x - 0.1, y, z),
      new Vector3(x, y - 0.1, z),
      new Vector3(x, -y + 0.1, z),
      new Vector3(x - 0.1, -y, z),
      new Vector3(-x + 0.1, -y, z),
    ],
    true,
    "catmullrom",
    0.1
  );
}

/** One winding on its bobbin round the limb at `x`, of `turns` of enamelled copper. */
function Winding({ turns, x }: { readonly turns: number; readonly x: number }) {
  const coil = useMemo(() => wind(turns), [turns]);
  useEffect(() => () => coil.dispose(), [coil]);

  return (
    <group position={[x, CENTRE, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.265, 0.265, WOUND + 0.02, 40]} />
        <Matter color={APPARATUS_COLORS.bobbin} of="plastic" />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[0, (side * (WOUND + 0.06)) / 2, 0]}
        >
          <cylinderGeometry args={[0.36, 0.36, 0.03, 40]} />
          <Matter color={APPARATUS_COLORS.bobbin} of="plastic" />
        </mesh>
      ))}
      <mesh castShadow geometry={coil}>
        <Matter of="copper" />
      </mesh>
    </group>
  );
}

/**
 * The alternating flux in the core, as a glowing line round its limbs with
 * markers that surge one way and back while the card plays, the way the
 * primary's alternating current drives it.
 */
function Flux() {
  const playing = useVisualScene((card) => card.playing, false);
  const path = useMemo(fluxPath, []);
  const line = useMemo(
    () => new TubeGeometry(path, 120, 0.008, 8, true),
    [path]
  );
  useEffect(() => () => line.dispose(), [line]);
  const markers = useRef<Group>(null);
  const clock = useRef(0);

  const place = () => {
    const swing = Math.sin(clock.current * 2.4) * 0.16;
    Arr.forEach(markers.current?.children ?? [], (marker, index) => {
      marker.position.copy(
        path.getPointAt((index / FLUX_MARKERS + swing + 1) % 1)
      );
    });
  };

  useVisualStop(() => {
    clock.current = 0;
    place();
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += simulationStep(delta);
    place();
  });

  return (
    <group position={[0, CENTRE, 0]}>
      <mesh geometry={line}>
        <Matter color={APPARATUS_COLORS.fluxGlow} glow={0.8} of="light" />
      </mesh>
      <group ref={markers}>
        {Arr.makeBy(FLUX_MARKERS, (index) => (
          <mesh key={index} position={path.getPointAt(index / FLUX_MARKERS)}>
            <sphereGeometry args={[0.03, 14, 10]} />
            <Matter color={APPARATUS_COLORS.fluxGlow} glow={1.7} of="light" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * The transformer on the bench: a core of stacked iron laminations with a
 * primary winding of many turns on one limb and a secondary on the other,
 * their turns in the ratio of the voltages; a supply feeds the primary and
 * the secondary lights a lamp. The flux the primary drives round the core is
 * drawn glowing on its face, and the laminations glow dull red with the share
 * of the input power the transformer turns to heat.
 */
export function TransformerScene({
  efficiency,
  output,
  primary,
  ratio,
  secondary,
}: {
  readonly efficiency: number;
  readonly output: number;
  readonly primary: number;
  readonly ratio: number;
  readonly secondary: number;
}) {
  const quantity = useQuantity();
  const sheet = useMemo(stamp, []);
  useEffect(() => () => sheet.dispose(), [sheet]);
  const primaryTurns =
    ratio >= 1 ? MOST_TURNS : Math.max(2, Math.round(MOST_TURNS * ratio));
  const secondaryTurns =
    ratio >= 1 ? Math.max(2, Math.round(MOST_TURNS / ratio)) : MOST_TURNS;
  const leads = useMemo(
    () => ({
      bulbHome: [
        [BULB_AT[0], 0.035, BULB_AT[2] + 0.12],
        [1.3, 0.03, 0.6],
        [LIMB_X + 0.34, 0.06, 0.3],
        [LIMB_X + 0.3, CENTRE - WOUND / 2, 0.08],
      ] satisfies readonly Point[],
      bulbOut: [
        [LIMB_X + 0.3, CENTRE + WOUND / 2, 0.08],
        [LIMB_X + 0.62, 0.6, 0.02],
        [1.4, 0.03, -0.1],
        [BULB_AT[0], 0.035, BULB_AT[2] - 0.12],
      ] satisfies readonly Point[],
      feedHome: [
        [-LIMB_X - 0.3, CENTRE - WOUND / 2, 0.08],
        [-LIMB_X - 0.36, 0.05, 0.4],
        [-1.6, 0.03, 0.66],
        [
          SUPPLY_AT[0] + SUPPLY_SOCKETS[1][0],
          SUPPLY_SOCKETS[1][1],
          SUPPLY_AT[2] + 0.3,
        ],
      ] satisfies readonly Point[],
      feedOut: [
        [
          SUPPLY_AT[0] + SUPPLY_SOCKETS[0][0],
          SUPPLY_SOCKETS[0][1],
          SUPPLY_AT[2] + 0.3,
        ],
        [-1.55, 0.06, 0.5],
        [-LIMB_X - 0.56, 0.7, 0.2],
        [-LIMB_X - 0.3, CENTRE + WOUND / 2, 0.08],
      ] satisfies readonly Point[],
    }),
    []
  );

  return (
    <group>
      <BenchCamera
        narrow={[0, 2.6, 7.8]}
        target={[-0.1, 0.7, 0]}
        wide={[0, 1.7, 5.3]}
      />
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * (HALF_WIDTH - 0.2), LIFT / 2, 0]}
          receiveShadow
        >
          <boxGeometry args={[0.24, LIFT, SHEETS * SHEET + 0.3]} />
          <Matter of="steel" />
        </mesh>
      ))}
      {Arr.makeBy(SHEETS, (index) => (
        <mesh
          castShadow
          geometry={sheet}
          key={index}
          position={[0, CENTRE, (index - SHEETS / 2) * SHEET]}
        >
          <Matter finish="machined" glow={(1 - efficiency) * 0.25} of="iron" />
        </mesh>
      ))}
      <Flux />
      <Winding turns={primaryTurns} x={-LIMB_X} />
      <Winding turns={secondaryTurns} x={LIMB_X} />
      <Tag position={[-LIMB_X, CENTRE + WOUND / 2 + 0.52, 0]}>
        <InlineMath math="N_p" />
      </Tag>
      <Tag position={[LIMB_X, CENTRE + WOUND / 2 + 0.52, 0]}>
        <InlineMath math="N_s" />
      </Tag>
      <group position={SUPPLY_AT}>
        <Supply share={0.7}>
          <InlineMath math={quantity(primary, "\\text{ V}", 0)} />
        </Supply>
      </group>
      <group position={BULB_AT} rotation={[0, Math.PI / 2, 0]} scale={1.5}>
        <Bulb glow={0.92} />
      </group>
      <Tag position={[BULB_AT[0], 1.02, BULB_AT[2]]}>
        <InlineMath
          math={`${quantity(secondary, "\\text{ V}", 0)},\\ ${quantity(output, "\\text{ W}", 0)}`}
        />
      </Tag>
      <Lead
        color={APPARATUS_COLORS.leadRed}
        points={leads.feedOut}
        radius={0.016}
      />
      <Lead
        color={APPARATUS_COLORS.leadBlack}
        points={leads.feedHome}
        radius={0.016}
      />
      <Lead
        color={APPARATUS_COLORS.leadYellow}
        points={leads.bulbOut}
        radius={0.018}
      />
      <Lead
        color={APPARATUS_COLORS.leadBlue}
        points={leads.bulbHome}
        radius={0.018}
      />
    </group>
  );
}
