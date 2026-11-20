import { useFrame } from "@react-three/fiber";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import {
  BILAYER,
  DENDRITE,
  DENSITY,
  dendriteProfile,
  dendriteTop,
  ENZYMES,
  FIELD,
  MICROTUBULE,
  MICROTUBULES,
  RECEPTOR,
} from "@repo/design-system/components/contents/biology/synapse/anatomy";
import { useSynapse } from "@repo/design-system/components/contents/biology/synapse/context";
import {
  Membrane,
  useMembrane,
  useMembraneMaterial,
} from "@repo/design-system/components/contents/biology/synapse/membrane";
import {
  CROSSING,
  potentialAt,
  REST,
  receptorsAt,
  synapseTime,
  THRESHOLD,
  transmitterAt,
} from "@repo/design-system/components/contents/biology/synapse/transmission";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SYNAPSE_COLORS } from "@repo/design-system/lib/material/synapse";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** The dendrite keeps its noise off the postsynaptic density, so the cleft stays even. */
function calmDensity(point: Vector3) {
  if (point.y < -6) {
    return 1;
  }
  return Math.min(
    1,
    Math.max(0, (Math.hypot(point.x, point.z) - DENSITY - 2) / 6)
  );
}

/** The normal of the dendrite's upper face at depth `z`, as the axis its membrane proteins stand on. */
export function topNormal(z: number) {
  const slope = (dendriteTop(z + 0.01) - dendriteTop(z - 0.01)) / 0.02;
  const length = Math.hypot(slope, 1);
  return [0, 1 / length, -slope / length] as const;
}

/**
 * The dendrite of the next neuron, cut open under the bouton: its membrane
 * as a lipid bilayer, lit from within as it depolarises, the postsynaptic
 * density under the receptor field, the microtubules along its length, the
 * receptors, and acetylcholinesterase among them.
 */
export function Dendrite() {
  const { clock, rate, treatment } = useSynapse();
  const outline = useMemo(() => dendriteProfile(72), []);
  const membrane = useMembrane({
    calm: calmDensity,
    head: SYNAPSE_COLORS.postHead,
    length: DENDRITE.length,
    outline,
    seed: 7,
    sweep: "along",
    tail: SYNAPSE_COLORS.postTail,
    thickness: BILAYER,
    turns: 160,
    wave: 1.2,
  });
  const outer = useMembraneMaterial(
    SYNAPSE_COLORS.dendrite,
    SYNAPSE_COLORS.postTail,
    0.5,
    SYNAPSE_COLORS.sodium
  );
  const inner = useMembraneMaterial(
    SYNAPSE_COLORS.dendriteInner,
    SYNAPSE_COLORS.dendrite,
    0.62,
    SYNAPSE_COLORS.sodium
  );

  useFrame(() => {
    const time = synapseTime(clock.current, rate);
    const { potential } = potentialAt(time, rate, treatment);
    const depolarised = Math.min(
      1.3,
      Math.max(0, (potential - REST) / (THRESHOLD - REST))
    );
    outer.emissiveIntensity = 0.16 * depolarised;
    inner.emissiveIntensity = 0.1 * depolarised;
  });

  return (
    <group>
      <Membrane geometry={membrane} inner={inner} outer={outer} />
      <Density />
      <Microtubules />
      <Receptors />
      <Enzymes />
    </group>
  );
}

/** Scaffold proteins of the postsynaptic density the lab draws. */
const SCAFFOLD = 150;

/**
 * The postsynaptic density: a dense meshwork of scaffold proteins, about
 * 25 nm deep, packed just under the receptor field and following the
 * dendrite's face.
 */
function Density() {
  const lump = useBumpySphere(1, 5, 0.25);
  const placements = useMemo(
    () =>
      Arr.map(Arr.range(0, SCAFFOLD - 1), (index) => {
        const reach = DENSITY * Math.sqrt(hashUnit(index, 1));
        const angle = Math.PI + Math.PI * hashUnit(index, 2);
        const x = reach * Math.cos(angle);
        const z = Math.min(-0.5, reach * Math.sin(angle));
        const size = 0.3 + 0.25 * hashUnit(index, 3);
        const top = dendriteTop(z) - BILAYER - RECEPTOR.below - 0.06 - size;
        return {
          position: [x, top - 1.5 * hashUnit(index, 4), z] as const,
          rotation: [
            hashUnit(index, 5) * 6,
            hashUnit(index, 6) * 6,
            0,
          ] as const,
          scale: [size * 1.3, size, size] as const,
        };
      }),
    []
  );
  return (
    <Instances placements={placements}>
      <primitive attach="geometry" object={lump} />
      <meshStandardMaterial
        color={SYNAPSE_COLORS.postsynapticDensity}
        roughness={0.75}
      />
    </Instances>
  );
}

/** The microtubules: hollow tubes of thirteen protofilaments, 25 nm across, running the dendrite's length. */
function Microtubules() {
  const shape = useMemo(() => {
    const tube = new CylinderGeometry(
      MICROTUBULE,
      MICROTUBULE,
      2 * DENDRITE.length - 4,
      104,
      1,
      true
    );
    const position = tube.getAttribute("position");
    const point = new Vector3();
    Arr.forEach(Arr.range(0, position.count - 1), (index) => {
      point.fromBufferAttribute(position, index);
      const angle = Math.atan2(point.z, point.x);
      const ridge = 1 + 0.06 * Math.cos(13 * angle);
      position.setXYZ(index, point.x * ridge, point.y, point.z * ridge);
    });
    tube.computeVertexNormals();
    return tube.rotateZ(Math.PI / 2);
  }, []);
  useEffect(() => () => shape.dispose(), [shape]);
  return (
    <Instances
      placements={Arr.map(MICROTUBULES, ([z, y]) => ({
        position: [0, y, z] as const,
      }))}
    >
      <primitive attach="geometry" object={shape} />
      <meshStandardMaterial
        color={SYNAPSE_COLORS.microtubule}
        roughness={0.55}
        side={DoubleSide}
      />
    </Instances>
  );
}

/**
 * One acetylcholine receptor: five subunits round a central vestibule, each
 * a broad ligand-binding domain in the cleft, a narrower stem through the
 * bilayer and a small domain inside the cell.
 */
function useReceptorShape() {
  const shape = useMemo(() => {
    const profile = Arr.map(
      [
        [0.02, -RECEPTOR.below - BILAYER],
        [0.1, -RECEPTOR.below - BILAYER + 0.04],
        [0.12, -BILAYER - 0.25],
        [0.07, -BILAYER - 0.05],
        [0.14, -BILAYER + 0.04],
        [0.14, -0.02],
        [0.19, 0.12],
        [0.2, 0.36],
        [0.16, RECEPTOR.above - 0.08],
        [0.02, RECEPTOR.above],
      ] as const,
      ([radius, y]) => new Vector2(radius, y)
    );
    const subunits = Arr.map(Arr.range(0, 4), (index) => {
      const angle = (index * 2 * Math.PI) / 5;
      return new LatheGeometry(profile, 12).translate(
        0.25 * Math.cos(angle),
        0,
        0.25 * Math.sin(angle)
      );
    });
    const merged = mergeGeometries(subunits);
    Arr.forEach(subunits, (part) => part.dispose());
    return merged;
  }, []);
  useEffect(() => () => shape.dispose(), [shape]);
  return shape;
}

/** How many receptors nearest the release sites the lab shows binding and opening. */
export const SHOWN = 10;

/**
 * The receptor field: every receptor standing through the membrane on the
 * dendrite's face, the ones nearest the release sites first. Those turn
 * bright while their channel is open.
 */
function Receptors() {
  const { clock, rate, treatment } = useSynapse();
  const shape = useReceptorShape();
  const mesh = useRef<InstancedMesh>(null);
  const step = useRef(-1);
  const tones = useMemo(
    () => ({
      open: new Color(SYNAPSE_COLORS.receptorOpen),
      shut: new Color(SYNAPSE_COLORS.receptor),
    }),
    []
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const axis = new Vector3();
    const scale = new Vector3(1, 1, 1);
    const place = new Vector3();
    Arr.forEach(FIELD, ([x, y, z], index) => {
      turn.setFromUnitVectors(up, axis.set(...topNormal(z)));
      target.setMatrixAt(
        index,
        matrix.compose(place.set(x, y, z), turn, scale)
      );
      target.setColorAt(index, tones.shut);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [tones]);

  useFrame(() => {
    const target = mesh.current;
    const now = Math.round(clock.current * 20);
    if (target === null || now === step.current) {
      return;
    }
    step.current = now;
    const time = synapseTime(clock.current, rate);
    const drawn = receptorsAt(
      transmitterAt(time - CROSSING, rate, treatment),
      treatment,
      SHOWN
    );
    Arr.forEach(drawn, (receptor, index) => {
      target.setColorAt(index, receptor.open ? tones.open : tones.shut);
    });
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      args={[shape, undefined, FIELD.length]}
      castShadow
      receiveShadow
      ref={mesh}
    >
      <meshPhysicalMaterial
        clearcoat={0.4}
        clearcoatRoughness={0.4}
        roughness={0.45}
      />
    </instancedMesh>
  );
}

/**
 * Acetylcholinesterase: four subunits, each an ellipsoid about 4.5 by 6 by
 * 6.5 nm (Sussman et al., Science 253:872, 1991), held as a tetramer on a
 * slender anchor rising from the membrane.
 */
function useEnzymeShape() {
  const shape = useMemo(() => {
    const anchor = new CylinderGeometry(0.06, 0.08, 0.95, 8).translate(
      0,
      0.08,
      0
    );
    const subunits = Arr.map(
      [
        [-0.22, 0.86, -0.3],
        [0.22, 0.9, -0.3],
        [-0.22, 0.88, 0.3],
        [0.22, 0.84, 0.3],
      ] as const,
      ([x, y, z]) =>
        new SphereGeometry(1, 18, 12)
          .scale(0.225, 0.3, 0.325)
          .translate(x, y, z)
    );
    const merged = mergeGeometries([anchor, ...subunits]);
    Arr.forEach([anchor, ...subunits], (part) => part.dispose());
    return merged;
  }, []);
  useEffect(() => () => shape.dispose(), [shape]);
  return shape;
}

/** The acetylcholinesterase of the cleft, golden while it works and grey once an organophosphate has blocked it. */
function Enzymes() {
  const { treatment } = useSynapse();
  const shape = useEnzymeShape();
  return (
    <Instances
      placements={Arr.map(ENZYMES, (position) => ({
        position,
        spin: position[0],
        up: topNormal(position[2]),
      }))}
    >
      <primitive attach="geometry" object={shape} />
      <meshPhysicalMaterial
        clearcoat={0.4}
        color={
          treatment === "organophosphate"
            ? SYNAPSE_COLORS.enzymeBlocked
            : SYNAPSE_COLORS.enzyme
        }
        roughness={0.42}
      />
    </Instances>
  );
}
