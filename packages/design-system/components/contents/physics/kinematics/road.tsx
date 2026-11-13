import { Instance, Instances } from "@react-three/drei";
import type { Surface } from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/friction";
import {
  grainField,
  hashUnit,
} from "@repo/design-system/components/contents/simulation/grain";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { DataTexture, type Group, RepeatWrapping, SRGBColorSpace } from "three";
import { MATERIAL } from "@repo/design-system/lib/material";
import { getColor } from "@repo/design-system/lib/color";

/**
 * A two-lane road at real scale, in metres: lanes of 3.5 m, a kerb, a
 * pavement, lamp posts and a row of trees on the left (−z), a grass verge on
 * the right (+z), and white distance posts every 10 m from the line where the
 * hazard appears. Traffic keeps left, as in Indonesia and Malaysia: the car
 * drives in the left lane toward +x, and the camera watches from the verge
 * across the empty right lane, so the car moves left to right on screen with
 * the pavement and trees behind it.
 */
export const ROAD = {
  edge: 3.35,
  lane: -1.75,
  halfWidth: 3.5,
  kerb: 0.15,
  pavement: 2.2,
  side: -1,
} as const;

/** How each surface looks: its base colour, its gloss and its grain. */
const SURFACE_LOOK = {
  dry: { clearcoat: 0, color: MATERIAL.asphalt, grain: 0.5, roughness: 0.88 },
  gravel: { clearcoat: 0, color: MATERIAL.gravel, grain: 0.9, roughness: 1 },
  ice: { clearcoat: 1, color: MATERIAL.ice, grain: 0.18, roughness: 0.06 },
  snow: { clearcoat: 0, color: MATERIAL.snow, grain: 0.28, roughness: 0.82 },
  wet: { clearcoat: 0.85, color: MATERIAL.wetAsphalt, grain: 0.42, roughness: 0.2 },
} satisfies Record<
  Surface,
  { clearcoat: number; color: string; grain: number; roughness: number }
>;

/** Grain texels per side; one tile of grain covers four metres of road. */
const GRAIN_SIZE = 256;
const GRAIN_TILE = 4;

/** Dashes of the centre line: 3 m of paint, then 5 m of road. */
const DASH = 3;
const DASH_GAP = 5;

/**
 * Builds the grain texture of one surface: a brightness that varies around
 * one, so the material's own colour stays the mean colour of the road.
 */
function createGrainTexture(contrast: number) {
  const field = grainField(GRAIN_SIZE);
  const data = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE * 4);
  for (let index = 0; index < field.length; index += 1) {
    const value = 1 + (field[index] - 0.5) * contrast;
    const byte = Math.max(0, Math.min(255, Math.round(value * 200)));
    data[index * 4] = byte;
    data[index * 4 + 1] = byte;
    data[index * 4 + 2] = byte;
    data[index * 4 + 3] = 255;
  }
  const texture = new DataTexture(data, GRAIN_SIZE, GRAIN_SIZE);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** The grain texture of `surface`, repeated over the road and disposed after. */
function useGrain(surface: Surface, length: number) {
  const grain = useMemo(
    () => createGrainTexture(SURFACE_LOOK[surface].grain),
    [surface]
  );
  const color = useMemo(() => {
    const texture = grain.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [grain]);

  useEffect(() => {
    for (const texture of [grain, color]) {
      texture.repeat.set(
        length / GRAIN_TILE,
        (2 * ROAD.halfWidth) / GRAIN_TILE
      );
    }
    return () => {
      grain.dispose();
      color.dispose();
    };
  }, [color, grain, length]);

  return { color, grain };
}

/**
 * The road, its markings, its kerb and pavement, and the roadside, from
 * `from` to `to` metres along it. `posts` lists the distance posts to draw.
 */
export function Road({
  from,
  posts,
  surface,
  to,
}: {
  readonly from: number;
  readonly posts: readonly number[];
  readonly surface: Surface;
  readonly to: number;
}) {
  const length = to - from;
  const middle = (from + to) / 2;
  const look = SURFACE_LOOK[surface];
  const { color, grain } = useGrain(surface, length);
  const dashes = Arr.map(
    Arr.range(0, Math.floor(length / (DASH + DASH_GAP))),
    (index) => from + index * (DASH + DASH_GAP) + DASH / 2
  );
  const trees = Arr.map(
    Arr.range(0, Math.floor(length / 17)),
    (index) => from + 6 + index * 17
  );
  const lamps = Arr.map(
    Arr.range(0, Math.floor(length / 32)),
    (index) => from + 14 + index * 32
  );

  return (
    <group>
      <mesh
        position={[middle, 0, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[length, 2 * ROAD.halfWidth]} />
        <meshPhysicalMaterial
          bumpMap={grain}
          bumpScale={surface === "gravel" ? 3 : 0.6}
          clearcoat={look.clearcoat}
          clearcoatRoughness={0.12}
          color={look.color}
          map={color}
          roughness={look.roughness}
          roughnessMap={grain}
        />
      </mesh>

      <RoadPaint count={dashes.length + 3}>
        {Arr.map(dashes, (x) => (
          <Instance key={x} position={[x, 0.004, 0]} scale={[DASH, 1, 0.12]} />
        ))}
        {Arr.map([1, -1] as const, (side) => (
          <Instance
            key={side}
            position={[middle, 0.004, side * ROAD.edge]}
            scale={[length, 1, 0.15]}
          />
        ))}
        <Instance position={[0, 0.004, ROAD.lane]} scale={[0.4, 1, 3.3]} />
      </RoadPaint>

      {Arr.map([1, -1] as const, (side) => (
        <mesh
          key={side}
          position={[middle, ROAD.kerb / 2, side * (ROAD.halfWidth + 0.08)]}
          receiveShadow
        >
          <boxGeometry args={[length, ROAD.kerb, 0.16]} />
          <meshStandardMaterial color={MATERIAL.kerb} roughness={0.9} />
        </mesh>
      ))}
      <mesh
        position={[
          middle,
          ROAD.kerb - 0.02,
          ROAD.side * (ROAD.halfWidth + 0.16 + ROAD.pavement / 2),
        ]}
        receiveShadow
      >
        <boxGeometry args={[length, 0.04, ROAD.pavement]} />
        <meshStandardMaterial color={MATERIAL.pavement} map={color} roughness={0.95} />
      </mesh>
      <Grass middle={middle} />

      <Trees positions={trees} />
      <Lamps positions={lamps} />
      <DistancePosts posts={posts} />
    </group>
  );
}

/** How far the ground runs every way from the road, past where the haze hides it. */
const GROUND = 2400;

/**
 * The grass that runs to the horizon. Its grain tiles every eight metres in
 * both directions, so it never stretches into streaks, and the haze turns it
 * to sky long before its edge.
 */
function Grass({ middle }: { readonly middle: number }) {
  const texture = useMemo(() => {
    const grain = createGrainTexture(0.7);
    grain.colorSpace = SRGBColorSpace;
    grain.repeat.set(GROUND / 8, GROUND / 8);
    return grain;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={[middle, -0.01, 0]}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[GROUND, GROUND]} />
      <meshStandardMaterial color={MATERIAL.grass} map={texture} roughness={1} />
    </mesh>
  );
}

/** White road paint: every dash and line is one instance of one thin slab. */
function RoadPaint({
  children,
  count,
}: {
  readonly children: ReactNode;
  readonly count: number;
}) {
  return (
    <Instances limit={count} receiveShadow>
      <boxGeometry args={[1, 0.006, 1]} />
      <meshStandardMaterial color={MATERIAL.roadPaint} roughness={0.6} />
      {children}
    </Instances>
  );
}

/** How many leafy lumps make up one crown. */
const CROWN_LUMPS = 11;

/** Leaf greens of a tropical roadside tree, sunlit to shaded. */
const LEAVES = [MATERIAL.foliageShade, MATERIAL.foliage, MATERIAL.foliageDark, MATERIAL.foliageLight] as const;

/**
 * The lumps of one crown: a broad, flattened dome of leafy clusters, as a
 * tropical shade tree such as an angsana spreads over a road. Every tree
 * draws its own lumps from the grain hash, so no two trees match.
 */
function crownOf(x: number, tree: number) {
  return Arr.map(Arr.range(0, CROWN_LUMPS - 1), (lump) => {
    const angle = (lump / CROWN_LUMPS) * Math.PI * 2 + hashUnit(tree, lump);
    const spread = lump === 0 ? 0 : 1.2 + 1.3 * hashUnit(lump, tree + 7);
    return {
      color: LEAVES[(tree + lump) % LEAVES.length],
      key: `${x}-${lump}`,
      position: [
        x + Math.cos(angle) * spread,
        4.1 + 0.9 * hashUnit(tree + 3, lump) - spread * 0.25,
        ROAD.side * 10 + Math.sin(angle) * spread,
      ] as const,
      scale: 1.05 + 0.6 * hashUnit(lump + 11, tree),
    };
  });
}

/** Roadside trees beyond the pavement: trunks and broad leafy crowns. */
function Trees({ positions }: { readonly positions: readonly number[] }) {
  return (
    <group>
      <Instances castShadow limit={Math.max(1, positions.length)}>
        <cylinderGeometry args={[0.14, 0.26, 4, 10]} />
        <meshStandardMaterial color={MATERIAL.bark} roughness={1} />
        {Arr.map(positions, (x) => (
          <Instance key={x} position={[x, 2, ROAD.side * 10]} />
        ))}
      </Instances>
      <Instances castShadow limit={Math.max(1, positions.length) * CROWN_LUMPS}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.95} />
        {Arr.flatMap(positions, (x, tree) =>
          Arr.map(crownOf(x, tree), (lump) => (
            <Instance
              color={lump.color}
              key={lump.key}
              position={lump.position}
              scale={[lump.scale, lump.scale * 0.72, lump.scale]}
            />
          ))
        )}
      </Instances>
    </group>
  );
}

/** Street lamps on the pavement, a slim pole with an arm over the road. */
function Lamps({ positions }: { readonly positions: readonly number[] }) {
  const z = ROAD.side * (ROAD.halfWidth + 0.5);
  return (
    <group>
      <Instances castShadow limit={Math.max(1, positions.length)}>
        <cylinderGeometry args={[0.06, 0.09, 7, 10]} />
        <meshStandardMaterial color={MATERIAL.lampPost} metalness={0.8} roughness={0.4} />
        {Arr.map(positions, (x) => (
          <Instance key={x} position={[x, 3.5, z]} />
        ))}
      </Instances>
      <Instances castShadow limit={Math.max(1, positions.length)}>
        <boxGeometry args={[0.12, 0.08, 1.6]} />
        <meshStandardMaterial color={MATERIAL.lampPost} metalness={0.8} roughness={0.4} />
        {Arr.map(positions, (x) => (
          <Instance key={x} position={[x, 6.95, z - ROAD.side * 0.75]} />
        ))}
      </Instances>
    </group>
  );
}

/** Distance posts at the kerb, each labelled with its distance from the hazard. */
function DistancePosts({ posts }: { readonly posts: readonly number[] }) {
  const z = ROAD.side * (ROAD.halfWidth + 0.35);
  return (
    <group>
      <Instances castShadow limit={Math.max(1, posts.length)}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <meshStandardMaterial color={MATERIAL.distancePost} roughness={0.5} />
        {Arr.map(posts, (x) => (
          <Instance key={x} position={[x, 0.5, z]} />
        ))}
      </Instances>
      {Arr.map(posts, (x) => (
        <ThreeLabel
          color={getColor("GRAY", 800)}
          fontSize="compact"
          key={x}
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.06}
          position={[x, 1.35, z]}
        >
          {`${x} m`}
        </ThreeLabel>
      ))}
    </group>
  );
}

/** What a simulation draws of the marks the locked tyres leave. */
export interface SkidRig {
  /** Lays the marks from where braking began to where the car is now. */
  readonly draw: (from: number, to: number) => void;
}

/**
 * The two marks locked tyres leave behind: rubber on asphalt, a groove on
 * gravel or snow, a polished track on ice. A simulation stretches them
 * through `ref` as the car slides.
 */
export function SkidMarks({
  color,
  opacity,
  ref,
  rear,
  track,
}: {
  readonly color: string;
  readonly opacity: number;
  readonly ref?: Ref<SkidRig>;
  /** How far behind the car's origin the rear tyres sit. */
  readonly rear: number;
  /** The car's track: the distance between its left and right tyres. */
  readonly track: number;
}) {
  const marks = useRef<Group>(null);

  useImperativeHandle(ref, () => ({
    draw: (from, to) => {
      const group = marks.current;
      if (!group) {
        return;
      }
      const length = to + rear - from;
      group.visible = length > 0.05;
      group.position.x = from + length / 2;
      group.scale.x = Math.max(0.001, length);
    },
  }));

  return (
    <group ref={marks} visible={false}>
      {Arr.map([1, -1] as const, (side) => (
        <mesh
          key={side}
          position={[0, 0.006, ROAD.lane + (side * track) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1, 0.26]} />
          <meshStandardMaterial
            color={color}
            depthWrite={false}
            opacity={opacity}
            polygonOffset
            polygonOffsetFactor={-2}
            roughness={0.7}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
