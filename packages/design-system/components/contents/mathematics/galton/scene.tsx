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
import { woodGrain } from "@repo/design-system/components/contents/mathematics/galton/wood";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { GALTON_COLORS } from "@repo/design-system/lib/material/galton";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import type { Texture } from "three";
import {
  DataTexture,
  LinearFilter,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
} from "three";

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
            <GlassMaterial color={GALTON_COLORS.glass} opacity={0.1} />
          </mesh>
        </group>
      </group>
      <Wedge points={pose.wedge} />
    </group>
  );
}

/** The walnut frame on its two feet, and the painted backboard inside it. */
function Frame() {
  const along = useGrain(false);
  const upright = useGrain(true);
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
        <meshStandardMaterial
          color={GALTON_COLORS.backboard}
          roughness={0.82}
        />
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
            <Walnut grain={upright} />
          </RoundedBox>
          <RoundedBox
            args={[FOOT_WIDTH, FOOT_HEIGHT, FOOT_DEPTH]}
            castShadow
            position={[side * FOOT_X, FOOT_HEIGHT / 2, MIDDLE]}
            radius={0.004}
            receiveShadow
          >
            <Walnut grain={along} />
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
        <Walnut grain={along} />
      </RoundedBox>
      <RoundedBox
        args={[2 * INNER_HALF, TOP_RAIL, DEPTH]}
        castShadow
        position={[0, INNER_TOP + TOP_RAIL / 2, MIDDLE]}
        radius={0.003}
        receiveShadow
      >
        <Walnut grain={along} />
      </RoundedBox>
    </group>
  );
}

/**
 * A wood grain texture whose lines run along a face's width, or turned to
 * run along its height for an upright rail, repeated `repeat` times over a
 * face's texture coordinates (a shape's own geometry measures them in
 * metres). It is built once from the deterministic grain field and freed
 * with the scene.
 */
function useGrain(turned: boolean, repeat = 1) {
  const texture = useMemo(() => {
    const width = 256;
    const height = 64;
    const shades = woodGrain(width, height);
    const data = new Uint8Array(width * height * 4);
    Arr.forEach(Arr.range(0, width * height - 1), (index) => {
      const value = Math.round((shades[index] ?? 1) * 255);
      data.set([value, value, value, 255], index * 4);
    });
    const grain = new DataTexture(data, width, height);
    grain.wrapS = RepeatWrapping;
    grain.wrapT = RepeatWrapping;
    grain.magFilter = LinearFilter;
    grain.minFilter = LinearFilter;
    grain.repeat.set(repeat, repeat);
    grain.colorSpace = SRGBColorSpace;
    grain.center.set(0.5, 0.5);
    grain.rotation = turned ? Math.PI / 2 : 0;
    grain.needsUpdate = true;
    return grain;
  }, [repeat, turned]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Oiled walnut: a soft sheen over a dark, open grain. */
function Walnut({ grain }: { readonly grain: Texture }) {
  return (
    <meshPhysicalMaterial
      clearcoat={0.35}
      clearcoatRoughness={0.45}
      color={GALTON_COLORS.walnut}
      map={grain}
      roughness={0.6}
    />
  );
}

/** Light maple, for the hopper floor and the dividers: strips so thin that their grain does not show. */
function Maple() {
  return <meshStandardMaterial color={GALTON_COLORS.maple} roughness={0.55} />;
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
      <cylinderGeometry args={[PIN_RADIUS, PIN_RADIUS, GAP + 0.004, 14]} />
      <meshPhysicalMaterial
        clearcoat={0.5}
        color={GALTON_COLORS.pin}
        metalness={1}
        roughness={0.28}
      />
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
            minimumFontSize={11}
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
  const grain = useGrain(false, 12);
  return (
    <meshStandardMaterial
      color={GALTON_COLORS.oak}
      map={grain}
      roughness={0.7}
    />
  );
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
