import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  NuclearProcess,
  NuclideId,
} from "@repo/design-system/components/contents/physics/binding/model";
import { nuclideSpec } from "@repo/design-system/components/contents/physics/binding/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr, Order } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { MeshPhysicalMaterial, SphereGeometry } from "three";

/** The most balls the model shows; a heavier nucleus is drawn at this size. */
const CAP = 72;

/** The height of the model's centre above the table. */
const CENTRE = 0.64;

/** How far the lattice reaches from its centre, in lattice steps. */
const REACH = 6;

/** The golden ratio, whose multiples scatter evenly over a unit interval. */
const GOLDEN = (1 + Math.sqrt(5)) / 2;

/** The share of a close packing that the balls themselves fill. */
const PACKING = 0.74;

/** The radius of one ball, smaller for the models that hold more of them. */
function ballRadius(count: number) {
  if (count > 40) {
    return 0.066;
  }
  return count > 4 ? 0.085 : 0.105;
}

/** The radius of the ball cluster that `count` close-packed balls make. */
function clusterRadius(count: number, radius: number) {
  return radius * Math.cbrt(count / PACKING);
}

/**
 * Packs `count` touching balls the way a classroom nucleus model is glued:
 * the sites of a face-centred cubic lattice, taken outward from one of its
 * tetrahedral holes, so two balls touch, four make a tetrahedron, and more
 * fill a ball. A splitting nucleus takes its sites around two centres
 * instead, which necks the cluster into two lobes. Protons are spread evenly
 * through the order the sites are taken in.
 */
function packNucleons(count: number, protons: number, splitting: boolean) {
  const radius = ballRadius(count);
  const step = radius * Math.SQRT2;
  const split = splitting ? clusterRadius(count / 2, radius) * 0.82 : 0;
  const steps = Arr.range(-REACH, REACH);
  const sites = Arr.flatMap(steps, (i) =>
    Arr.flatMap(steps, (j) =>
      Arr.map(
        Arr.filter(steps, (k) => (i + j + k) % 2 === 0),
        (k) => {
          const x = (i - 0.5) * step;
          const y = (j - 0.5) * step;
          const z = (k - 0.5) * step;
          const rank = Math.min(
            Math.hypot(x - split, y, z),
            Math.hypot(x + split, y, z)
          );
          // The index breaks ties, so equal distances keep one fixed order.
          return { rank: rank + (i * 169 + j * 13 + k) * 1e-7, x, y, z };
        }
      )
    )
  );
  const taken = Arr.take(
    Arr.sort(
      sites,
      Order.mapInput(Order.Number, (site: (typeof sites)[number]) => site.rank)
    ),
    count
  );
  const middle = Arr.reduce(taken, { x: 0, y: 0, z: 0 }, (sum, site) => ({
    x: sum.x + site.x / count,
    y: sum.y + site.y / count,
    z: sum.z + site.z / count,
  }));
  // The balls that are protons, scattered through the cluster by the golden
  // ratio so the two colours mix instead of settling into layers.
  const scattered = Arr.sort(
    Arr.range(0, count - 1),
    Order.mapInput(Order.Number, (index: number) => (index * GOLDEN) % 1)
  );
  const painted = Arr.take(scattered, protons);
  return Arr.map(taken, (site, index) => ({
    id: `n-${index}`,
    proton: Arr.contains(painted, index),
    x: site.x - middle.x,
    y: site.y - middle.y,
    z: site.z - middle.z,
  }));
}

/** A lacquered ball: paint under a hard clear coat, as a model's balls are. */
function lacquer(color: string) {
  return new MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    color,
    metalness: 0,
    roughness: 0.42,
  });
}

function createProtonPaint() {
  return lacquer(QUANTUM_COLORS.proton);
}

function createNeutronPaint() {
  return lacquer(QUANTUM_COLORS.neutron);
}

function createBall() {
  return new SphereGeometry(1, 32, 24);
}

/** A legend entry: a dot in the ball's colour beside the particle's name. */
function Legend({
  color,
  name,
}: {
  readonly color: string;
  readonly name: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}

/**
 * The display stand: a turned base, a collar and a polished stem that runs up
 * into the middle of the model.
 */
function Stand() {
  return (
    <group>
      <mesh castShadow position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.3, 0.33, 0.04, 64]} />
        <SurfaceMaterial
          color={QUANTUM_COLORS.benchEpoxy}
          repeat={[3, 1]}
          roughness={0.5}
          surface="plastic"
        />
      </mesh>
      <mesh castShadow position={[0, 0.055, 0]}>
        <cylinderGeometry args={[0.03, 0.06, 0.03, 32]} />
        <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0, CENTRE / 2 + 0.02, 0]}>
        <cylinderGeometry args={[0.011, 0.011, CENTRE - 0.04, 16]} />
        <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.15} />
      </mesh>
    </group>
  );
}

/**
 * The free neutron that starts a fission, as a model shows it: one more grey
 * ball on a stem of its own, level with the nucleus it is about to strike.
 */
function FreeNeutron({
  radius,
  reach,
}: {
  readonly radius: number;
  readonly reach: number;
}) {
  const paint = useMemo(createNeutronPaint, []);
  useEffect(() => () => paint.dispose(), [paint]);

  return (
    <group position={[-reach, 0, 0]}>
      <mesh castShadow position={[0, 0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.024, 32]} />
        <SurfaceMaterial
          color={QUANTUM_COLORS.benchEpoxy}
          roughness={0.5}
          surface="plastic"
        />
      </mesh>
      <mesh castShadow position={[0, CENTRE / 2, 0]}>
        <cylinderGeometry args={[0.007, 0.007, CENTRE, 12]} />
        <MetalMaterial color={QUANTUM_COLORS.aluminium} roughness={0.15} />
      </mesh>
      <mesh
        castShadow
        material={paint}
        position={[0, CENTRE, 0]}
        scale={radius}
      >
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
    </group>
  );
}

function BindingCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.42, 3.3] : [0, 1.08, 2.4]}
      cameraTarget={[0, 0.54, 0]}
      fov={36}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function NuclearBindingScene({
  nuclide,
  parts,
  process,
}: {
  readonly nuclide: NuclideId;
  readonly parts: Readonly<
    Record<
      "fissionZone" | "fusionZone" | "ironPeak" | "neutron" | "proton",
      string
    >
  >;
  readonly process: NuclearProcess;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clusterRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const spec = nuclideSpec(nuclide);
  const count = Math.min(CAP, spec.massNumber);
  const protons = Math.max(
    1,
    Math.round((spec.protons / spec.massNumber) * count)
  );
  const isIronPeak = nuclide === "iron56";
  // Only a heavy nucleus splits: a light one has no two lobes to neck into.
  const splitting = process === "fission" && !isIronPeak && count > 12;
  const radius = ballRadius(count);
  const reach = clusterRadius(count, radius) * (splitting ? 1.75 : 1);

  const nucleons = useMemo(
    () => packNucleons(count, protons, splitting),
    [count, protons, splitting]
  );
  const ball = useMemo(createBall, []);
  const protonPaint = useMemo(createProtonPaint, []);
  const neutronPaint = useMemo(createNeutronPaint, []);
  useEffect(
    () => () => {
      ball.dispose();
      protonPaint.dispose();
      neutronPaint.dispose();
    },
    [ball, neutronPaint, protonPaint]
  );

  useVisualStop(() => {
    phaseRef.current = 0;
    if (clusterRef.current !== null) {
      clusterRef.current.rotation.y = 0;
      clusterRef.current.scale.set(1, 1, 1);
    }
  });

  useFrame((_, delta) => {
    if (!playing || clusterRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.95;
    clusterRef.current.rotation.y = phaseRef.current;
    // A splitting nucleus stretches and recovers along the axis it necks on.
    const pulse = splitting ? 1 + Math.sin(phaseRef.current * 2.4) * 0.05 : 1;
    clusterRef.current.scale.set(pulse, 1, 1);
  });

  const zoneText = isIronPeak
    ? parts.ironPeak
    : parts[process === "fusion" ? "fusionZone" : "fissionZone"];
  const crown = CENTRE + clusterRadius(count, radius) + 0.12;

  return (
    <group>
      <SimulationTicker running={playing} />
      <BindingCamera />
      <Stand />
      {splitting ? <FreeNeutron radius={radius} reach={reach + 0.2} /> : null}

      <group position={[0, CENTRE, 0]} ref={clusterRef}>
        {Arr.map(nucleons, (item) => (
          <mesh
            castShadow
            geometry={ball}
            key={item.id}
            material={item.proton ? protonPaint : neutronPaint}
            position={[item.x, item.y, item.z]}
            receiveShadow
            scale={radius}
          />
        ))}
      </group>

      <ThreeLabel
        anchorX="right"
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[-0.08, crown, 0]}
      >
        <Legend color={QUANTUM_COLORS.proton} name={parts.proton} />
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0.08, crown, 0]}
      >
        <Legend color={QUANTUM_COLORS.neutron} name={parts.neutron} />
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0, crown + 0.13, 0]}
      >
        <span>{zoneText}</span>
      </ThreeLabel>
    </group>
  );
}
