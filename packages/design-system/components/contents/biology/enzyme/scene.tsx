import { useFrame, useThree } from "@react-three/fiber";
import type {
  BindingModel,
  Disaccharidase,
  Disaccharide,
} from "@repo/design-system/components/contents/biology/enzyme/model";
import {
  cyclePhase,
  reactionFor,
} from "@repo/design-system/components/contents/biology/enzyme/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const ENZYME_TINT: Readonly<Record<Disaccharidase, string>> = {
  lactase: ENZYME_COLORS.lactase,
  maltase: ENZYME_COLORS.maltase,
  sucrase: ENZYME_COLORS.sucrase,
};

const SUBSTRATE_TINT: Readonly<Record<Disaccharide, string>> = {
  lactose: ENZYME_COLORS.lactose,
  maltose: ENZYME_COLORS.maltose,
  sucrose: ENZYME_COLORS.sucrose,
};

function SubstrateShape({ substrate }: { readonly substrate: Disaccharide }) {
  const tint = SUBSTRATE_TINT[substrate];
  return Match.value(substrate).pipe(
    Match.when("lactose", () => (
      <group>
        <mesh castShadow position={[-0.14, 0, 0]}>
          <sphereGeometry args={[0.14, 18, 14]} />
          <meshStandardMaterial
            color={ENZYME_COLORS.glucose}
            roughness={0.42}
          />
        </mesh>
        <mesh castShadow position={[0.14, 0, 0]}>
          <octahedronGeometry args={[0.15, 1]} />
          <meshStandardMaterial
            color={ENZYME_COLORS.galactose}
            roughness={0.42}
          />
        </mesh>
      </group>
    )),
    Match.when("sucrose", () => (
      <group>
        <mesh castShadow position={[-0.14, 0, 0]}>
          <sphereGeometry args={[0.14, 18, 14]} />
          <meshStandardMaterial
            color={ENZYME_COLORS.glucose}
            roughness={0.42}
          />
        </mesh>
        <mesh castShadow position={[0.14, 0, 0]}>
          <boxGeometry args={[0.24, 0.22, 0.22]} />
          <meshStandardMaterial
            color={ENZYME_COLORS.fructose}
            roughness={0.42}
          />
        </mesh>
      </group>
    )),
    Match.when("maltose", () => (
      <group>
        <mesh castShadow position={[-0.14, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.18, 6]} />
          <meshStandardMaterial color={tint} roughness={0.42} />
        </mesh>
        <mesh castShadow position={[0.14, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.18, 6]} />
          <meshStandardMaterial color={tint} roughness={0.42} />
        </mesh>
      </group>
    )),
    Match.exhaustive
  );
}

function EnzymeCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.85, 3.85] : [0, 1.45, 3.1]}
      cameraTarget={[0, 0.28, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

function positionSubstrate(
  target: Group | null,
  fits: boolean,
  phase: ReturnType<typeof cyclePhase>
) {
  if (target === null) {
    return;
  }
  if (fits) {
    target.visible = phase.stage === "approach" || phase.stage === "complex";
    const approachT = Math.min(1, phase.t / 0.3);
    target.position.set(0, phase.bound ? 0.38 : 1.15 - approachT * 0.77, 0);
    target.rotation.z = 0;
    return;
  }
  target.visible = true;
  const bounce = Math.abs(Math.sin(phase.t * Math.PI * 2));
  target.position.set(0, 0.78 + bounce * 0.38, 0);
  target.rotation.z = Math.sin(phase.t * Math.PI * 2) * 0.35;
}

function positionProducts(
  left: Group | null,
  right: Group | null,
  fits: boolean,
  phase: ReturnType<typeof cyclePhase>
) {
  const show = fits && (phase.stage === "release" || phase.stage === "reset");
  const splitT = Math.min(1, Math.max(0, (phase.t - 0.58) / 0.32));
  if (left !== null) {
    left.visible = show;
    left.position.set(-0.22 - splitT * 0.68, 0.45 + splitT * 0.48, 0);
  }
  if (right !== null) {
    right.visible = show;
    right.position.set(0.22 + splitT * 0.68, 0.45 + splitT * 0.48, 0);
  }
}

export function ActiveSiteScene({
  enzyme,
  model,
  onCycleComplete,
  parts,
  substrate,
}: {
  readonly enzyme: Disaccharidase;
  readonly model: BindingModel;
  readonly onCycleComplete: () => void;
  readonly parts: Readonly<Record<"site" | "complex" | "water", string>>;
  readonly substrate: Disaccharide;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const reaction = reactionFor(enzyme, substrate);
  const progress = useRef(0.45);
  const leftLobe = useRef<Group>(null);
  const rightLobe = useRef<Group>(null);
  const substrateRef = useRef<Group>(null);
  const productLeft = useRef<Group>(null);
  const productRight = useRef<Group>(null);
  const waterRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (playing) {
      const next = progress.current + simulationStep(delta) * 0.28;
      if (next >= 1) {
        progress.current = next - 1;
        if (reaction.fits) {
          onCycleComplete();
        }
      } else {
        progress.current = next;
      }
    }
    const phase = cyclePhase(progress.current);
    const flex =
      model === "inducedFit" && reaction.fits && phase.bound ? 0.16 : 0;

    if (leftLobe.current !== null) {
      leftLobe.current.rotation.z = -flex;
    }
    if (rightLobe.current !== null) {
      rightLobe.current.rotation.z = flex;
    }

    positionSubstrate(substrateRef.current, reaction.fits, phase);

    if (waterRef.current !== null) {
      waterRef.current.visible = reaction.fits && phase.bound;
      waterRef.current.position.set(0, 0.78 - (phase.t - 0.3) * 0.65, 0.35);
    }

    positionProducts(
      productLeft.current,
      productRight.current,
      reaction.fits,
      phase
    );
  });

  const enzymeColor = ENZYME_TINT[enzyme];
  const productA = reaction.products[0] ?? "glucose";
  const productB = reaction.products[1] ?? "glucose";

  return (
    <group>
      <SimulationTicker running={playing} />
      <EnzymeCamera />
      <group position={[0, 0.14, 0]}>
        <mesh
          castShadow
          position={[0, -0.04, 0]}
          receiveShadow
          scale={[1.35, 0.72, 0.9]}
        >
          <sphereGeometry args={[0.42, 24, 18]} />
          <meshStandardMaterial color={enzymeColor} roughness={0.48} />
        </mesh>
        <group position={[-0.36, 0.16, 0]} ref={leftLobe}>
          <mesh castShadow scale={[0.72, 1.15, 0.85]}>
            <sphereGeometry args={[0.26, 20, 14]} />
            <meshStandardMaterial color={enzymeColor} roughness={0.48} />
          </mesh>
        </group>
        <group position={[0.36, 0.16, 0]} ref={rightLobe}>
          <mesh castShadow scale={[0.72, 1.15, 0.85]}>
            <sphereGeometry args={[0.26, 20, 14]} />
            <meshStandardMaterial color={enzymeColor} roughness={0.48} />
          </mesh>
        </group>
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[0, -0.36, 0.25]}
        >
          <span className="font-medium">
            {reaction.fits ? parts.complex : parts.site}
          </span>
        </ThreeLabel>
      </group>

      <group position={[0, 0.38, 0]} ref={substrateRef}>
        <SubstrateShape substrate={substrate} />
      </group>

      <group position={[0, 0.72, 0.35]} ref={waterRef} visible={reaction.fits}>
        <mesh castShadow>
          <sphereGeometry args={[0.07, 14, 10]} />
          <meshPhysicalMaterial color={ENZYME_COLORS.water} roughness={0.18} />
        </mesh>
        <ThreeLabel
          color={ENZYME_COLORS.labelInk}
          fontSize="compact"
          position={[0, 0.14, 0]}
        >
          <span>{parts.water}</span>
        </ThreeLabel>
      </group>

      <group position={[-0.4, 0.65, 0]} ref={productLeft} visible={false}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial
            color={ENZYME_COLORS[productA]}
            roughness={0.42}
          />
        </mesh>
      </group>
      <group position={[0.4, 0.65, 0]} ref={productRight} visible={false}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial
            color={ENZYME_COLORS[productB]}
            roughness={0.42}
          />
        </mesh>
      </group>
    </group>
  );
}
