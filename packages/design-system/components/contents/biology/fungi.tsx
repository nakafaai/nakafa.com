import { BiologyCallouts } from "@repo/design-system/components/contents/biology/callouts";
import {
  Instances,
  type Placement,
} from "@repo/design-system/components/contents/biology/instances";
import {
  BiologyLabFrame,
  type BiologyLabProps,
  type BiologySceneProps,
} from "@repo/design-system/components/contents/biology/lab";
import { FloatingGroup } from "@repo/design-system/components/contents/biology/motion";
import {
  BEANS,
  type Branch,
  myceliumOf,
  rhizoidsOf,
  surfaceAt,
  TRAY,
} from "@repo/design-system/components/contents/biology/mould/mycelium";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import { spikeAnchor } from "@repo/design-system/components/contents/biology/virus/binding";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const FUNGI_VIEW = {
  cameraPosition: [2.25, 1.7, 3.05],
  cameraTarget: [0.02, 0.18, 0.02],
  narrowCameraPosition: [2.78, 2.1, 3.85],
} satisfies NarrowCameraPose;

/**
 * The sporangiophores rising from the mycelium: where each stands, how tall
 * it grows, how it leans, and whether its sporangium has ripened black.
 */
const STALKS = Arr.map(
  [
    { height: 0.96, lean: 0.06, ripe: true, x: 0.16, z: 0.12 },
    { height: 0.74, lean: -0.08, ripe: true, x: -0.2, z: -0.04 },
    { height: 0.8, lean: 0.1, ripe: true, x: 0.62, z: -0.34 },
    { height: 0.56, lean: -0.04, ripe: false, x: 0.02, z: 0.34 },
  ] as const,
  (stalk, index) => {
    const foot = [stalk.x, surfaceAt(stalk.x, stalk.z), stalk.z] as const;
    const top = [
      stalk.x + stalk.lean,
      foot[1] + stalk.height,
      stalk.z + stalk.lean * 0.5,
    ] as const;
    return { foot, index, ripe: stalk.ripe, top };
  }
);

/** The main sporangium, which the spore label points at. */
const MAIN = STALKS[0]?.top ?? [0, 1, 0];

/** The sporangium's radius: about 100 µm across on a stalk about 1 mm tall. */
const SPORANGIUM = 0.075;

const CALLOUT_TARGETS = [
  {
    fontSize: "marker",
    id: "hypha",
    labelPosition: [-1.18, 0.48, 0.56],
    target: [-0.76, surfaceAt(-0.76, 0.04) + 0.012, 0.04],
  },
  {
    fontSize: "marker",
    id: "spore",
    labelPosition: [0.62, 1.1, 0.52],
    target: [MAIN[0], MAIN[1] + SPORANGIUM, MAIN[2]],
  },
  {
    fontSize: "marker",
    id: "enzyme",
    labelPosition: [-0.78, 0.22, -0.6],
    target: [-0.36, surfaceAt(-0.36, -0.18) + 0.01, -0.18],
  },
] as const;

/**
 * Shows Rhizopus growing on split soybeans as tempeh is made: a white,
 * coenocytic mycelium spreading over the beans and bridging the gaps, a film
 * of digestive enzyme where its hyphae press on a bean, and sporangiophores
 * standing up on rhizoid tufts, each crowned with a sporangium full of spores.
 */
export function FungiMyceliumLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame scene={FungiMyceliumScene} view={FUNGI_VIEW} {...props} />
  );
}

function FungiMyceliumScene({ item }: BiologySceneProps) {
  return (
    <group rotation={[-0.1, -0.34, 0.04]} scale={1.25}>
      <Beans />
      <Mycelium />
      <Enzymes />
      <Sporangiophores />
      <BiologyCallouts callouts={item.callouts} targets={CALLOUT_TARGETS} />
    </group>
  );
}

/** Split cooked soybeans on a banana leaf, as tempeh is wrapped: each cotyledon a low, waxy dome, its surface never quite smooth. */
function Beans() {
  const dome = useBumpySphere(1, 3, 0.04);
  return (
    <group>
      <mesh
        position={[0, TRAY, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1.5, 1.05, 1]}
      >
        <circleGeometry args={[1, 72]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          clearcoatRoughness={0.3}
          color={BIOLOGY_COLORS.bananaLeaf}
          roughness={0.5}
        />
      </mesh>
      {Arr.map(BEANS, (bean) => (
        <mesh
          castShadow
          geometry={dome}
          key={`${bean.x},${bean.z}`}
          position={[bean.x, TRAY, bean.z]}
          receiveShadow
          rotation={[0, -bean.turn, 0]}
          scale={[bean.length, bean.height, bean.width]}
        >
          <meshPhysicalMaterial
            clearcoat={0.25}
            clearcoatRoughness={0.6}
            color={ECOLOGY_COLORS.soybean}
            roughness={0.62}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Tubes along centre lines, merged into one geometry so the whole web costs a single draw call. */
function useTubes(paths: readonly Branch[]) {
  const geometry = useMemo(
    () =>
      mergeGeometries(
        Arr.map(
          paths,
          ({ points, radius }) =>
            new TubeGeometry(
              new CatmullRomCurve3(
                Arr.map(points, (point) => new Vector3(...point))
              ),
              points.length * 4,
              radius,
              5,
              false
            )
        )
      ),
    [paths]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The mycelium: some 300 branching hyphae from fourteen germinated spores. */
function Mycelium() {
  const paths = useMemo(() => myceliumOf(14, 3, 5), []);
  const web = useTubes(paths);
  return (
    <mesh castShadow geometry={web} receiveShadow>
      <meshPhysicalMaterial
        clearcoat={0.4}
        clearcoatRoughness={0.4}
        color={BIOLOGY_COLORS.hypha}
        roughness={0.45}
      />
    </mesh>
  );
}

/**
 * The enzymes the hyphae pour onto a bean: a glistening film of tiny
 * droplets where the bean is being digested outside the fungus.
 */
function Enzymes() {
  const drops = useMemo(
    () =>
      Arr.map(Arr.range(0, 59), (index) => {
        const x = -0.36 + (hashUnit(index, 3) - 0.5) * 0.3;
        const z = -0.18 + (hashUnit(index, 4) - 0.5) * 0.24;
        const size = 0.01 + hashUnit(index, 5) * 0.014;
        return {
          position: [x, surfaceAt(x, z) + size * 0.4, z] as const,
          scale: [size, size * 0.6, size] as const,
        };
      }),
    []
  );
  return (
    <Instances placements={drops}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.05}
        color={BIOLOGY_COLORS.enzyme}
        opacity={0.75}
        roughness={0.1}
        transparent
      />
    </Instances>
  );
}

/** Spores packed on a sporangium's surface, as grains on its wall. */
const GRAINS = Arr.map(Arr.range(0, 89), (index) => spikeAnchor(index, 90));

/**
 * The sporangiophores: unbranched stalks standing on tufts of rhizoids, each
 * crowned with a round sporangium, black and grainy with spores once ripe,
 * and a few spores drifting from the tallest.
 */
function Sporangiophores() {
  const paths = useMemo(
    () => [
      ...Arr.map(STALKS, ({ foot, top }) => ({
        points: [
          foot,
          [
            (foot[0] * 2 + top[0]) / 3,
            foot[1] + (top[1] - foot[1]) * 0.35,
            (foot[2] * 2 + top[2]) / 3,
          ] as const,
          top,
        ],
        radius: 0.012,
      })),
      ...Arr.flatMap(STALKS, ({ foot, index }) =>
        Arr.map(rhizoidsOf(foot, 6, index), (points) => ({
          points,
          radius: 0.006,
        }))
      ),
    ],
    []
  );
  const stalks = useTubes(paths);
  const sporangium = useBumpySphere(SPORANGIUM, 7, 0.06);
  const grains = useMemo(() => {
    const ripe = Arr.filter(STALKS, (stalk) => stalk.ripe);
    return Arr.flatten(
      Arr.map(ripe, ({ top }) =>
        Arr.map(
          GRAINS,
          (direction): Placement => ({
            position: [
              top[0] + direction[0] * SPORANGIUM,
              top[1] + direction[1] * SPORANGIUM,
              top[2] + direction[2] * SPORANGIUM,
            ],
          })
        )
      )
    );
  }, []);
  return (
    <group>
      <mesh castShadow geometry={stalks}>
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={BIOLOGY_COLORS.hypha}
          roughness={0.45}
        />
      </mesh>
      {Arr.map(STALKS, ({ index, ripe, top }) => (
        <mesh castShadow geometry={sporangium} key={index} position={top}>
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={
              ripe ? BIOLOGY_COLORS.sporangium : BIOLOGY_COLORS.sporangiumYoung
            }
            roughness={0.7}
          />
        </mesh>
      ))}
      <Instances placements={grains}>
        <icosahedronGeometry args={[0.009, 0]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.sporangium}
          roughness={0.8}
        />
      </Instances>
      {Arr.map(Arr.range(0, 4), (index) => (
        <FloatingGroup key={index} phase={index * 0.44} travel={0.035}>
          <mesh
            position={[
              MAIN[0] + 0.12 + index * 0.05,
              MAIN[1] - 0.04 + hashUnit(index, 9) * 0.12,
              MAIN[2] + (hashUnit(index, 8) - 0.5) * 0.2,
            ]}
            scale={[1, 0.8, 1]}
          >
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.sporangium}
              roughness={0.8}
            />
          </mesh>
        </FloatingGroup>
      ))}
    </group>
  );
}
