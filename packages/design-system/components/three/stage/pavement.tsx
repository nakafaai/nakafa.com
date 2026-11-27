import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import {
  paintDashes,
  paintVerge,
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

/** The paint of a road line, drawn nearer the camera than the asphalt under it. */
function Paint({ dashes }: { readonly dashes?: ReturnType<typeof verge> }) {
  const { reach } = useStage();
  const horizonFade = useHorizonFade(
    HORIZON_FADE_INNER * reach,
    HORIZON_FADE_OUTER * reach
  );

  return (
    <meshStandardMaterial
      alphaMap={dashes ?? null}
      alphaTest={dashes === undefined ? 0 : 0.5}
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
 * Asphalt along any path on the lab's ground: a gravel shoulder that fades
 * into the ground on both sides, the asphalt, its two edge lines and its
 * dashed centre line, all laid on the ground's relief. The camera leaves it
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
      dashes: groundTexture(paintDashes(64, dash / spacing), 64, 1, [
        1 / spacing,
        1,
      ]),
      inner: verge(0),
      outer: verge(0.5),
    }),
    [dash, spacing]
  );

  useEffect(
    () => () => {
      marks.dashes.dispose();
      marks.inner.dispose();
      marks.outer.dispose();
    },
    [marks]
  );

  const way = useWay(path, closed);
  const edge = width / 2 - LINE_WIDTH * 1.6;
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
          repeat={[1 / (width * 0.8), 1.25]}
        />
      </Band>
      <Band geometry={bands.dashes} layer={3}>
        <Paint dashes={marks.dashes} />
      </Band>
      <Band geometry={bands.farLine} layer={3}>
        <Paint />
      </Band>
      <Band geometry={bands.nearLine} layer={3}>
        <Paint />
      </Band>
    </CameraBounds>
  );
}
