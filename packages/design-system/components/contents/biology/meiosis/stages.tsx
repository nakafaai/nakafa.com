import {
  Lump,
  useLump,
} from "@repo/design-system/components/contents/biology/cell/organic";
import { ChromatidArm } from "@repo/design-system/components/contents/biology/chromatin";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Euler,
  Matrix4,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";

/** The banding colours of the chromosome from each parent. */
const MATERNAL = {
  accentColor: GENETICS_COLORS.maternalRose,
  bandColor: GENETICS_COLORS.maternalDark,
  baseColor: GENETICS_COLORS.maternalLight,
} as const;
const PATERNAL = {
  accentColor: GENETICS_COLORS.paternalBlue,
  bandColor: GENETICS_COLORS.paternalDark,
  baseColor: GENETICS_COLORS.paternalLight,
} as const;

/**
 * A wet, translucent membrane around what it holds: a nuclear envelope or
 * an egg's coat, never a perfect ball.
 */
function Membrane({
  color,
  opacity,
  position = [0, 0, 0],
  radius,
  seed,
  stretch = [1, 1, 1],
}: {
  readonly color: string;
  readonly opacity: number;
  readonly position?: readonly [number, number, number];
  readonly radius: number;
  readonly seed: number;
  readonly stretch?: readonly [number, number, number];
}) {
  const geometry = useLump(seed, 0.05, stretch);
  return (
    <mesh geometry={geometry} position={position} scale={radius}>
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.2}
        color={color}
        depthWrite={false}
        opacity={opacity}
        roughness={0.2}
        transparent
      />
    </mesh>
  );
}

/**
 * One homologue of a bivalent: two sister chromatids held at their
 * centromere, the inner one reaching across to its partner. `side` is -1 for
 * the homologue on the left and 1 for the one on the right.
 */
function Homologue({
  palette,
  seed,
  side,
}: {
  readonly palette: typeof MATERNAL | typeof PATERNAL;
  readonly seed: number;
  readonly side: -1 | 1;
}) {
  return (
    <group position={[0.24 * side, 0.06, 0]}>
      <ChromatidArm
        {...palette}
        length={0.34}
        position={[0.04 * side, 0.02, 0]}
        radius={0.062}
        rotation={[0, 0, -0.22 * side]}
        seed={seed}
      />
      <ChromatidArm
        {...palette}
        length={0.44}
        position={[0.04 * side, -0.02, 0]}
        radius={0.062}
        rotation={[0, 0, Math.PI + 0.16 * side]}
        seed={seed + 4}
      />
      <ChromatidArm
        {...palette}
        length={0.34}
        position={[-0.04 * side, 0.02, 0]}
        radius={0.062}
        rotation={[0, 0, 0.1 * side]}
        seed={seed + 6}
      />
      <ChromatidArm
        {...palette}
        length={0.34}
        position={[-0.04 * side, -0.02, -0.02 * side]}
        radius={0.062}
        rotation={[0, 0, Math.PI - 0.52 * side]}
        seed={seed + 8}
      />
      <Lump
        coat={0.05}
        color={palette.bandColor}
        depth={0.16}
        radius={0.07}
        seed={seed + 1}
        stretch={[1.3, 0.6, 0.95]}
      />
    </group>
  );
}

/**
 * A bivalent in prophase I inside its nucleus: the two homologues side by
 * side, an inner chromatid of each crossed over the other's at the chiasma,
 * below which each carries the other's tip.
 */
export function CrossingOverView() {
  return (
    <group position={[0, 0.66, 0]}>
      <Membrane
        color={BIOLOGY_COLORS.zonaPellucida}
        opacity={0.16}
        position={[0, -0.02, -0.06]}
        radius={0.7}
        seed={21}
        stretch={[1, 0.86, 0.6]}
      />
      <Homologue palette={MATERNAL} seed={3} side={-1} />
      <Homologue palette={PATERNAL} seed={13} side={1} />

      <ChromatidArm
        {...PATERNAL}
        length={0.18}
        position={[-0.02, -0.24, -0.02]}
        radius={0.056}
        rotation={[0, 0, Math.PI - 0.32]}
        seed={23}
      />
      <ChromatidArm
        {...MATERNAL}
        length={0.18}
        position={[0.02, -0.24, 0.02]}
        radius={0.056}
        rotation={[0, 0, Math.PI + 0.32]}
        seed={29}
      />

      {/* A soft light on the chiasma, where the two chromatids cross */}
      <mesh position={[0, -0.2, 0.02]}>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={GENETICS_COLORS.chiasmaGlow}
          depthWrite={false}
          opacity={0.13}
          transparent
        />
      </mesh>
    </group>
  );
}

/** How many follicle cells cling to the egg, and the golden angle that spreads them evenly over it. */
const FOLLICLE_CELLS = 280;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** The cells facing the viewer beyond this share of the way to the front are left off, so the egg shows through the opening. */
const WINDOW = 0.45;

/**
 * The corona radiata: the follicle cells that still cling to an ovulated
 * egg, packed two deep over its coat and opened toward the viewer, as one
 * instanced mesh of a shared lumpy cell.
 */
function Corona() {
  const mesh = useRef<InstancedMesh>(null);
  const cell = useLump(17, 0.2, [1, 1, 1], 0.3);

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
    for (let index = 0; index < FOLLICLE_CELLS; index += 1) {
      const height = 1 - ((index + 0.5) / FOLLICLE_CELLS) * 2;
      const flat = Math.sqrt(1 - height * height);
      const reach = 0.305 + (index % 3) * 0.022;
      turn.setFromEuler(angles.set(index, index * 1.7, index * 2.3));
      matrix.compose(
        place.set(
          Math.cos(index * GOLDEN) * flat * reach,
          height * reach,
          Math.sin(index * GOLDEN) * flat * reach
        ),
        turn,
        size.setScalar(
          Math.sin(index * GOLDEN) * flat > WINDOW
            ? 0
            : 0.036 + (index % 4) * 0.004
        )
      );
      target.setMatrixAt(index, matrix);
    }
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, []);

  return (
    <instancedMesh
      args={[cell, undefined, FOLLICLE_CELLS]}
      castShadow
      receiveShadow
      ref={mesh}
    >
      <SurfaceMaterial
        bump={0.5}
        coat={0.3}
        color={BIOLOGY_COLORS.coronaCell}
        roughness={0.55}
        surface="tissue"
      />
    </instancedMesh>
  );
}

/**
 * An egg and a sperm about to meet: the oocyte in its zona pellucida under
 * the corona radiata, its nucleus carrying the mother's chromosomes, and a
 * spermatozoon a fraction of its size with its acrosome, its nucleus
 * carrying the father's, its midpiece of mitochondria and its tail.
 */
export function FertilisationView() {
  const tail = useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(0.2, 0, 0),
      new Vector3(0.32, 0.035, 0.03),
      new Vector3(0.46, -0.035, -0.02),
      new Vector3(0.6, 0.03, 0.02),
      new Vector3(0.74, -0.025, 0),
      new Vector3(0.86, 0.01, 0.01),
    ]);
    return new TubeGeometry(curve, 64, 0.006, 8, false);
  }, []);
  useEffect(() => () => tail.dispose(), [tail]);

  return (
    <group position={[0, 0.7, 0]}>
      <group position={[-0.3, 0, 0]}>
        <Lump
          coat={0.2}
          color={GENETICS_COLORS.maternalRose}
          depth={0.12}
          position={[0.06, 0.04, 0.08]}
          radius={0.07}
          seed={9}
        />
        <Membrane
          color={BIOLOGY_COLORS.oocyteYolk}
          opacity={0.78}
          radius={0.24}
          seed={5}
        />
        <Membrane
          color={BIOLOGY_COLORS.zonaPellucida}
          opacity={0.3}
          radius={0.285}
          seed={31}
        />
        <Corona />
      </group>

      <group position={[0.16, 0, 0.12]} scale={0.8}>
        <Lump
          coat={0.4}
          color={GENETICS_COLORS.paternalLight}
          depth={0.06}
          radius={0.062}
          seed={41}
          stretch={[1.35, 0.8, 0.5]}
        />
        <mesh
          castShadow
          position={[-0.028, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.84, 1.3, 0.54]}
        >
          <sphereGeometry
            args={[0.066, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.46]}
          />
          <SurfaceMaterial
            bump={0.4}
            coat={0.5}
            color={BIOLOGY_COLORS.zonaPellucida}
            roughness={0.45}
            surface="tissue"
          />
        </mesh>
        <Lump
          coat={0.2}
          color={BIOLOGY_COLORS.coronaCell}
          depth={0.22}
          position={[0.14, 0, 0]}
          radius={0.024}
          seed={43}
          stretch={[3, 1, 1]}
        />
        <mesh castShadow geometry={tail}>
          <SurfaceMaterial
            coat={0.3}
            color={BIOLOGY_COLORS.flagellumIvory}
            repeat={[1, 12]}
            roughness={0.5}
            surface="tissue"
          />
        </mesh>
      </group>
    </group>
  );
}

/** The nine triplets of microtubules of a centriole, around its axis. */
const TRIPLETS = Arr.makeBy(27, (index) => {
  const angle = (Math.floor(index / 3) / 9) * Math.PI * 2;
  const reach = 0.036 + (index % 3) * 0.0085;
  const lean = angle + (index % 3) * 0.2;
  return {
    id: `tubule-${index}`,
    x: Math.cos(lean) * reach,
    z: Math.sin(lean) * reach,
  };
});

/** One centriole: nine triplets of microtubules set like the blades of a turbine. */
function Centriole({
  length,
  position = [0, 0, 0],
  rotation,
}: {
  readonly length: number;
  readonly position?: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      {Arr.map(TRIPLETS, (tubule) => (
        <mesh castShadow key={tubule.id} position={[tubule.x, 0, tubule.z]}>
          <cylinderGeometry args={[0.0045, 0.0045, length, 10]} />
          <SurfaceMaterial
            coat={0.2}
            color={GENETICS_COLORS.centrioleBrass}
            repeat={[1, 4]}
            roughness={0.55}
            surface="tissue"
          />
        </mesh>
      ))}
    </group>
  );
}

/** A centrosome at one pole: a pair of centrioles at right angles in their cloud of pericentriolar material. */
function CentriolePole({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      <Centriole length={0.14} rotation={[0, 0, Math.PI / 2]} />
      <Centriole
        length={0.11}
        position={[0, 0.04, 0.06]}
        rotation={[Math.PI / 2, 0.3, 0]}
      />
      <Membrane
        color={GENETICS_COLORS.spindleFiber}
        opacity={0.16}
        radius={0.11}
        seed={51}
      />
    </group>
  );
}

/** How the spindle's microtubules bow out between the poles: up, and toward or away from the viewer. */
const FIBRES = Arr.makeBy(22, (index) => {
  const around = (index / 22) * Math.PI * 2;
  const reach = index % 2 === 0 ? 0.44 : 0.26;
  return {
    id: `fibre-${index}`,
    y: Math.sin(around) * reach,
    z: Math.cos(around) * reach * 0.62,
  };
});

/**
 * The spindle: microtubules bowing from one centrosome to the other past the
 * chromosomes on the metaphase plate, a centrosome with its pair of
 * centrioles at each pole.
 */
export function SpindleApparatus({
  position = [0, 0.62, 0],
  span = 1.65,
}: {
  readonly position?: readonly [number, number, number];
  readonly span?: number;
}) {
  const half = span / 2;
  const fibres = useMemo(
    () =>
      Arr.map(FIBRES, (fibre) => ({
        geometry: new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(-half, 0, 0),
            new Vector3(-half * 0.5, fibre.y * 0.8, fibre.z * 0.8),
            new Vector3(0, fibre.y, fibre.z),
            new Vector3(half * 0.5, fibre.y * 0.8, fibre.z * 0.8),
            new Vector3(half, 0, 0),
          ]),
          40,
          0.0032,
          6,
          false
        ),
        id: fibre.id,
      })),
    [half]
  );
  useEffect(
    () => () => Arr.forEach(fibres, (fibre) => fibre.geometry.dispose()),
    [fibres]
  );

  return (
    <group position={position}>
      <CentriolePole position={[-half, 0, 0]} />
      <CentriolePole position={[half, 0, 0]} />
      {Arr.map(fibres, (fibre) => (
        <mesh geometry={fibre.geometry} key={fibre.id}>
          <meshPhysicalMaterial
            color={GENETICS_COLORS.spindleFiber}
            opacity={0.7}
            roughness={0.5}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
