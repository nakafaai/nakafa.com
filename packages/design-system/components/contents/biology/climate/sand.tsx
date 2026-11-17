import { TANK } from "@repo/design-system/components/contents/biology/climate/tank";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  DataTexture,
  ExtrudeGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
} from "three";

/**
 * The aragonite sand bed: 3 cm deep at the front glass and banked 1.2 cm
 * higher at the back, as aquascapers slope it, in metres.
 */
const SAND = { bank: 0.012, front: 0.03 };

/** Texels across one tile of grain, and the metres one tile covers: a texel is about one 0.6 mm grain. */
const GRAIN_SIZE = 256;
const GRAIN_TILE = 0.15;

/**
 * The byte an average grain is written at. The bed takes the room's light
 * and the reef light at once, which would burn white sand out to a flat
 * white; written below full, it keeps the shadows the corals cast.
 */
const GRAIN_LEVEL = 200;

/** The pieces of dead coral rubble scattered over the sand. */
const RUBBLE = 32;

/** How high the sand stands at depth `z` before its ripples. */
export function sandLevel(z: number) {
  return SAND.front + SAND.bank * (0.5 - z / TANK.depth);
}

/**
 * How high the sand stands at `(x, z)`: its level with the shallow ripples
 * the current leaves, smoothed flat round each clearing `[x, z, radius]`
 * where a coral or the heater stands, so each sits on the level beneath it.
 */
function sandHeight(
  x: number,
  z: number,
  clearings: readonly (readonly [number, number, number])[]
) {
  const ripple =
    0.0014 * (valueNoise(x * 28 + 3, z * 28, 64) - 0.5) +
    0.0006 * (valueNoise(x * 90, z * 90 + 7, 256) - 0.5);
  const open = Arr.reduce(clearings, 1, (least, [cx, cz, radius]) =>
    Math.min(
      least,
      MathUtils.smoothstep(Math.hypot(x - cx, z - cz), radius, radius + 0.02)
    )
  );
  return sandLevel(z) + ripple * open;
}

/**
 * The grain of the sand: each texel one grain, mostly cream with paler and
 * darker grains among them and now and then a dark speck of shell or
 * coralline.
 */
function grainOf() {
  const data = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE * 4);
  for (const row of Arr.range(0, GRAIN_SIZE - 1)) {
    for (const column of Arr.range(0, GRAIN_SIZE - 1)) {
      const grain = hashUnit(column, row);
      const speck = hashUnit(row + 91, column + 17) > 0.985 ? 0.7 : 1;
      const patch = valueNoise(column / 24, row / 24, GRAIN_SIZE / 24);
      const value = (0.9 + 0.14 * grain + 0.1 * (patch - 0.5)) * speck;
      const warm = hashUnit(column + 5, row + 3) * 0.06;
      data.set(
        [
          Math.min(255, Math.round(value * GRAIN_LEVEL)),
          Math.min(255, Math.round(value * (0.98 - warm * 0.3) * GRAIN_LEVEL)),
          Math.min(255, Math.round(value * (0.95 - warm) * GRAIN_LEVEL)),
          255,
        ],
        (row * GRAIN_SIZE + column) * 4
      );
    }
  }
  const texture = new DataTexture(data, GRAIN_SIZE, GRAIN_SIZE);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / GRAIN_TILE, 1 / GRAIN_TILE);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The surface of the sand and the bed under it, whose cut face shows
 * through the front glass, both with texture coordinates in metres so one
 * grain texture covers them alike.
 */
function bedOf(clearings: readonly (readonly [number, number, number])[]) {
  const length = TANK.length - TANK.glass * 2;
  const depth = TANK.depth - TANK.glass * 2;
  const surface = new PlaneGeometry(length, depth, 180, 105);
  surface.rotateX(-Math.PI / 2);
  const position = surface.getAttribute("position");
  for (const index of Arr.range(0, position.count - 1)) {
    position.setY(
      index,
      sandHeight(position.getX(index), position.getZ(index), clearings)
    );
  }
  const uv = surface.getAttribute("uv");
  for (const index of Arr.range(0, uv.count - 1)) {
    uv.setXY(index, uv.getX(index) * length, uv.getY(index) * depth);
  }
  surface.computeVertexNormals();

  const side = new Shape();
  const front = depth / 2;
  side.moveTo(-front, TANK.glass);
  side.lineTo(-front, sandLevel(front) - 0.0015);
  side.lineTo(front, sandLevel(-front) - 0.0015);
  side.lineTo(front, TANK.glass);
  side.closePath();
  const bed = new ExtrudeGeometry(side, { bevelEnabled: false, depth: length });
  bed.rotateY(Math.PI / 2);
  bed.translate(-length / 2, 0, 0);
  return { bed, surface };
}

/**
 * Dead coral rubble on the sand: lumps 8 to 20 mm long, each half sunk,
 * none within a clearing or touching another.
 */
function rubbleOf(clearings: readonly (readonly [number, number, number])[]) {
  const candidates = Arr.map(Arr.range(0, 199), (index) => ({
    size: 0.004 + hashUnit(index, 3) * 0.006,
    tilt: (hashUnit(index, 4) - 0.5) * 0.5,
    turn: hashUnit(index, 5) * Math.PI * 2,
    x: (hashUnit(index, 1) - 0.5) * (TANK.length - 0.06),
    z: (hashUnit(index, 2) - 0.5) * (TANK.depth - 0.06),
  }));
  const kept = Arr.reduce(
    candidates,
    Arr.empty<(typeof candidates)[number]>(),
    (chosen, piece) => {
      const clear =
        Arr.every(
          clearings,
          ([cx, cz, radius]) =>
            Math.hypot(piece.x - cx, piece.z - cz) >
            radius + piece.size * 2 + 0.006
        ) &&
        Arr.every(
          chosen,
          (other) =>
            Math.hypot(piece.x - other.x, piece.z - other.z) >
            (piece.size + other.size) * 2.2 + 0.004
        );
      return clear && chosen.length < RUBBLE
        ? Arr.append(chosen, piece)
        : chosen;
    }
  );
  return Arr.map(kept, (piece) => ({
    position: [
      piece.x,
      sandHeight(piece.x, piece.z, clearings) - piece.size * 0.25,
      piece.z,
    ] as const,
    rotation: [piece.tilt, piece.turn, piece.tilt * 0.6] as const,
    scale: [piece.size * 2.4, piece.size * 0.9, piece.size] as const,
  }));
}

/**
 * The sand bed with its rubble, its grain textured and lit, smoothed flat
 * round each clearing `[x, z, radius]`.
 */
export function SandBed({
  clearings,
}: {
  readonly clearings: readonly (readonly [number, number, number])[];
}) {
  const { bed, surface } = useMemo(() => bedOf(clearings), [clearings]);
  const rubble = useMemo(() => rubbleOf(clearings), [clearings]);
  const lump = useBumpySphere(1, 4, 0.22);
  const { bump, color } = useMemo(() => {
    const grain = grainOf();
    const tinted = grain.clone();
    tinted.colorSpace = SRGBColorSpace;
    tinted.needsUpdate = true;
    return { bump: grain, color: tinted };
  }, []);
  useEffect(
    () => () => {
      bed.dispose();
      surface.dispose();
    },
    [bed, surface]
  );
  useEffect(
    () => () => {
      bump.dispose();
      color.dispose();
    },
    [bump, color]
  );
  return (
    <group>
      <mesh geometry={surface} receiveShadow>
        <meshStandardMaterial
          bumpMap={bump}
          bumpScale={0.6}
          color={ECOLOGY_COLORS.reefSand}
          map={color}
          roughness={0.95}
        />
      </mesh>
      <mesh geometry={bed}>
        <meshStandardMaterial
          bumpMap={bump}
          bumpScale={0.6}
          color={ECOLOGY_COLORS.reefSand}
          map={color}
          roughness={0.95}
        />
      </mesh>
      <Instances placements={rubble}>
        <primitive attach="geometry" object={lump} />
        <meshStandardMaterial
          bumpMap={bump}
          bumpScale={0.6}
          color={ECOLOGY_COLORS.coralRubble}
          map={color}
          roughness={0.92}
        />
      </Instances>
    </group>
  );
}
