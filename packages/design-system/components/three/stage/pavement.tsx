import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import {
  paintDashes,
  paintVerge,
} from "@repo/design-system/components/three/stage/grain";
import { pathStrip } from "@repo/design-system/components/three/stage/strip";
import {
  groundTexture,
  useGround,
} from "@repo/design-system/components/three/stage/terrain";
import { getColor } from "@repo/design-system/lib/color";
import { type ReactNode, useEffect, useMemo } from "react";
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
 * The mesh of one band of the pavement: the strip a path sweeps between two
 * offsets to its side. It is freed with the component that asked for it.
 */
function useBand(
  path: readonly Place[],
  closed: boolean,
  from: number,
  to: number
) {
  const geometry = useMemo(() => {
    const strip = pathStrip(path, closed, from, to);
    const band = new BufferGeometry();
    band.setAttribute("position", new BufferAttribute(strip.positions, 3));
    band.setAttribute("uv", new BufferAttribute(strip.uvs, 2));
    band.setIndex(strip.indices);
    band.computeVertexNormals();
    return band;
  }, [closed, from, path, to]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}

/** One band of the pavement at its layer above the floor. The caller composes its material. */
function Band({
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
    >
      {children}
    </mesh>
  );
}

/**
 * Asphalt along any path on the lab's ground, built as `Road` is: a gravel
 * shoulder that fades into the ground on both sides, the asphalt, its two
 * edge lines and its dashed centre line. The camera leaves it out when it
 * frames the lab.
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
  const asphalt = useGround("asphalt", [1 / (width * 0.8), 1.25]);
  const shoulder = useGround("soil", [1 / (width * 0.5), 0.7]);
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

  const paint = getColor("ZINC", 100);
  const edge = width / 2 - LINE_WIDTH * 1.6;
  const bands = {
    near: useBand(path, closed, -width * 0.85, -width * 0.5),
    far: useBand(path, closed, width * 0.5, width * 0.85),
    asphaltBand: useBand(path, closed, -width / 2, width / 2),
    dashes: useBand(path, closed, -LINE_WIDTH / 2, LINE_WIDTH / 2),
    farLine: useBand(
      path,
      closed,
      edge - LINE_WIDTH / 2,
      edge + LINE_WIDTH / 2
    ),
    nearLine: useBand(
      path,
      closed,
      -edge - LINE_WIDTH / 2,
      -edge + LINE_WIDTH / 2
    ),
  };

  return (
    <CameraBounds exclude>
      <Band geometry={bands.near} layer={1}>
        <meshStandardMaterial
          alphaMap={marks.inner}
          bumpMap={shoulder.bump}
          bumpScale={0.8}
          depthWrite={false}
          map={shoulder.map}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-4}
          roughness={0.96}
          transparent
        />
      </Band>
      <Band geometry={bands.far} layer={1}>
        <meshStandardMaterial
          alphaMap={marks.outer}
          bumpMap={shoulder.bump}
          bumpScale={0.8}
          depthWrite={false}
          map={shoulder.map}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-4}
          roughness={0.96}
          transparent
        />
      </Band>
      <Band geometry={bands.asphaltBand} layer={2}>
        <meshStandardMaterial
          aoMap={asphalt.patches}
          aoMapIntensity={0.8}
          bumpMap={asphalt.bump}
          bumpScale={0.35}
          map={asphalt.map}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-8}
          roughness={0.86}
        />
      </Band>
      <Band geometry={bands.dashes} layer={3}>
        <meshStandardMaterial
          alphaMap={marks.dashes}
          alphaTest={0.5}
          color={paint}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-12}
          roughness={0.7}
          transparent
        />
      </Band>
      <Band geometry={bands.farLine} layer={3}>
        <meshStandardMaterial
          color={paint}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-12}
          roughness={0.7}
        />
      </Band>
      <Band geometry={bands.nearLine} layer={3}>
        <meshStandardMaterial
          color={paint}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-12}
          roughness={0.7}
        />
      </Band>
    </CameraBounds>
  );
}
