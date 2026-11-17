import { BiologyCallouts } from "@repo/design-system/components/contents/biology/callouts";
import { useBiologyItemSelection } from "@repo/design-system/components/contents/biology/context";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import {
  BiologyLabFrame,
  type BiologyLabProps,
  type BiologySceneProps,
} from "@repo/design-system/components/contents/biology/lab";
import { RotatingGroup } from "@repo/design-system/components/contents/biology/motion";
import {
  EnvelopeMaterial,
  useBumpySphere,
  useClipping,
  useLocalPlanes,
} from "@repo/design-system/components/contents/biology/surface";
import { spikeAnchor } from "@repo/design-system/components/contents/biology/virus/binding";
import { spoolPath } from "@repo/design-system/components/contents/biology/virus/capsid";
import {
  EnvelopedVirusModel,
  HelicalVirusModel,
  IcosahedralCapsid,
  PolyhedralVirusModel,
} from "@repo/design-system/components/contents/biology/virus/parts";
import { BacteriophageModel } from "@repo/design-system/components/contents/biology/virus/phage";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { VIRION_COLORS } from "@repo/design-system/lib/material/virion";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, type Group, Vector3 } from "three";

const VIRION_VIEW = {
  cameraPosition: [2.05, 1.5, 2.85],
  cameraTarget: [0, 0.04, 0],
  narrowCameraPosition: [2.25, 1.72, 3.15],
} satisfies NarrowCameraPose;
const MORPHOLOGY_VIEW = {
  cameraPosition: [0, 1.5, 5.8],
  cameraTarget: [0, -0.02, 0],
  narrowCameraPosition: [0, 1.5, 6.2],
} satisfies NarrowCameraPose;
const MORPHOLOGY_LABEL_TARGETS = [
  { id: "helical", labelPosition: [-1.1, 0.26, 0.3] },
  { id: "polyhedral", labelPosition: [1.1, 0.26, 0.3] },
  { id: "enveloped", labelPosition: [-1.1, -1.72, 0.3] },
  { id: "complex", labelPosition: [1.1, -1.72, 0.3] },
] as const;

/**
 * Renders the virus structure lab with capsid, genome, and envelope focus modes.
 */
export function VirusStructureLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={VirusStructureScene}
      view={VIRION_VIEW}
      {...props}
    />
  );
}

/**
 * Renders major virus morphology types as distinct reusable 3D assets.
 */
export function VirusMorphologyLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={VirusMorphologyScene}
      view={MORPHOLOGY_VIEW}
      {...props}
    />
  );
}

/** Opened, the quarter of the virion facing the reader is cut away, and stays toward the reader as the model turns. */
const QUARTER = [
  [-1, 0, 0],
  [0, 0, -1],
] as const;

/** The glycoproteins standing out of the envelope. */
const GLYCOPROTEINS = Arr.map(Arr.range(0, 299), (index) => {
  const direction = spikeAnchor(index, 300);
  return {
    head: {
      position: [
        direction[0] * 1.2,
        direction[1] * 1.2,
        direction[2] * 1.2,
      ] as const,
      scale: [0.026, 0.045, 0.026] as const,
      up: direction,
    },
    stalk: {
      position: [
        direction[0] * 1.14,
        direction[1] * 1.14,
        direction[2] * 1.14,
      ] as const,
      up: direction,
    },
  };
});

/**
 * Shows that a virion is genetic material packaged in protein, sometimes with
 * an envelope, on a herpesvirus: double-stranded DNA spooled inside an
 * icosahedral capsid of 162 capsomeres (triangulation number 16), inside a
 * lipid envelope studded with glycoproteins. The envelope opens to show the
 * capsid, and the capsid opens to show the genome.
 */
function VirusStructureScene() {
  useClipping();
  const selectedIndex = useBiologyItemSelection((state) => state.selectedIndex);
  const opening = useRef<Group>(null);
  const planes = useLocalPlanes(opening, QUARTER);
  const envelope = useBumpySphere(1.1, 2, 0.03);
  const genome = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(spoolPath(4, 7, 0.6), (point) => new Vector3(...point))
      ),
    []
  );
  const envelopeClip = selectedIndex === 2 ? undefined : planes;
  const capsidClip = selectedIndex === 1 ? planes : undefined;

  return (
    <group ref={opening}>
      <RotatingGroup speed={0.08}>
        <mesh castShadow geometry={envelope} receiveShadow>
          <EnvelopeMaterial
            clip={envelopeClip}
            color={VIRION_COLORS.viralEnvelope}
            wedge
          />
        </mesh>
        <Instances placements={Arr.map(GLYCOPROTEINS, ({ stalk }) => stalk)}>
          <cylinderGeometry args={[0.008, 0.012, 0.1, 6]} />
          <EnvelopeMaterial
            clip={envelopeClip}
            color={VIRION_COLORS.haemagglutinin}
            wedge
          />
        </Instances>
        <Instances placements={Arr.map(GLYCOPROTEINS, ({ head }) => head)}>
          <sphereGeometry args={[1, 10, 8]} />
          <EnvelopeMaterial
            clip={envelopeClip}
            color={VIRION_COLORS.haemagglutinin}
            wedge
          />
        </Instances>
        <IcosahedralCapsid clip={capsidClip} frequency={4} radius={0.8} />
        <mesh castShadow>
          <tubeGeometry
            args={[genome, 2400, selectedIndex === 1 ? 0.022 : 0.016, 6, false]}
          />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={VIRION_COLORS.nucleicAcid}
            roughness={0.45}
          />
        </mesh>
      </RotatingGroup>
    </group>
  );
}

/**
 * Compares the four viral morphologies in two rows, including on narrow screens.
 */
function VirusMorphologyScene({ item }: BiologySceneProps) {
  return (
    <group>
      <group position={[-1.1, 0.95, 0]} rotation={[0.08, -0.24, 0.08]}>
        <HelicalVirusModel scale={1.35} />
      </group>
      <group position={[1.1, 0.95, 0]} rotation={[0.18, 0.3, -0.08]}>
        <PolyhedralVirusModel scale={1.02} />
      </group>
      <group position={[-1.1, -0.8, 0]} rotation={[0.12, -0.25, 0]}>
        <EnvelopedVirusModel scale={1.2} />
      </group>
      <group position={[1.1, -0.7, 0]} rotation={[0.12, 0.22, -0.06]}>
        <BacteriophageModel scale={0.98} />
      </group>
      <BiologyCallouts
        callouts={item.callouts}
        targets={MORPHOLOGY_LABEL_TARGETS}
      />
    </group>
  );
}
