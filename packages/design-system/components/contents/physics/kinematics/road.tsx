import { Instance, Instances } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { grainTexture } from "@repo/design-system/components/contents/physics/kinematics/grain";
import type { Surface } from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/friction";
import { roomyLabels } from "@repo/design-system/components/contents/physics/kinematics/ticks";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { paintVerge } from "@repo/design-system/components/three/stage/marks";
import { groundTexture } from "@repo/design-system/components/three/stage/terrain";
import { getColor } from "@repo/design-system/lib/color";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { Array as Arr, Schema } from "effect";
import type { ReactNode, Ref } from "react";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Group } from "three";
import { SRGBColorSpace, Vector3 } from "three";

/**
 * A two-lane country road at real scale, in metres: lanes of 3.5 m, painted
 * edge lines, and on both sides a gravel verge the asphalt ends flush in and
 * the grass grows up to. Nothing of it stands above the ground: it has no
 * kerb and no raised pavement, as a road outside a town has none. White
 * distance posts stand in the verge on the left (−z). The road lies on the
 * stage's own ground: a lab asks its stage for grass and sets the floor a
 * hair under the asphalt. Traffic keeps left, as in Indonesia and Malaysia:
 * the car drives in the left lane toward +x, and the camera watches from the
 * right verge across the empty lane, so the car moves left to right on
 * screen.
 */
export const ROAD = {
  dash: 3,
  edge: 3.35,
  lane: -1.75,
  halfWidth: 3.5,
  side: -1,
  spacing: 8,
} as const;

/** How wide the gravel verge is on each side of the road, in metres. */
const VERGE = 1.5;

/** How a road surface looks: its gloss, its base colour, its grain and its roughness. */
const SurfaceLookSchema = Schema.Struct({
  clearcoat: Schema.Finite,
  color: Schema.String,
  grain: Schema.Finite,
  roughness: Schema.Finite,
});

/** How each surface looks: its base colour, its gloss and its grain. */
const SURFACE_LOOK = {
  dry: {
    clearcoat: 0,
    color: ROAD_COLORS.asphalt,
    grain: 0.5,
    roughness: 0.88,
  },
  gravel: { clearcoat: 0, color: ROAD_COLORS.gravel, grain: 0.9, roughness: 1 },
  ice: { clearcoat: 1, color: ROAD_COLORS.ice, grain: 0.18, roughness: 0.06 },
  snow: { clearcoat: 0, color: ROAD_COLORS.snow, grain: 0.28, roughness: 0.82 },
  wet: {
    clearcoat: 0.85,
    color: ROAD_COLORS.wetAsphalt,
    grain: 0.42,
    roughness: 0.2,
  },
} satisfies Record<Surface, typeof SurfaceLookSchema.Type>;

/** One tile of grain covers four metres of road. */
const GRAIN_TILE = 4;

/** Dashes of the centre line: 3 m of paint, then 5 m of road. */
const DASH = ROAD.dash;
const DASH_GAP = ROAD.spacing - ROAD.dash;

/** The grain texture of `surface`, repeated over the road and disposed after. */
function useGrain(surface: Surface, length: number) {
  const grain = useMemo(
    () => grainTexture(SURFACE_LOOK[surface].grain),
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
 * The soft edges of the two verges: each is solid where it meets the
 * asphalt and thins out into the grass, so no verge ends in a cut line.
 */
function useVergeEdges() {
  const edges = useMemo(() => {
    const far = groundTexture(paintVerge(64, 0.5), 1, 64, [1, 0.5]);
    far.offset.set(0, 0.5);
    return {
      far,
      near: groundTexture(paintVerge(64, 0.5), 1, 64, [1, 0.5]),
    };
  }, []);

  useEffect(
    () => () => {
      edges.far.dispose();
      edges.near.dispose();
    },
    [edges]
  );

  return edges;
}

/**
 * The road, its markings and its two gravel verges, from `from` to `to`
 * metres along it. A lab adds its own `DistancePosts`.
 */
export function Road({
  from,
  surface,
  to,
}: {
  readonly from: number;
  readonly surface: Surface;
  readonly to: number;
}) {
  const length = to - from;
  const middle = (from + to) / 2;
  const look = SURFACE_LOOK[surface];
  const { color, grain } = useGrain(surface, length);
  const edges = useVergeEdges();
  const dashes = Arr.map(
    Arr.range(0, Math.floor(length / (DASH + DASH_GAP))),
    (index) => from + index * (DASH + DASH_GAP) + DASH / 2
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
          position={[middle, 0.002, side * (ROAD.halfWidth + VERGE / 2 - 0.1)]}
          receiveShadow
          renderOrder={-8}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[length, VERGE + 0.2]} />
          <meshStandardMaterial
            alphaMap={side === 1 ? edges.near : edges.far}
            bumpMap={grain}
            bumpScale={2.4}
            color={ROAD_COLORS.gravel}
            depthWrite={false}
            map={color}
            roughness={1}
            transparent
          />
        </mesh>
      ))}
    </group>
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
      <meshStandardMaterial color={ROAD_COLORS.roadPaint} roughness={0.6} />
      {children}
    </Instances>
  );
}

/** The least room between two post labels across the screen, in pixels. */
const LABEL_ROOM = 62;

/**
 * Distance posts in the verge, labelled with their distance from the hazard.
 * A label keeps its size on screen while the posts shrink with distance, so
 * a post carries its label only where the label has room: the labels of a
 * row that runs away from the camera never run into each other.
 */
export function DistancePosts({
  posts,
}: {
  readonly posts: readonly number[];
}) {
  const z = ROAD.side * (ROAD.halfWidth + 0.35);
  const width = useThree((state) => state.size.width);
  const [roomy, setRoomy] = useState(0);
  const sight = useMemo(
    () => ({
      across: new Float32Array(posts.length),
      roomy: 0,
      spot: new Vector3(),
    }),
    [posts.length]
  );

  useFrame(({ camera }) => {
    for (let index = 0; index < posts.length; index += 1) {
      sight.spot.set(Number(posts[index]), 1.35, z).project(camera);
      sight.across[index] =
        Math.abs(sight.spot.x) > 1 || sight.spot.z > 1
          ? Number.NaN
          : (sight.spot.x * width) / 2;
    }
    const next = roomyLabels(sight.across, LABEL_ROOM);
    if (next !== sight.roomy) {
      sight.roomy = next;
      setRoomy(next);
    }
  });

  return (
    <group>
      <Instances castShadow limit={Math.max(1, posts.length)}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <meshStandardMaterial
          color={ROAD_COLORS.distancePost}
          roughness={0.5}
        />
        {Arr.map(posts, (x) => (
          <Instance key={x} position={[x, 0.5, z]} />
        ))}
      </Instances>
      {Arr.map(
        Arr.filter(
          posts,
          (_, index) => Math.floor(roomy / 2 ** index) % 2 === 1
        ),
        (x) => (
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
        )
      )}
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
