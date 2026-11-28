import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import {
  paintLine,
  paintVerge,
  paintWorn,
} from "@repo/design-system/components/three/stage/marks";
import { drape } from "@repo/design-system/components/three/stage/relief";
import {
  densePath,
  pathStrip,
} from "@repo/design-system/components/three/stage/strip";
import {
  GROUND_REACHES,
  GroundMaterial,
  groundTexture,
  HORIZON_FADE_INNER,
  HORIZON_FADE_OUTER,
  useHorizonFade,
  useRelief,
} from "@repo/design-system/components/three/stage/terrain";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";

/**
 * How far each layer of the pavement lies above the one under it. Each layer
 * is also drawn a little nearer the camera than the one under it, because a
 * camera high over a wide lab cannot tell so small a height apart.
 */
const LAYER = 0.004;

/** How wide a painted line is, in scene units. */
const LINE_WIDTH = 0.07;

/** How wide one tile of the asphalt's grain lies, in scene units, so its stones stay the size of real aggregate. */
const GRAIN = 0.6;

/** How far a solid line runs before the wear on its paint repeats, in scene units. */
const LINE_SPAN = 3.7;

/** How far a wheel path runs before its wear repeats, in scene units. */
const WORN_SPAN = 11;

/**
 * Where the wheels of the traffic in each lane run, in road widths from the
 * middle of the road, and how wide the path they polish is.
 */
const WHEELS = { inner: 0.16, outer: 0.34, width: 0.1 } as const;

/** The four wheel paths of a two-lane road, from one side to the other. */
const WHEEL_KEYS = [
  "near-outer",
  "near-inner",
  "far-inner",
  "far-outer",
] as const;

/** A place on the ground: across and along, in scene units. */
type Place = readonly [x: number, z: number];

/** Half of a soft verge: opaque at the pavement's edge and clear at the ground's. `from` picks the half, 0 or 0.5. */
function verge(from: number) {
  const texture = groundTexture(paintVerge(64, 0.5), 1, 64, [1, 0.5]);
  texture.offset.set(0, from);
  return texture;
}

/**
 * A path with enough places along it that a band built on it follows
 * rolling ground: no leg is longer than one step of the ground's own mesh.
 */
export function useWay(path: readonly Place[], closed: boolean) {
  const { profile, reach } = useStage();

  return useMemo(
    () =>
      densePath(path, closed, (GROUND_REACHES * reach) / profile.landSpokes),
    [closed, path, profile, reach]
  );
}

/**
 * The mesh of one band on the ground: the strip a path sweeps between two
 * offsets to its side, laid on the ground's relief. It is freed with the
 * component that asked for it.
 */
export function useBand(
  path: readonly Place[],
  closed: boolean,
  from: number,
  to: number
) {
  const heightAt = useRelief();
  const geometry = useMemo(() => {
    const strip = pathStrip(path, closed, from, to);
    const band = new BufferGeometry();
    band.setAttribute(
      "position",
      new BufferAttribute(drape(strip.positions, heightAt), 3)
    );
    band.setAttribute("uv", new BufferAttribute(strip.uvs, 2));
    band.setIndex(strip.indices);
    band.computeVertexNormals();
    return band;
  }, [closed, from, heightAt, path, to]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}

/** One band on the ground at its layer above the floor. The caller composes its material. */
export function Band({
  children,
  geometry,
  layer,
}: {
  readonly children: ReactNode;
  readonly geometry: BufferGeometry;
  readonly layer: number;
}) {
  const { floor = 0 } = useStage();

  return (
    <mesh
      geometry={geometry}
      position={[0, floor + layer * LAYER, 0]}
      receiveShadow
      renderOrder={-9 + layer}
    >
      {children}
    </mesh>
  );
}

/**
 * The paint of a road line, worn by traffic and weather, drawn nearer the
 * camera than the asphalt under it.
 */
function Paint({ worn }: { readonly worn: ReturnType<typeof verge> }) {
  const { reach } = useStage();
  const horizonFade = useHorizonFade(
    HORIZON_FADE_INNER * reach,
    HORIZON_FADE_OUTER * reach
  );

  return (
    <meshStandardMaterial
      alphaMap={worn}
      alphaTest={0.5}
      color={getColor("ZINC", 100)}
      depthWrite={false}
      polygonOffset
      polygonOffsetFactor={-3}
      polygonOffsetUnits={-12}
      ref={horizonFade}
      roughness={0.7}
      transparent
    />
  );
}

/**
 * The path wheels have polished into the asphalt of a lane: darker with
 * rubber and smoother than the road beside it, so it catches the sky.
 */
function Wear({ worn }: { readonly worn: ReturnType<typeof verge> }) {
  const { reach } = useStage();
  const horizonFade = useHorizonFade(
    HORIZON_FADE_INNER * reach,
    HORIZON_FADE_OUTER * reach
  );

  return (
    <meshStandardMaterial
      alphaMap={worn}
      color={getColor("ZINC", 900)}
      depthWrite={false}
      opacity={0.7}
      polygonOffset
      polygonOffsetFactor={-3}
      polygonOffsetUnits={-12}
      ref={horizonFade}
      roughness={0.48}
      transparent
    />
  );
}

/**
 * Asphalt along any path on the lab's ground, flush with it: a shoulder
 * that fades into the ground on both sides and that grass grows through,
 * the asphalt with the paths wheels have polished into each lane, and its
 * two edge lines and dashed centre line in worn paint, all laid on the
 * ground's relief. The camera leaves it
 * out when it frames the lab.
 *
 * @param path - The places the middle of the pavement passes
 * @param closed - Whether the path returns to its start
 * @param width - How wide the asphalt is
 * @param dash - How long a dash of the centre line is
 * @param spacing - From the start of one dash to the start of the next
 */
export function Pavement({
  closed,
  dash,
  path,
  spacing,
  width,
}: {
  readonly closed: boolean;
  readonly dash: number;
  readonly path: readonly Place[];
  readonly spacing: number;
  readonly width: number;
}) {
  const marks = useMemo(
    () => ({
      dashes: groundTexture(paintLine(256, 16, dash / spacing), 256, 16, [
        1 / spacing,
        1,
      ]),
      inner: verge(0),
      outer: verge(0.5),
      solid: groundTexture(paintLine(256, 16, 1), 256, 16, [1 / LINE_SPAN, 1]),
      worn: groundTexture(paintWorn(64), 64, 64, [1 / WORN_SPAN, 1]),
    }),
    [dash, spacing]
  );

  useEffect(
    () => () => {
      marks.dashes.dispose();
      marks.inner.dispose();
      marks.outer.dispose();
      marks.solid.dispose();
      marks.worn.dispose();
    },
    [marks]
  );

  const way = useWay(path, closed);
  const edge = width / 2 - LINE_WIDTH * 1.6;
  const wheel = (WHEELS.width * width) / 2;
  const paths = [
    useBand(
      way,
      closed,
      -WHEELS.outer * width - wheel,
      -WHEELS.outer * width + wheel
    ),
    useBand(
      way,
      closed,
      -WHEELS.inner * width - wheel,
      -WHEELS.inner * width + wheel
    ),
    useBand(
      way,
      closed,
      WHEELS.inner * width - wheel,
      WHEELS.inner * width + wheel
    ),
    useBand(
      way,
      closed,
      WHEELS.outer * width - wheel,
      WHEELS.outer * width + wheel
    ),
  ] as const;
  const bands = {
    near: useBand(way, closed, -width * 0.85, -width * 0.5),
    far: useBand(way, closed, width * 0.5, width * 0.85),
    asphaltBand: useBand(way, closed, -width / 2, width / 2),
    dashes: useBand(way, closed, -LINE_WIDTH / 2, LINE_WIDTH / 2),
    farLine: useBand(way, closed, edge - LINE_WIDTH / 2, edge + LINE_WIDTH / 2),
    nearLine: useBand(
      way,
      closed,
      -edge - LINE_WIDTH / 2,
      -edge + LINE_WIDTH / 2
    ),
  };

  return (
    <CameraBounds exclude>
      <Band geometry={bands.near} layer={1}>
        <GroundMaterial
          alphaMap={marks.inner}
          depthWrite={false}
          kind="soil"
          layer={1}
          repeat={[1 / (width * 0.5), 0.7]}
        />
      </Band>
      <Band geometry={bands.far} layer={1}>
        <GroundMaterial
          alphaMap={marks.outer}
          depthWrite={false}
          kind="soil"
          layer={1}
          repeat={[1 / (width * 0.5), 0.7]}
        />
      </Band>
      <Band geometry={bands.asphaltBand} layer={2}>
        <GroundMaterial
          kind="asphalt"
          layer={2}
          repeat={[1 / GRAIN, width / GRAIN]}
        />
      </Band>
      {Arr.map(paths, (path, index) => (
        <Band geometry={path} key={WHEEL_KEYS[index]} layer={3}>
          <Wear worn={marks.worn} />
        </Band>
      ))}
      <Band geometry={bands.dashes} layer={3}>
        <Paint worn={marks.dashes} />
      </Band>
      <Band geometry={bands.farLine} layer={3}>
        <Paint worn={marks.solid} />
      </Band>
      <Band geometry={bands.nearLine} layer={3}>
        <Paint worn={marks.solid} />
      </Band>
    </CameraBounds>
  );
}
