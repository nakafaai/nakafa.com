import {
  Instances,
  type Placement,
} from "@repo/design-system/components/contents/biology/instances";
import {
  EnvelopeMaterial,
  useBumpySphere,
  useClipping,
  useLocalPlanes,
} from "@repo/design-system/components/contents/biology/surface";
import {
  SPIKES,
  spikeAnchor,
} from "@repo/design-system/components/contents/biology/virus/binding";
import {
  antibodyDomains,
  insideBall,
} from "@repo/design-system/components/contents/biology/virus/capsid";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import { Euler, type Group, Quaternion, Vector3 } from "three";

/** The y axis every part is modelled along before it is turned. */
const UP = new Vector3(0, 1, 0);

/** The M protein dimers that crowd the envelope between the spikes. */
const DIMERS = 520;

/** The ribonucleoprotein complexes packed inside, about 38 in a virion by cryo-electron tomography. */
const PACKAGES = 38;

/** Opened, the eighth of the virion facing the reader is cut away. */
const OCTANT = [
  [-1, 0, 0],
  [0, -1, 0],
  [0, 0, -1],
] as const;

/** A part of a spike in the spike's own frame: where it sits, how it leans, and how it stretches. */
const LOBES = Arr.flatMap(Arr.range(0, 2), (index) => {
  const angle = (index / 3) * Math.PI * 2;
  return [
    {
      lean: [Math.sin(angle) * 0.18, 0, -Math.cos(angle) * 0.18] as const,
      position: [Math.cos(angle) * 0.045, 0.29, Math.sin(angle) * 0.045],
      scale: [0.052, 0.115, 0.052],
    },
    {
      lean: [0, 0, 0] as const,
      position: [
        Math.cos(angle + 0.6) * 0.05,
        0.41,
        Math.sin(angle + 0.6) * 0.05,
      ],
      scale: [0.032, 0.03, 0.032],
    },
  ] as const;
});

/** How each spike stands: its foot on the envelope and the turn of its frame, leaning on its flexible stalk. */
function spikeFrames() {
  return Arr.map(Arr.range(0, SPIKES - 1), (index) => {
    const normal = new Vector3(...spikeAnchor(index, SPIKES));
    const lean = new Quaternion().setFromEuler(
      new Euler(hashUnit(index, 31) * 0.7, hashUnit(index, 37) * Math.PI * 2, 0)
    );
    return {
      foot: normal.clone(),
      index,
      turn: new Quaternion().setFromUnitVectors(UP, normal).multiply(lean),
    };
  });
}

/** Where a point and a turn given in a spike's frame land on the virion. */
function inSpike(
  frame: { readonly foot: Vector3; readonly turn: Quaternion },
  position: readonly [number, number, number],
  turn: Quaternion,
  scale: readonly [number, number, number]
): Placement {
  const at = new Vector3(...position)
    .applyQuaternion(frame.turn)
    .add(frame.foot);
  const facing = new Euler().setFromQuaternion(
    frame.turn.clone().multiply(turn)
  );
  return {
    position: [at.x, at.y, at.z],
    rotation: [facing.x, facing.y, facing.z],
    scale,
  };
}

/**
 * A SARS-CoV-2 virion about 100 nm across, drawn with a radius of 1 for
 * 50 nm: a lipid envelope crowded with M protein dimers and 24 spike trimers
 * about 20 nm long, each a club-shaped head of three lobes on a stalk that
 * leans on its hinges, as cryo-electron tomograms show them. A spike in
 * `bound` carries a Y-shaped IgG antibody on its head. `open` cuts away the
 * eighth facing the reader to show the ribonucleoprotein packed inside.
 */
export function Virion({
  bound = [],
  open = false,
}: {
  readonly bound?: readonly boolean[];
  readonly open?: boolean;
}) {
  useClipping();
  const body = useRef<Group>(null);
  const planes = useLocalPlanes(body, OCTANT);
  const clip = open ? planes : undefined;
  const envelope = useBumpySphere(1, 9, 0.035);
  const frames = useMemo(spikeFrames, []);
  const spikes = useMemo(() => {
    const still = new Quaternion();
    return {
      lobes: Arr.flatMap(frames, (frame) =>
        Arr.map(LOBES, ({ lean, position, scale }) =>
          inSpike(
            frame,
            position,
            new Quaternion().setFromEuler(new Euler(...lean)),
            scale
          )
        )
      ),
      stalks: Arr.map(frames, (frame) =>
        inSpike(frame, [0, 0.1, 0], still, [1, 1, 1])
      ),
    };
  }, [frames]);
  const antibodies = useMemo(() => {
    const domains = antibodyDomains();
    const held = Arr.filter(frames, ({ index }) => bound[index] === true);
    const place = (chain: "heavy" | "light") =>
      Arr.flatMap(held, (frame) =>
        Arr.map(
          Arr.filter(domains, (domain) => domain.chain === chain),
          ({ direction, position }) =>
            inSpike(
              frame,
              [position[0], position[1] + 0.43, position[2]],
              new Quaternion().setFromUnitVectors(
                UP,
                new Vector3(...direction)
              ),
              [0.026, 0.04, 0.024]
            )
        )
      );
    return { heavy: place("heavy"), light: place("light") };
  }, [bound, frames]);
  const dimers = useMemo(
    () =>
      Arr.map(Arr.range(0, DIMERS - 1), (index) => {
        const direction = new Vector3(...spikeAnchor(index, DIMERS))
          .add(
            new Vector3(
              hashUnit(index, 3) - 0.5,
              hashUnit(index, 5) - 0.5,
              hashUnit(index, 7) - 0.5
            ).multiplyScalar(0.08)
          )
          .normalize();
        return {
          position: [direction.x, direction.y, direction.z] as const,
          scale: [0.034, 0.022, 0.024] as const,
          spin: hashUnit(index, 11) * Math.PI,
          up: [direction.x, direction.y, direction.z] as const,
        };
      }),
    []
  );

  return (
    <group ref={body}>
      <mesh castShadow geometry={envelope} receiveShadow>
        <EnvelopeMaterial clip={clip} color={MATERIAL.viralEnvelope} wedge />
      </mesh>
      <Instances placements={dimers}>
        <sphereGeometry args={[1, 8, 6]} />
        <EnvelopeMaterial clip={clip} color={MATERIAL.membraneDimer} wedge />
      </Instances>
      <Instances placements={spikes.stalks}>
        <cylinderGeometry args={[0.022, 0.03, 0.2, 7]} />
        <EnvelopeMaterial clip={clip} color={MATERIAL.spike} wedge />
      </Instances>
      <Instances placements={spikes.lobes}>
        <sphereGeometry args={[1, 14, 10]} />
        <EnvelopeMaterial clip={clip} color={MATERIAL.spike} wedge />
      </Instances>
      {antibodies.heavy.length > 0 ? (
        <group>
          <Instances placements={antibodies.heavy}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={MATERIAL.antibody}
              roughness={0.4}
            />
          </Instances>
          <Instances placements={antibodies.light}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={MATERIAL.antibodyLight}
              roughness={0.4}
            />
          </Instances>
        </group>
      ) : null}
      {open ? <Packages /> : null}
    </group>
  );
}

/**
 * The genome inside: RNA wound round nucleocapsid protein in some 38 compact
 * packages, each a ring of N protein about 15 nm across, crowded through the
 * lumen.
 */
function Packages() {
  const beads = useMemo(
    () =>
      Arr.flatMap(insideBall(PACKAGES, 0.78, 4), (centre, index) => {
        const tilt = new Quaternion().setFromEuler(
          new Euler(hashUnit(index, 13) * 3, hashUnit(index, 17) * 3, 0)
        );
        return Arr.map(Arr.range(0, 5), (bead) => {
          const angle = (bead / 6) * Math.PI * 2;
          const at = new Vector3(
            Math.cos(angle) * 0.06,
            0,
            Math.sin(angle) * 0.06
          )
            .applyQuaternion(tilt)
            .add(new Vector3(...centre));
          return {
            position: [at.x, at.y, at.z] as const,
            scale: [0.038, 0.038, 0.038] as const,
          };
        });
      }),
    []
  );
  return (
    <Instances placements={beads}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshPhysicalMaterial
        clearcoat={0.3}
        color={MATERIAL.nucleocapsid}
        roughness={0.5}
      />
    </Instances>
  );
}
