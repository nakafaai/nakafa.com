import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { GaltonBalls } from "@repo/design-system/components/contents/mathematics/galton/balls";
import {
  BIN_FLOOR,
  binCentre,
  boardPose,
  DIVIDER,
  dividerTop,
  dividerXs,
  FOOT_HEIGHT,
  FOOT_WIDTH,
  FOOT_X,
  GAP,
  HOPPER_SLOPE,
  INNER_HALF,
  INNER_TOP,
  NECK,
  NECK_HALF,
  PIN_RADIUS,
  pinPoints,
} from "@repo/design-system/components/contents/mathematics/galton/board";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { GALTON_COLORS } from "@repo/design-system/lib/material/galton";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { Shape, Vector2 } from "three";

/** The frame's rails: 20 mm wide, the top rail 25 mm and the base rail 30 mm tall. */
const RAIL = 0.02;
const TOP_RAIL = 0.025;

/** The backboard's thickness, behind the face the pins stand in. */
const BACK = 0.009;

/** The glass front's thickness, and the depth of the frame from the back of the backboard to the front of the glass. */
const GLASS = 0.003;
const FRONT = GAP + GLASS + 0.003;
const DEPTH = FRONT + BACK;
const MIDDLE = (FRONT - BACK) / 2;

/** How far each foot reaches in front of and behind the board, so it stands steady. */
const FOOT_DEPTH = 0.13;

/** The height of a bin's number on the base rail, 16 mm, kept between 11 and 15 pixels on screen. */
const BIN_NUMBER = 0.016;

/** The hopper floor's slats: 5 mm maple. */
const SLAT = 0.005;

/**
 * A teaching Galton board with `rows` rows of pins and bias `p`: the walnut
 * frame, the backboard, the hopper, the pins, the bins and the glass, with
 * the balls running through it. A biased board leans on its low foot, with
 * an oak wedge under the other. With `showExpected`, marks on the glass
 * show the counts the binomial formula expects.
 */
export function GaltonScene({
  onLanded,
  p,
  rows,
  showExpected,
}: {
  readonly onLanded: (count: number) => void;
  readonly p: number;
  readonly rows: number;
  readonly showExpected: boolean;
}) {
  const pose = useMemo(() => boardPose(p), [p]);
  return (
    <group>
      <group position={[pose.pivot, 0, 0]} rotation={[0, 0, pose.angle]}>
        <group position={[-pose.pivot, 0, 0]}>
          <Frame />
          <Hopper />
          <Pins rows={rows} />
          <Bins rows={rows} />
          <GaltonBalls
            front={FRONT}
            key={`${rows}-${p}`}
            onLanded={onLanded}
            p={p}
            rows={rows}
            showExpected={showExpected}
          />
          <mesh position={[0, (BIN_FLOOR + INNER_TOP) / 2, GAP + GLASS / 2]}>
            <boxGeometry
              args={[2 * INNER_HALF, INNER_TOP - BIN_FLOOR, GLASS]}
            />
            <Matter of="glass" opacity={0.14} />
          </mesh>
        </group>
      </group>
      <Wedge points={pose.wedge} />
    </group>
  );
}

/** The walnut frame on its two feet, and the painted backboard inside it. */
function Frame() {
  const outer = INNER_HALF + RAIL;
  const top = INNER_TOP + TOP_RAIL;
  const sides = top - FOOT_HEIGHT;
  return (
    <group>
      <mesh
        castShadow
        position={[0, (FOOT_HEIGHT + top) / 2, -BACK / 2]}
        receiveShadow
      >
        <boxGeometry args={[2 * outer - 0.004, sides - 0.004, BACK]} />
        <Matter color={GALTON_COLORS.backboard} of="paint" />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group key={side}>
          <RoundedBox
            args={[RAIL, sides, DEPTH]}
            castShadow
            position={[
              side * (INNER_HALF + RAIL / 2),
              FOOT_HEIGHT + sides / 2,
              MIDDLE,
            ]}
            radius={0.003}
            receiveShadow
          >
            <Matter of="walnut" />
          </RoundedBox>
          <RoundedBox
            args={[FOOT_WIDTH, FOOT_HEIGHT, FOOT_DEPTH]}
            castShadow
            position={[side * FOOT_X, FOOT_HEIGHT / 2, MIDDLE]}
            radius={0.004}
            receiveShadow
          >
            <Matter of="walnut" />
          </RoundedBox>
        </group>
      ))}
      <RoundedBox
        args={[2 * INNER_HALF, BIN_FLOOR - FOOT_HEIGHT, DEPTH]}
        castShadow
        position={[0, (FOOT_HEIGHT + BIN_FLOOR) / 2, MIDDLE]}
        radius={0.003}
        receiveShadow
      >
        <Matter of="walnut" />
      </RoundedBox>
      <RoundedBox
        args={[2 * INNER_HALF, TOP_RAIL, DEPTH]}
        castShadow
        position={[0, INNER_TOP + TOP_RAIL / 2, MIDDLE]}
        radius={0.003}
        receiveShadow
      >
        <Matter of="walnut" />
      </RoundedBox>
    </group>
  );
}

/** Light maple, for the hopper floor and the dividers: strips so thin that their grain does not show. */
function Maple() {
  return <Matter of="maple" />;
}

/** The hopper's floor: two maple slats falling at 30 degrees from the frame's sides to the outlet. */
function Hopper() {
  const length = (INNER_HALF - NECK_HALF) / Math.cos(HOPPER_SLOPE);
  const middle = (INNER_HALF + NECK_HALF) / 2;
  const surface = NECK + (middle - NECK_HALF) * Math.tan(HOPPER_SLOPE);
  const placements = Arr.map(
    [-1, 1] as const,
    (side): Placement => ({
      position: [
        side * (middle + (SLAT / 2) * Math.sin(HOPPER_SLOPE)),
        surface - (SLAT / 2) * Math.cos(HOPPER_SLOPE),
        GAP / 2,
      ],
      rotation: [0, 0, side * HOPPER_SLOPE],
    })
  );
  return (
    <Instances placements={placements}>
      <boxGeometry args={[length, SLAT, GAP]} />
      <Maple />
    </Instances>
  );
}

/**
 * A machined brass pin, turned about its own axis and centred on its middle:
 * a shank pressed into the backboard, a turned shoulder seated on the face,
 * the round body a ball strikes, and a chamfered tip at the glass.
 */
const PIN_LENGTH = GAP + 0.004;
const PIN_PROFILE = Arr.map(
  [
    [0.0001, -PIN_LENGTH / 2],
    [PIN_RADIUS * 0.7, -PIN_LENGTH / 2],
    [PIN_RADIUS * 0.7, -PIN_LENGTH / 2 + 0.0038],
    [PIN_RADIUS * 1.35, -PIN_LENGTH / 2 + 0.004],
    [PIN_RADIUS * 1.35, -PIN_LENGTH / 2 + 0.0046],
    [PIN_RADIUS, -PIN_LENGTH / 2 + 0.005],
    [PIN_RADIUS, PIN_LENGTH / 2 - 0.0006],
    [PIN_RADIUS * 0.6, PIN_LENGTH / 2],
    [0.0001, PIN_LENGTH / 2],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** The brass pins, each set into the backboard and reaching the glass. */
function Pins({ rows }: { readonly rows: number }) {
  const placements = useMemo<readonly Placement[]>(
    () =>
      Arr.map(pinPoints(rows), (pin) => ({
        position: [pin.x, pin.y, (GAP - 0.004) / 2],
        rotation: [Math.PI / 2, 0, 0],
      })),
    [rows]
  );
  return (
    <Instances placements={placements}>
      <latheGeometry args={[PIN_PROFILE, 28]} />
      <Matter finish="polished" of="brass" />
    </Instances>
  );
}

/**
 * The bins under the pins: a maple divider between every two, numbered on
 * the base rail by the rights each counts. On a narrow card, or with more
 * than eight rows, every other bin carries its number, so the numbers never
 * crowd into each other.
 */
function Bins({ rows }: { readonly rows: number }) {
  const ink = useLabelInk();
  const size = useThree((state) => state.size);
  const step = rows > 8 || size.width < size.height * 1.2 ? 2 : 1;
  const top = dividerTop(rows);
  const placements = Arr.map(
    dividerXs(rows),
    (x): Placement => ({ position: [x, (BIN_FLOOR + top) / 2, GAP / 2] })
  );
  return (
    <group>
      <Instances placements={placements}>
        <boxGeometry args={[DIVIDER, top - BIN_FLOOR, GAP]} />
        <Maple />
      </Instances>
      {Arr.map(
        Arr.filter(Arr.range(0, rows), (bin) => bin % step === 0),
        (bin) => (
          <ThreeLabel
            color={ink}
            fontSize={BIN_NUMBER}
            key={bin}
            maximumFontSize={15}
            position={[
              binCentre(rows, bin),
              (FOOT_HEIGHT + BIN_FLOOR) / 2,
              FRONT + 0.002,
            ]}
          >
            {String(bin)}
          </ThreeLabel>
        )
      )}
    </group>
  );
}

/** Oak, the wedge's wood. */
function Oak() {
  return <Matter of="oak" />;
}

/** The oak wedge under the raised foot of a leaning board, its top along the foot's sole. */
function Wedge({
  points,
}: {
  readonly points: readonly { readonly x: number; readonly y: number }[];
}) {
  const shape = useMemo(() => {
    const outline = new Shape();
    Arr.forEach(points, (point, index) => {
      if (index === 0) {
        outline.moveTo(point.x, point.y);
      } else {
        outline.lineTo(point.x, point.y);
      }
    });
    return outline;
  }, [points]);
  if (points.length === 0) {
    return null;
  }
  return (
    <mesh castShadow position={[0, 0, MIDDLE - FOOT_DEPTH / 2]} receiveShadow>
      <extrudeGeometry
        args={[shape, { bevelEnabled: false, depth: FOOT_DEPTH }]}
      />
      <Oak />
    </mesh>
  );
}
