import type { Colony } from "@repo/design-system/components/contents/biology/climate/coral";
import {
  TissueMaterial,
  useTissuePaint,
} from "@repo/design-system/components/contents/biology/climate/coral";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { BufferAttribute, MathUtils, SphereGeometry, Vector3 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** How tall the dome stands for its radius: brain corals grow as low domes. */
const DOME = 0.7;

/** How deep a valley runs below its walls, as a share of the dome's radius. */
const RELIEF = 0.045;

/**
 * The waves whose sum, cut at zero, draws the maze: 16 plane waves 9 mm long
 * on a dome 13 cm across, as Platygyra spaces its valleys, heading within
 * about 50 degrees of one direction so the valleys run on in long meanders
 * rather than breaking into worms.
 */
const WAVES = 16;
const WAVENUMBER = 44;
const SPREAD = 1.2;
const HEADING = new Vector3(0.8, 0.2, 0.56);

/** How far slow noise bends the maze, in units of the dome's radius. */
const BEND = 1.2;

/** Seeded value noise in three dimensions, from three crossed planes. */
function noise3(x: number, y: number, z: number) {
  return (
    (valueNoise(x, y, 256) +
      valueNoise(y + 41.3, z + 3.7, 256) +
      valueNoise(z + 17.9, x + 9.1, 256)) /
    3
  );
}

/** The plane waves of colony `seed`: each a direction and a phase. */
function wavesOf(seed: number) {
  return Arr.map(Arr.range(0, WAVES - 1), (index) => ({
    direction: new Vector3(
      hashUnit(seed, index) * 2 - 1,
      hashUnit(seed + 1, index) * 2 - 1,
      hashUnit(seed + 3, index) * 2 - 1
    )
      .multiplyScalar(SPREAD)
      .add(HEADING)
      .normalize()
      .multiplyScalar(WAVENUMBER),
    phase: hashUnit(seed + 2, index) * Math.PI * 2,
  }));
}

/**
 * How high the surface stands at unit direction `point`, from 0 on a valley
 * floor to 1 on a wall's crest. Waves of one length summed in many
 * directions and cut at zero draw a labyrinth of even width, the pattern
 * Turing's reaction and diffusion grows in a brain coral; slow noise bends
 * it, and a smooth step rounds the crests between broad U-shaped valleys.
 */
function meanderOf(
  point: Vector3,
  seed: number,
  waves: ReturnType<typeof wavesOf>
) {
  const bend = (offset: number) =>
    BEND *
    (noise3(
      point.x * 1.5 + seed + offset,
      point.y * 1.5 + offset,
      point.z * 1.5 - offset
    ) -
      0.5);
  const bent = new Vector3(
    point.x + bend(0),
    point.y + bend(9),
    point.z + bend(21)
  );
  const sum = Arr.reduce(
    waves,
    0,
    (total, wave) => total + Math.cos(bent.dot(wave.direction) + wave.phase)
  );
  return MathUtils.smoothstep(sum / Math.sqrt(WAVES / 2), -0.35, 0.75);
}

/**
 * The dome of a brain coral `radius` across, its surface raised into walls
 * and sunk into valleys. A valley's tissue is darker and a wall's crest
 * paler, and the dead skeleton at the foot, where the colony meets the sand,
 * darker still. Its foot curls just under the sand.
 */
function brainOf(radius: number, seed: number) {
  const sphere = new SphereGeometry(
    1,
    288,
    96,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2 + 0.2
  );
  sphere.deleteAttribute("normal");
  sphere.deleteAttribute("uv");
  const dome = mergeVertices(sphere);
  sphere.dispose();
  const position = dome.getAttribute("position");
  const tipness = new Float32Array(position.count);
  const shade = new Float32Array(position.count);
  const point = new Vector3();
  const waves = wavesOf(seed);
  for (const index of Arr.range(0, position.count - 1)) {
    point.fromBufferAttribute(position, index);
    const foot = 1 - MathUtils.smoothstep(point.y, -0.05, 0.12);
    const wall = meanderOf(point, seed, waves) * (1 - foot);
    const lift = radius * (1 + RELIEF * (wall - 0.5));
    const height = point.y >= 0 ? point.y * DOME : point.y * 0.5;
    position.setXYZ(index, point.x * lift, height * lift, point.z * lift);
    tipness[index] = wall * 0.3;
    shade[index] = (0.58 + 0.42 * wall) * (1 - foot * 0.3);
  }
  dome.setAttribute("tipness", new BufferAttribute(tipness, 1));
  dome.setAttribute("shade", new BufferAttribute(shade, 1));
  dome.computeVertexNormals();
  return dome;
}

/**
 * A brain coral such as Platygyra: a low dome whose living surface folds
 * into meandering walls and valleys, seeded so every visit shows the same
 * maze, resting on the sand at `position`.
 */
export function BrainCoral({
  colony,
  position,
  radius,
  seed,
}: {
  readonly colony: Colony;
  readonly position: readonly [number, number, number];
  readonly radius: number;
  readonly seed: number;
}) {
  const geometry = useMemo(() => brainOf(radius, seed), [radius, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useTissuePaint(geometry, colony);
  return (
    <mesh castShadow geometry={geometry} position={position} receiveShadow>
      <TissueMaterial />
    </mesh>
  );
}
