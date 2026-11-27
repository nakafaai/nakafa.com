import { lumpAt } from "@repo/design-system/components/contents/biology/cell/lump";
import {
  Lump,
  useLump,
} from "@repo/design-system/components/contents/biology/cell/organic";
import {
  granaOf,
  LENS,
  lamellaeOf,
  rimOf,
  specksOf,
  thylakoidsOf,
} from "@repo/design-system/components/contents/biology/chloroplast/grana";
import { facetsOf } from "@repo/design-system/components/three/molecule/ball";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Where the lens's middle stands above the bench. */
const MIDDLE = [0, 0.56, 0] as const;

/** How far the outer membrane stands outside the inner one, as a share of the lens: the intermembrane space. */
const OUTER = 1.09;

/** How far below the lens's middle plane the stroma's cut surface lies. */
const STROMA_LEVEL = -0.2;

/**
 * Where the envelope's membrane is in the direction (x, y, z) from the
 * lens's middle, at `reach` times the inner membrane: a lens that swells and
 * dips a little, as a living plastid does.
 */
function membraneAt([x, y, z]: Point, reach: number): Point {
  const swell = lumpAt(x * 1.4, y * 1.4, z * 1.4, 11, 0.035) * reach;
  return [x * LENS[0] * swell, y * LENS[1] * swell, z * LENS[2] * swell];
}

/** A part of a unit sphere pressed into the envelope's shape. */
function pressed(sphere: SphereGeometry, reach: number) {
  const place = sphere.getAttribute("position");
  for (let index = 0; index < place.count; index += 1) {
    const [x, y, z] = membraneAt(
      [place.getX(index), place.getY(index), place.getZ(index)],
      reach
    );
    place.setXYZ(index, x, y, z);
  }
  sphere.computeVertexNormals();
  return sphere;
}

/**
 * The geometry of the cutaway envelope: each membrane as the lower half of
 * the lens and the back quarter of its top, and the cut face between the
 * two membranes, the intermembrane space, as a band along the cut's edge.
 */
function useEnvelope() {
  const { tier } = useStage();
  const built = useMemo(() => {
    const facets = facetsOf(tier);
    const around = facets.sides * 3;
    const shells = Arr.map([OUTER, 1] as const, (reach) => ({
      bowl: pressed(
        new SphereGeometry(
          1,
          around,
          facets.rings,
          0,
          Math.PI * 2,
          Math.PI / 2,
          Math.PI / 2
        ),
        reach
      ),
      roof: pressed(
        new SphereGeometry(
          1,
          around / 2,
          facets.rings,
          Math.PI,
          Math.PI,
          0,
          Math.PI / 2
        ),
        reach
      ),
    }));
    const edge = rimOf(around / 2);
    const band = new BufferGeometry();
    band.setAttribute(
      "position",
      new Float32BufferAttribute(
        Arr.flatMap(edge, (point) => [
          ...membraneAt(point, OUTER),
          ...membraneAt(point, 1),
        ]),
        3
      )
    );
    band.setIndex(
      Arr.flatMap(Arr.range(0, edge.length - 1), (index) => {
        const here = index * 2;
        const next = ((index + 1) % edge.length) * 2;
        return [here, here + 1, next, next, here + 1, next + 1];
      })
    );
    band.computeVertexNormals();
    return { band, shells };
  }, [tier]);
  useEffect(
    () => () => {
      built.band.dispose();
      Arr.forEach(built.shells, (shell) => {
        shell.bowl.dispose();
        shell.roof.dispose();
      });
    },
    [built]
  );
  return built;
}

/**
 * The chloroplast's double envelope as a cutaway: the outer and the inner
 * membrane with the intermembrane space between them, the top front quarter
 * cut off to show the stroma, whose cut surface lies wet inside.
 */
export function ChloroplastEnvelope({
  stromaActive,
}: {
  readonly stromaActive: boolean;
}) {
  const { band, shells } = useEnvelope();
  const level = Math.sqrt(1 - (STROMA_LEVEL / LENS[1]) ** 2) * 0.985;
  return (
    <group position={MIDDLE}>
      {Arr.map(shells, (shell, index) =>
        Arr.map([shell.bowl, shell.roof], (geometry, part) => (
          <mesh
            castShadow={index === 0}
            geometry={geometry}
            key={`${index === 0 ? "outer" : "inner"}-${part === 0 ? "bowl" : "roof"}`}
            receiveShadow
          >
            <SurfaceMaterial
              bump={0.55}
              coat={index === 0 ? 0.55 : 0.3}
              color={
                index === 0
                  ? FOLIAGE_COLORS.plastidEnvelope
                  : FOLIAGE_COLORS.plastidLining
              }
              repeat={[6, 3]}
              roughness={0.5}
              side={DoubleSide}
              surface="tissue"
            />
          </mesh>
        ))
      )}
      <mesh geometry={band}>
        <SurfaceMaterial
          bump={0.3}
          color={FOLIAGE_COLORS.plastidCut}
          roughness={0.6}
          side={DoubleSide}
          surface="tissue"
        />
      </mesh>
      <mesh
        position={[0, STROMA_LEVEL, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[LENS[0] * level, LENS[2] * level, 1]}
      >
        <circleGeometry args={[1, 64]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.12}
          color={FOLIAGE_COLORS.stroma}
          depthWrite={false}
          opacity={stromaActive ? 0.62 : 0.34}
          roughness={0.18}
          transparent
        />
      </mesh>
    </group>
  );
}

/** The profile of one thylakoid of radius one and half thickness one: a flattened sac with a rounded rim. */
const SAC_PROFILE = [
  [0.001, -1],
  [0.86, -1],
  [0.95, -0.72],
  [1, 0],
  [0.95, 0.72],
  [0.86, 1],
  [0.001, 1],
] as const;

/**
 * Every thylakoid as one instanced mesh of a shared sac: the stacked discs
 * of the grana and the long stroma lamellae that join them. The grana light
 * up while the light reactions run in them.
 */
export function Thylakoids({ granaActive }: { readonly granaActive: boolean }) {
  const { tier } = useStage();
  const mesh = useRef<InstancedMesh>(null);
  const sacs = useMemo(() => {
    const grana = granaOf();
    return [...thylakoidsOf(grana), ...lamellaeOf(grana)];
  }, []);
  const geometry = useMemo(() => {
    const sac = new LatheGeometry(
      Arr.map(SAC_PROFILE, ([radius, height]) => new Vector2(radius, height)),
      facetsOf(tier).sides
    );
    const place = sac.getAttribute("position");
    for (let index = 0; index < place.count; index += 1) {
      const x = place.getX(index);
      const z = place.getZ(index);
      const swell = lumpAt(x * 2.2, 0, z * 2.2, 3, 0.07);
      place.setX(index, x * swell);
      place.setZ(index, z * swell);
    }
    sac.computeVertexNormals();
    return sac;
  }, [tier]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const angles = new Euler();
    const place = new Vector3();
    const size = new Vector3();
    const color = new Color();
    Arr.forEach(sacs, (sac, index) => {
      turn.setFromEuler(angles.set(0, sac.turn, 0));
      matrix.compose(
        place.set(sac.at[0], sac.at[1], sac.at[2]),
        turn,
        size.set(sac.size[0], sac.size[1], sac.size[2])
      );
      target.setMatrixAt(index, matrix);
      target.setColorAt(
        index,
        color.setScalar(0.78 + ((index * 7) % 5) * 0.055)
      );
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
    target.computeBoundingSphere();
  }, [sacs]);

  return (
    <instancedMesh
      args={[geometry, undefined, sacs.length]}
      castShadow
      receiveShadow
      ref={mesh}
    >
      <SurfaceMaterial
        bump={0.45}
        coat={0.4}
        color={
          granaActive
            ? FOLIAGE_COLORS.thylakoidLit
            : FOLIAGE_COLORS.thylakoidSac
        }
        repeat={[2, 1]}
        roughness={0.5}
        surface="tissue"
      />
    </instancedMesh>
  );
}

/** How many ribosomes and plastoglobuli float in the stroma. */
const RIBOSOMES = 90;
const PLASTOGLOBULI = 9;

/**
 * The small bodies of the stroma as one instanced mesh: the chloroplast's
 * own 70S ribosomes and its plastoglobuli, droplets of lipid a few times
 * larger.
 */
function Specks() {
  const mesh = useRef<InstancedMesh>(null);
  const lump = useLump(5, 0.16, [1, 1, 1], 0.3);
  const specks = useMemo(
    () => [
      ...Arr.map(specksOf(RIBOSOMES, 4), (at) => ({
        at,
        color: FOLIAGE_COLORS.ribosome,
        radius: 0.011,
      })),
      ...Arr.map(specksOf(PLASTOGLOBULI, 9), (at, index) => ({
        at,
        color: FOLIAGE_COLORS.plastoglobule,
        radius: 0.026 + (index % 3) * 0.007,
      })),
    ],
    []
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const angles = new Euler();
    const place = new Vector3();
    const size = new Vector3();
    const color = new Color();
    Arr.forEach(specks, (speck, index) => {
      turn.setFromEuler(angles.set(index, index * 1.7, index * 2.3));
      matrix.compose(
        place.set(speck.at[0], speck.at[1], speck.at[2]),
        turn,
        size.setScalar(speck.radius)
      );
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, color.set(speck.color));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
    target.computeBoundingSphere();
  }, [specks]);

  return (
    <instancedMesh
      args={[lump, undefined, specks.length]}
      castShadow
      ref={mesh}
    >
      <SurfaceMaterial
        bump={0.4}
        coat={0.5}
        color={getColor("WHITE")}
        roughness={0.5}
        surface="tissue"
      />
    </instancedMesh>
  );
}

/** The chloroplast's own DNA: a closed loop, tangled into a nucleoid in the stroma. */
function Nucleoid() {
  const geometry = useMemo(() => {
    const loop = new CatmullRomCurve3(
      Arr.makeBy(22, (index) => {
        const angle = (index / 22) * Math.PI * 2;
        const reach = 0.075 + Math.sin(index * 2.4) * 0.03;
        return new Vector3(
          Math.cos(angle) * reach,
          Math.sin(index * 1.9) * 0.022,
          Math.sin(angle) * reach * 0.8
        );
      }),
      true
    );
    return new TubeGeometry(loop, 220, 0.0045, 8, true);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh castShadow geometry={geometry} position={[0.86, -0.1, 0.16]}>
      <SurfaceMaterial
        coat={0.4}
        color={FOLIAGE_COLORS.cpDna}
        roughness={0.5}
        surface="plastic"
      />
    </mesh>
  );
}

/** The starch grains of a chloroplast that has been in the light: pale lens-shaped bodies in the stroma. */
const STARCH = [
  { at: [0.9, -0.05, -0.18], radius: 0.1, seed: 3, turn: 0.3 },
  { at: [-0.98, -0.02, 0.12], radius: 0.082, seed: 8, turn: -0.4 },
  { at: [0.52, -0.22, 0.44], radius: 0.07, seed: 12, turn: 0.9 },
] as const;

/**
 * What the stroma holds beside the thylakoid system, which the scene
 * composes as `children`: starch grains, plastoglobuli, ribosomes and the
 * plastid's own DNA.
 */
export function ChloroplastInterior({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <group position={MIDDLE}>
      {children}
      <Specks />
      <Nucleoid />
      {Arr.map(STARCH, (grain) => (
        <Lump
          coat={0.15}
          color={FOLIAGE_COLORS.starchGranule}
          depth={0.1}
          key={grain.seed}
          position={grain.at}
          radius={grain.radius}
          rotation={[0, grain.turn, 0.2]}
          seed={grain.seed}
          stretch={[1.35, 0.62, 1]}
        />
      ))}
    </group>
  );
}
