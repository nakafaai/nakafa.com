import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
import { Molecules } from "@repo/design-system/components/contents/biology/climate/molecules";
import {
  Atmosphere,
  Earth,
} from "@repo/design-system/components/contents/biology/climate/planet";
import {
  CAMERA,
  SUN,
} from "@repo/design-system/components/contents/biology/climate/rays";
import { Ribbons } from "@repo/design-system/components/contents/biology/climate/ribbons";
import { Sun } from "@repo/design-system/components/contents/biology/climate/sun";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { useRequired } from "@repo/design-system/hooks/required";
import { MATERIAL } from "@repo/design-system/lib/material";
import type { ReactNode } from "react";
import { createContext, Suspense, useRef, useState } from "react";
import type { Group } from "three";
import { createStore, useStore } from "zustand";
import { combine } from "zustand/middleware";

const DEFAULT_GAS_LEVEL = 3;

/** Creates the lab's store, which holds the gas level its slider sets. */
function createGasLevelStore(initialGasLevel: number) {
  return createStore(
    combine({ gasLevel: initialGasLevel }, (set) => ({
      setGasLevel: (gasLevel: number) => set({ gasLevel }),
    }))
  );
}

type GasLevelStore = ReturnType<typeof createGasLevelStore>;

/**
 * The gas-level store of the lab, handed into its canvas. The store itself
 * never changes, so only the parts that read the level rerun when it moves.
 */
const GreenhouseContext = createContext<GasLevelStore | null>(null);

/** Reads the gas level the slider of the surrounding lab sets. */
function useGreenhouseGasLevel() {
  return useStore(
    useRequired(GreenhouseContext, "useGreenhouseGasLevel"),
    (state) => state.gasLevel
  );
}

interface GreenhouseEffectLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    gasControl: string;
    heatFlow: ReactNode;
    heatFlowLabel: string;
    meaning: ReactNode;
    meaningLabel: string;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

export function GreenhouseEffectLab(props: GreenhouseEffectLabProps) {
  const { description, labels, title } = props;
  const [store] = useState(() => createGasLevelStore(DEFAULT_GAS_LEVEL));
  const gasLevel = useStore(store, (state) => state.gasLevel);
  const setGasLevel = useStore(store, (state) => state.setGasLevel);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.gasControl}</span>
            <span className="shrink-0 tabular-nums">{gasLevel}/5</span>
          </div>
          <Slider
            aria-label={labels.gasControl}
            max={5}
            min={1}
            onValueChange={setGasLevel}
            step={1}
            value={gasLevel}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage frameloop="always" setting="space">
          <Suspense>
            <CameraControls
              cameraPosition={CAMERA.position}
              cameraTarget={CAMERA.target}
              fov={42}
            />
            <GreenhouseContext value={store}>
              <GreenhouseScene />
            </GreenhouseContext>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.heatFlowLabel} value={labels.heatFlow} />
          <VisualFact label={labels.meaningLabel} value={labels.meaning} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The scene: the Sun and its beams, the turning Earth in its glowing air,
 * the greenhouse gas molecules, and the infrared leaving the surface.
 */
function GreenhouseScene() {
  const level = useGreenhouseGasLevel();
  const earthRef = useRef<Group>(null);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });

  useFrame((_, delta) => {
    if (calm || earthRef.current === null) {
      return;
    }
    earthRef.current.rotation.y += delta * 0.06;
  });

  return (
    <group>
      <directionalLight
        color={MATERIAL.sunlight}
        intensity={1.4}
        position={SUN.position}
      />
      <Sun />
      <CameraBounds motion={{ rotation: "y" }} objectRef={earthRef}>
        <Earth />
      </CameraBounds>
      <Atmosphere level={level} />
      <Molecules level={level} />
      <Ribbons level={level} />
    </group>
  );
}
