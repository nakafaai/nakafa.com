import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  cargoForms,
  cellForms,
  golgiForms,
  granuleForms,
  granulePlacements,
  nucleusForms,
  reticulumForms,
  ribosomeForms,
  ribosomePlacements,
  vesicleForms,
} from "@repo/design-system/components/contents/biology/secretion/anatomy";
import type { SecretionStep } from "@repo/design-system/components/contents/biology/secretion/model";
import { waypointOf } from "@repo/design-system/components/contents/biology/secretion/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Body, Tuft } from "@repo/design-system/components/three/organism/body";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** The wet membrane of an organelle, lit from within by its own colour. */
function OrganelleSkin({ flesh }: { readonly flesh: string }) {
  return (
    <Skin
      bump={0.5}
      flesh={flesh}
      glow={0.35}
      repeat={[6, 2]}
      roughness={0.45}
      surface="mucosa"
      wet={0.55}
    />
  );
}

function SecretionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.35, 4.15] : [0, 1.85, 3.2]}
      cameraTarget={[0.05, 0.28, 0]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.5}
    />
  );
}

export function SecretionScene({
  activeStep,
  onAdvanceStep,
  parts,
}: {
  readonly activeStep: SecretionStep;
  readonly onAdvanceStep: () => void;
  readonly parts: Readonly<
    Record<
      | "nucleus"
      | "ribosome"
      | "reticulum"
      | "golgi"
      | "vesicle"
      | "membrane"
      | "duct",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const cargoRef = useRef<Group>(null);
  const timer = useRef(0);
  const target = waypointOf(activeStep);
  const granules = useMemo(granulePlacements, []);
  const ribosomes = useMemo(ribosomePlacements, []);

  useFrame((_, delta) => {
    const dt = simulationStep(delta);
    if (playing) {
      timer.current += dt;
      if (timer.current >= 1.6) {
        timer.current = 0;
        onAdvanceStep();
      }
    }
    const cargo = cargoRef.current;
    if (cargo === null) {
      return;
    }
    const blend = Math.min(1, dt * 6);
    cargo.position.x += (target[0] - cargo.position.x) * blend;
    cargo.position.y += (target[1] - cargo.position.y) * blend;
    cargo.position.z += (target[2] - cargo.position.z) * blend;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <SecretionCamera />
      <Body shape={cellForms}>
        <Skin
          bump={0.5}
          flesh={ENZYME_COLORS.ductWall}
          glow={0.3}
          repeat={[3, 3]}
          roughness={0.6}
          surface="cytoplasm"
          wet={0.35}
        />
      </Body>
      <Body shape={nucleusForms}>
        <Skin
          bump={0.5}
          flesh={ENZYME_COLORS.nucleus}
          glow={0.4}
          repeat={[5, 5]}
          roughness={0.55}
          surface="cytoplasm"
          wet={0.3}
        />
      </Body>
      <Body shape={reticulumForms}>
        <OrganelleSkin flesh={ENZYME_COLORS.reticulum} />
      </Body>
      <Body shape={golgiForms}>
        <OrganelleSkin flesh={ENZYME_COLORS.golgi} />
      </Body>
      <Tuft placements={ribosomes} shape={ribosomeForms}>
        <OrganelleSkin flesh={ENZYME_COLORS.ribosome} />
      </Tuft>
      <Tuft placements={granules} shape={granuleForms}>
        <OrganelleSkin flesh={ENZYME_COLORS.vesicle} />
      </Tuft>

      {/* Secretory vesicle + moving enzyme cargo */}
      <group position={[target[0], target[1], target[2]]} ref={cargoRef}>
        <group scale={0.075}>
          <Body shape={cargoForms}>
            <OrganelleSkin flesh={ENZYME_COLORS.cargo} />
          </Body>
        </group>
        <group scale={0.13}>
          <Body cast={false} shape={vesicleForms}>
            <Skin
              bump={0.3}
              clear={0.6}
              flesh={ENZYME_COLORS.vesicle}
              glow={0.5}
              repeat={[2, 2]}
              roughness={0.2}
              surface="cytoplasm"
              wet={0.9}
            />
          </Body>
        </group>
      </group>

      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-1.05, 0.78, 0]}
      >
        <span>{parts.nucleus}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        anchorY="top"
        fontSize="compact"
        position={[-0.5, 0.16, 0.86]}
      >
        <span>{parts.ribosome}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.15, 0.98, -0.62]}
      >
        <span>{parts.reticulum}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        anchorY="top"
        fontSize="compact"
        position={[0.42, 0.14, 0.34]}
      >
        <span>{parts.golgi}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[0.95, 0.5, 0.1]}
      >
        <span>{parts.vesicle}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        anchorX="right"
        anchorY="top"
        fontSize="compact"
        position={[1.22, 0.14, 0.92]}
      >
        <span>{parts.membrane}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        anchorX="right"
        fontSize="compact"
        position={[1.56, 0.78, -0.7]}
      >
        <span>{parts.duct}</span>
      </ThreeLabel>
    </group>
  );
}
