import { useFrame } from "@react-three/fiber";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import type { Vesicle } from "@repo/design-system/components/contents/biology/synapse/anatomy";
import {
  BILAYER,
  boutonFace,
  boutonProfile,
  CHANNELS,
  CLEFT,
  CLUSTER,
  PROJECTIONS,
  TRANSPORTERS,
} from "@repo/design-system/components/contents/biology/synapse/anatomy";
import { useSynapse } from "@repo/design-system/components/contents/biology/synapse/context";
import {
  Membrane,
  useMembrane,
  useMembraneMaterial,
} from "@repo/design-system/components/contents/biology/synapse/membrane";
import { Mitochondrion } from "@repo/design-system/components/contents/biology/synapse/mitochondrion";
import {
  CYCLE,
  phaseOf,
} from "@repo/design-system/components/contents/biology/synapse/transmission";
import { SYNAPSE_COLORS } from "@repo/design-system/lib/material/synapse";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";
import {
  CapsuleGeometry,
  DoubleSide,
  LatheGeometry,
  SphereGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** The bouton keeps its noise off its face on the cleft, so the cleft stays even. */
function calmFace(point: Vector3) {
  return Math.min(1, Math.max(0, (point.y - CLEFT - 1.2) / 3));
}

/** Seconds on the screen over which the impulse sweeps down the bouton and fades. */
const IMPULSE = { fade: 1.4, peak: 0.45 };

/**
 * The presynaptic bouton, cut open: its membrane as a lipid bilayer, lit from
 * within as each impulse arrives, with the mitochondrion, the vesicles, the
 * dense projections, the Ca2+ channels of the active zone and the choline
 * transporters beside it.
 */
export function Terminal() {
  const { clock } = useSynapse();
  const outline = useMemo(() => boutonProfile(48), []);
  const membrane = useMembrane({
    calm: calmFace,
    head: SYNAPSE_COLORS.headGroup,
    outline,
    seed: 3,
    sweep: "lathe",
    tail: SYNAPSE_COLORS.tail,
    thickness: BILAYER,
    wave: 1.1,
  });
  const outer = useMembraneMaterial(
    SYNAPSE_COLORS.terminal,
    SYNAPSE_COLORS.tail
  );
  const inner = useMembraneMaterial(
    SYNAPSE_COLORS.terminalInner,
    SYNAPSE_COLORS.terminal,
    0.62
  );

  useFrame(() => {
    const { within } = phaseOf(clock.current);
    const rise = Math.min(1, within / IMPULSE.peak);
    const fall = Math.max(0, 1 - (within - IMPULSE.peak) / IMPULSE.fade);
    outer.emissiveIntensity = 0.35 * Math.min(rise, fall);
    inner.emissiveIntensity = 0.2 * Math.min(rise, fall);
  });

  return (
    <group>
      <Membrane geometry={membrane} inner={inner} outer={outer} />
      <Mitochondrion />
      <VesicleCluster />
      <Projections />
      <Channels />
      <Transporters />
    </group>
  );
}

/**
 * The vesicles of the active zone: a cluster of resting ones and the docked
 * ones on the membrane, every surface crowded with proteins as cryo-electron
 * models show it. The two docked in the middle fuse with each impulse and
 * re-form while the interval passes.
 */
function VesicleCluster() {
  const skin = useBumpySphere(1, 21, 0.035);
  const material = useMembraneMaterial(
    SYNAPSE_COLORS.vesicle,
    SYNAPSE_COLORS.vesicleSheen,
    0.3
  );
  const resting = Arr.filter(
    CLUSTER,
    (vesicle, index) => !(vesicle.docked && (index === 1 || index === 2))
  );
  const fusing = Arr.filter(
    CLUSTER,
    (vesicle, index) => vesicle.docked && (index === 1 || index === 2)
  );
  return (
    <group>
      <Instances
        placements={Arr.map(resting, (vesicle) => ({
          position: vesicle.centre,
          scale: [vesicle.radius, vesicle.radius, vesicle.radius] as const,
        }))}
      >
        <primitive attach="geometry" object={skin} />
        <primitive attach="material" object={material} />
      </Instances>
      {Arr.map(fusing, (vesicle) => (
        <FusingVesicle
          key={vesicle.centre[0]}
          material={material}
          vesicle={vesicle}
        />
      ))}
    </group>
  );
}

/** When a docked vesicle collapses into the membrane, and when a new one has re-formed, in seconds on the screen. */
const FUSION = { end: 1.75, reform: 3.7, start: 1.25 };

/**
 * A docked vesicle that fuses: it collapses into the membrane as its
 * acetylcholine leaves through the opening, and re-forms while the rest of
 * the interval passes. Botulinum toxin keeps it docked and whole.
 */
function FusingVesicle({
  material,
  vesicle,
}: {
  readonly material: MeshPhysicalMaterial;
  readonly vesicle: Vesicle;
}) {
  const { clock, treatment } = useSynapse();
  const skin = useBumpySphere(1, 29, 0.035);
  const body = useRef<Mesh>(null);
  const floor = vesicle.centre[1] - vesicle.radius;

  useFrame(() => {
    const mesh = body.current;
    if (mesh === null) {
      return;
    }
    const { within } = phaseOf(clock.current);
    const collapse =
      treatment === "botulinum"
        ? 0
        : Math.min(
            1,
            Math.max(0, (within - FUSION.start) / (FUSION.end - FUSION.start))
          ) -
          Math.min(
            1,
            Math.max(0, (within - FUSION.reform) / (CYCLE - FUSION.reform))
          );
    const height = vesicle.radius * Math.max(0.02, 1 - collapse);
    const width = vesicle.radius * (1 - 0.3 * collapse);
    mesh.scale.set(width, height, width);
    mesh.position.set(vesicle.centre[0], floor + height, vesicle.centre[2]);
    mesh.visible = collapse < 0.97;
  });

  return <mesh castShadow geometry={skin} material={material} ref={body} />;
}

/** The dense projections: tapering densities on the active zone's inner face, between the docked vesicles. */
function Projections() {
  const shape = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(Arr.range(0, 12), (step) => {
          const share = step / 12;
          return new Vector2(0.75 * (1 - share) ** 1.4 + 0.08, 1.5 * share);
        }),
        20
      ),
    []
  );
  useEffect(() => () => shape.dispose(), [shape]);
  return (
    <Instances placements={Arr.map(PROJECTIONS, (position) => ({ position }))}>
      <primitive attach="geometry" object={shape} />
      <meshStandardMaterial
        color={SYNAPSE_COLORS.densityProjection}
        roughness={0.7}
      />
    </Instances>
  );
}

/**
 * A voltage-gated Ca2+ channel: four homologous domains round a central pore
 * through the bilayer, with its α2δ subunit in the cleft and its β subunit
 * inside, about 10 nm across (Wu et al., Nature 537:191, 2016).
 */
function useChannelShape() {
  const shape = useMemo(() => {
    const domains = Arr.map(Arr.range(0, 3), (index) => {
      const angle = (index * Math.PI) / 2 + Math.PI / 4;
      return new CapsuleGeometry(0.22, 0.5, 4, 10).translate(
        0.27 * Math.cos(angle),
        BILAYER / 2,
        0.27 * Math.sin(angle)
      );
    });
    const outside = new SphereGeometry(1, 16, 10)
      .scale(0.5, 0.26, 0.46)
      .translate(0.1, -0.32, 0);
    const inside = new SphereGeometry(1, 14, 10)
      .scale(0.32, 0.2, 0.3)
      .translate(-0.08, BILAYER + 0.38, 0.05);
    const merged = mergeGeometries([...domains, outside, inside]);
    Arr.forEach([...domains, outside, inside], (part) => part.dispose());
    return merged;
  }, []);
  useEffect(() => () => shape.dispose(), [shape]);
  return shape;
}

/** The voltage-gated Ca2+ channels of the active zone, glowing while the impulse holds them open. */
function Channels() {
  const { clock } = useSynapse();
  const shape = useChannelShape();
  const material = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (material.current === null) {
      return;
    }
    const { within } = phaseOf(clock.current);
    const open = within > 0.4 && within < 2.2 ? 1 : 0;
    material.current.emissiveIntensity = 0.55 * open;
  });
  return (
    <Instances placements={Arr.map(CHANNELS, (position) => ({ position }))}>
      <primitive attach="geometry" object={shape} />
      <meshStandardMaterial
        color={SYNAPSE_COLORS.calciumChannel}
        emissive={SYNAPSE_COLORS.calcium}
        emissiveIntensity={0}
        ref={material}
        roughness={0.45}
      />
    </Instances>
  );
}

/** The bouton face's normal at distance `reach` along x, as the axis a membrane protein stands on. */
function faceNormal(x: number, z: number) {
  const reach = Math.hypot(x, z);
  const slope = (boutonFace(reach + 0.01) - boutonFace(reach - 0.01)) / 0.02;
  const length = Math.hypot(slope, 1);
  return [
    (-slope * x) / reach / length,
    1 / length,
    (-slope * z) / reach / length,
  ] as const;
}

/** The choline transporters: compact bundles of helices in the bouton's membrane beside the active zone. */
function Transporters() {
  const shape = useMemo(() => {
    const helices = Arr.map(Arr.range(0, 5), (index) => {
      const angle = (index * 2 * Math.PI) / 6;
      return new CapsuleGeometry(0.15, 0.55, 3, 8).translate(
        0.2 * Math.cos(angle),
        BILAYER / 2,
        0.2 * Math.sin(angle)
      );
    });
    const merged = mergeGeometries(helices);
    Arr.forEach(helices, (part) => part.dispose());
    return merged;
  }, []);
  useEffect(() => () => shape.dispose(), [shape]);
  return (
    <Instances
      placements={Arr.map(TRANSPORTERS, (position) => ({
        position,
        up: faceNormal(position[0], position[2]),
      }))}
    >
      <primitive attach="geometry" object={shape} />
      <meshStandardMaterial
        color={SYNAPSE_COLORS.transporter}
        roughness={0.45}
        side={DoubleSide}
      />
    </Instances>
  );
}
