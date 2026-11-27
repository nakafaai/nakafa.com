import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useGiemsaTexture } from "@repo/design-system/components/contents/biology/chromatin";
import type { MutationKind } from "@repo/design-system/components/contents/biology/mutation/model";
import { evaluateChromosomeMutation } from "@repo/design-system/components/contents/biology/mutation/model";
import { SpecimenPedestal } from "@repo/design-system/components/contents/biology/workbench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { LatheGeometry, Vector2 } from "three";

const REFERENCE_BANDS = ["A", "B", "C", "D"] as const;

function MutationCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.48, 3.35] : [0, 1.24, 2.75]}
      cameraTarget={[0, 0.68, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function bandColor(code: "A" | "B" | "C" | "D"): string {
  return Match.value(code).pipe(
    Match.when("A", () => GENETICS_COLORS.bandA),
    Match.when("B", () => GENETICS_COLORS.bandB),
    Match.when("C", () => GENETICS_COLORS.bandC),
    Match.when("D", () => GENETICS_COLORS.bandD),
    Match.exhaustive
  );
}

function createBandSegmentGeometry(
  height: number,
  radius: number,
  capTop: boolean,
  capBottom: boolean
) {
  const half = height / 2;
  const steps = 16;
  const pts = Arr.map(Arr.range(0, steps), (i) => {
    const t = i / steps;
    const y = -half + t * height;
    let r = radius * (0.94 + 0.08 * Math.sin(t * Math.PI));
    if (capBottom && t < 0.25) {
      const u = 1 - t / 0.25;
      r = radius * Math.sqrt(Math.max(0.002, 1 - u * u));
    } else if (capTop && t > 0.75) {
      const u = (t - 0.75) / 0.25;
      r = radius * Math.sqrt(Math.max(0.002, 1 - u * u));
    } else if (t < 0.1 || t > 0.9) {
      r = radius * 0.76;
    }
    return new Vector2(Math.max(0.002, r), y);
  });
  return new LatheGeometry(pts, 28);
}

/** One sculpted Giemsa-banded chromosomal locus segment with organic pinched boundaries. */
function LocusSegment({
  capBottom,
  capTop,
  color,
  height = 0.21,
  highlighted = false,
  position,
  radius = 0.088,
}: {
  readonly capBottom: boolean;
  readonly capTop: boolean;
  readonly color: string;
  readonly height?: number;
  readonly highlighted?: boolean;
  readonly position: readonly [number, number, number];
  readonly radius?: number;
}) {
  const geo = useMemo(
    () =>
      createBandSegmentGeometry(
        height,
        highlighted ? radius * 1.1 : radius,
        capTop,
        capBottom
      ),
    [capBottom, capTop, height, highlighted, radius]
  );
  const giemsa = useGiemsaTexture(color, GENETICS_COLORS.giemsaDark, color, 4);

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <group position={position}>
      <mesh castShadow geometry={geo} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.56}
          clearcoatRoughness={0.28}
          color={giemsa === null ? color : getColor("WHITE")}
          emissive={
            highlighted ? GENETICS_COLORS.brokenHighlight : getColor("BLACK")
          }
          emissiveIntensity={highlighted ? 0.24 : 0}
          map={giemsa}
          roughness={0.38}
        />
      </mesh>
      {highlighted ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 1.24, 0.009, 10, 32]} />
          <meshPhysicalMaterial
            color={GENETICS_COLORS.brokenHighlight}
            emissive={GENETICS_COLORS.brokenHighlight}
            emissiveIntensity={0.65}
            roughness={0.2}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/** Golden constricted kinetochore centromere collar. */
function CentromereCollar({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh castShadow scale={[1.05, 0.44, 0.88]}>
        <sphereGeometry args={[0.088, 22, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.74}
          color={GENETICS_COLORS.kinetochoreGold}
          metalness={0.44}
          roughness={0.26}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.096, 0.012, 10, 32]} />
        <MetalMaterial color={GENETICS_COLORS.brassPolished} roughness={0.24} />
      </mesh>
    </group>
  );
}

/** Paired sister-chromatid cytogenetic chromosome with sculpted loci bands and centromere. */
function BandedHomologue({
  bands,
  position,
}: {
  readonly bands: readonly {
    readonly color: string;
    readonly highlighted: boolean;
    readonly id: string;
  }[];
  readonly position: readonly [number, number, number];
}) {
  const stepY = 0.205;
  const topY = ((bands.length - 1) * stepY) / 2;

  return (
    <group position={position}>
      {Arr.map([-0.068, 0.068] as const, (offsetX, sisterIdx) => (
        <group
          key={offsetX}
          position={[offsetX, 0, 0]}
          rotation={[0, 0, sisterIdx === 0 ? 0.04 : -0.04]}
        >
          {Arr.map(bands, (band, index) => (
            <LocusSegment
              capBottom={index === bands.length - 1}
              capTop={index === 0}
              color={band.color}
              highlighted={band.highlighted}
              key={`${offsetX}-${band.id}`}
              position={[0, topY - index * stepY, 0]}
              radius={0.066}
            />
          ))}
        </group>
      ))}
      <CentromereCollar position={[0, topY - stepY * 0.5, 0]} />
    </group>
  );
}

export function ChromosomeMutationScene({
  mutation,
  parts,
}: {
  readonly mutation: MutationKind;
  readonly parts: Readonly<
    Record<"brokenSegment" | "centromere" | "extraCopy" | "normalArm", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const mutatedRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const profile = evaluateChromosomeMutation(mutation);

  const rewind = () => {
    phaseRef.current = 0;
    if (mutatedRef.current !== null) {
      mutatedRef.current.position.set(0.18, 0.68, 0);
      mutatedRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || mutatedRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.8;
    const pulse = Math.sin(phaseRef.current);
    mutatedRef.current.position.y = 0.68 + pulse * 0.032;
    mutatedRef.current.rotation.y = Math.sin(phaseRef.current * 0.5) * 0.22;
  });

  const referenceBands = useMemo(
    () =>
      Arr.map(REFERENCE_BANDS, (code) => ({
        color: bandColor(code),
        highlighted: false,
        id: `ref-${code}`,
      })),
    []
  );

  const mutatedBands = useMemo(
    () =>
      Arr.map(profile.bands, (band) => ({
        color: bandColor(band.code),
        highlighted: band.highlighted,
        id: band.id,
      })),
    [profile.bands]
  );

  const extraBands = useMemo(
    () =>
      Arr.map(REFERENCE_BANDS, (code) => ({
        color:
          profile.hasNonHomologue && code === "C"
            ? GENETICS_COLORS.brokenHighlight
            : GENETICS_COLORS.extraCopyPurple,
        highlighted: profile.hasNonHomologue && code === "C",
        id: `extra-${code}`,
      })),
    [profile.hasNonHomologue]
  );

  const hasExtra = profile.copyCount === 3 || profile.hasNonHomologue;

  return (
    <group>
      <SimulationTicker running={playing} />
      <MutationCamera />
      <SpecimenPedestal depth={0.9} height={0.055} width={2.35} />

      {/* Normal reference chromosome pair (left) */}
      <BandedHomologue
        bands={referenceBands}
        position={[hasExtra ? -0.68 : -0.52, 0.68, 0]}
      />

      {/* Mutated chromosome pair (center/right) */}
      <group position={[hasExtra ? 0.06 : 0.44, 0.68, 0]} ref={mutatedRef}>
        <BandedHomologue bands={mutatedBands} position={[0, 0, 0]} />
      </group>

      {/* Extra copy for nondisjunction (trisomy) or non-homologue for translocation */}
      {hasExtra ? (
        <BandedHomologue bands={extraBands} position={[0.78, 0.68, 0]} />
      ) : null}

      {/* Adaptive-ink labels */}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[hasExtra ? -0.68 : -0.52, 1.24, 0]}
      >
        <span>{parts.normalArm}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[hasExtra ? -0.96 : -0.82, 0.88, 0]}
      >
        <span>{parts.centromere}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[hasExtra ? 0.06 : 0.44, 1.32, 0]}
      >
        <span>{parts.brokenSegment}</span>
      </ThreeLabel>
      {hasExtra ? (
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          position={[0.82, 1.24, 0]}
        >
          <span>{parts.extraCopy}</span>
        </ThreeLabel>
      ) : null}
    </group>
  );
}
