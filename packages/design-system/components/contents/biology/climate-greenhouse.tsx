import { useReducedMotion } from "@mantine/hooks";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BLUE_MARBLE_EARTH_TEXTURE_ASSET } from "@repo/design-system/components/contents/biology/assets";
import {
  type BiologySceneColors,
  getBiologySceneColors,
} from "@repo/design-system/components/contents/biology/data";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
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
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import type { ReactNode, RefObject } from "react";
import { createContext, Suspense, use, useMemo, useRef, useState } from "react";
import { type Group, SRGBColorSpace } from "three";
import { createStore, useStore } from "zustand";
import { combine } from "zustand/middleware";

const DEFAULT_GAS_LEVEL = 3;
const HEAT_PARTICLE_IDS = Array.from(
  { length: 14 },
  (_, index) => `heat-${index}`
);

/** Creates the lab's store, which holds the gas level its slider sets. */
function createGasLevelStore(initialGasLevel: number) {
  return createStore(
    combine({ gasLevel: initialGasLevel }, (set) => ({
      setGasLevel: (gasLevel: number) => set({ gasLevel }),
    }))
  );
}

type GasLevelStore = ReturnType<typeof createGasLevelStore>;

interface GreenhouseProviderProps {
  children: ReactNode;
  colors: BiologySceneColors;
  store: GasLevelStore;
}

const GreenhouseContext = createContext<Omit<
  GreenhouseProviderProps,
  "children"
> | null>(null);

/**
 * Provides the colors and the gas-level store of the lab to its scene. The
 * value changes only with the colors, so the scene does not rerun when the
 * slider moves.
 */
function GreenhouseProvider({
  children,
  colors,
  store,
}: GreenhouseProviderProps) {
  const value = useMemo(() => ({ colors, store }), [colors, store]);

  return <GreenhouseContext value={value}>{children}</GreenhouseContext>;
}

/** Reads the colors and the gas-level store of the surrounding lab. */
function useGreenhouse() {
  const greenhouse = use(GreenhouseContext);
  if (!greenhouse) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("useGreenhouse must be used within GreenhouseProvider");
  }
  return greenhouse;
}

/** Reads the gas level the slider of the surrounding lab sets. */
function useGreenhouseGasLevel() {
  return useStore(useGreenhouse().store, (state) => state.gasLevel);
}

interface GreenhouseEffectLabProps {
  description: ReactNode;
  labels: {
    gasControl: string;
    heatFlow: ReactNode;
    heatFlowLabel: string;
    meaning: ReactNode;
    meaningLabel: string;
    viewLabel: string;
  };
  title: ReactNode;
}

export function GreenhouseEffectLab(props: GreenhouseEffectLabProps) {
  const { description, labels, title } = props;
  const [store] = useState(() => createGasLevelStore(DEFAULT_GAS_LEVEL));
  const gasLevel = useStore(store, (state) => state.gasLevel);
  const setGasLevel = useStore(store, (state) => state.setGasLevel);
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const colors = useMemo(
    () => getBiologySceneColors(resolvedTheme),
    [resolvedTheme]
  );

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
        <ThreeCanvas frameloop="always">
          <Suspense>
            <CameraControls
              cameraPosition={[3, 1.7, 4.05]}
              cameraTarget={[0.1, 0.08, 0]}
              fov={42}
            />
            <ambientLight intensity={0.58} />
            <hemisphereLight
              color={colors.skyLight}
              groundColor={colors.soil}
              intensity={0.72}
            />
            <directionalLight intensity={1.5} position={[-4, 3, 3]} />
            <GreenhouseProvider colors={colors} store={store}>
              <GreenhouseScene />
            </GreenhouseProvider>
          </Suspense>
        </ThreeCanvas>
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

function GreenhouseScene() {
  const { colors } = useGreenhouse();
  const earthRef = useRef<Group>(null);
  const heatRef = useRef<Group>(null);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });

  useFrame((_, delta) => {
    if (calm) {
      return;
    }

    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.12;
    }

    if (heatRef.current) {
      heatRef.current.rotation.y -= delta * 0.18;
    }
  });

  return (
    <group position={[0, 0.02, 0]}>
      <SunLight color={colors.grain} />
      <CameraBounds motion={{ rotation: "y" }} objectRef={earthRef}>
        <EarthModel />
      </CameraBounds>
      <HeatParticles color={colors.heat} refObject={heatRef} />
    </group>
  );
}

function EarthModel() {
  const { colors } = useGreenhouse();
  const gasLevel = useGreenhouseGasLevel();
  const texture = useTexture(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
  texture.colorSpace = SRGBColorSpace;
  const particles = useMemo(() => createGasParticles(gasLevel), [gasLevel]);

  return (
    <group>
      <mesh rotation={[0.1, -1.28, 0]}>
        <sphereGeometry args={[0.94, 96, 48]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.1, 96, 48]} />
        <meshStandardMaterial
          color={colors.ice}
          opacity={0.17 + gasLevel * 0.035}
          transparent
        />
      </mesh>
      {Arr.map(particles, (particle) => (
        <mesh key={particle.id} position={particle.position}>
          <sphereGeometry args={[0.035, 18, 12]} />
          <meshStandardMaterial
            color={colors.carbon}
            emissive={colors.carbon}
            emissiveIntensity={0.08}
          />
        </mesh>
      ))}
    </group>
  );
}

function SunLight({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-2.55, 1.3, 0]}>
        <sphereGeometry args={[0.18, 32, 20]} />
        <meshStandardMaterial color={color} emissive={color} />
      </mesh>
      {Arr.map([-0.22, 0, 0.22], (offset) => (
        <mesh
          key={offset}
          position={[-1.55, 0.94 + offset, 0.12]}
          rotation={[0, 0, Math.PI / 2.9]}
        >
          <cylinderGeometry args={[0.012, 0.012, 1.08, 18]} />
          <meshStandardMaterial color={color} opacity={0.2} transparent />
        </mesh>
      ))}
    </group>
  );
}

function HeatParticles({
  color,
  refObject,
}: {
  color: string;
  refObject: RefObject<Group | null>;
}) {
  const gasLevel = useGreenhouseGasLevel();
  const particleCount = 4 + gasLevel * 2;

  return (
    <CameraBounds motion={{ rotation: "y" }} objectRef={refObject}>
      {Arr.map(Arr.take(HEAT_PARTICLE_IDS, particleCount), (id, index) => (
        <mesh key={id} position={getHeatParticlePosition(index, particleCount)}>
          <sphereGeometry args={[0.026, 18, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.38}
            opacity={0.42}
            transparent
          />
        </mesh>
      ))}
    </CameraBounds>
  );
}

function getHeatParticlePosition(index: number, total: number) {
  const angle = (index / total) * Math.PI * 1.35 - Math.PI * 0.18;
  const radius = 1.02 + (index % 3) * 0.06;

  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.9,
    0.56 + (index % 2) * 0.08,
  ] as const;
}

function createGasParticles(level: number) {
  return Array.from({ length: 8 + level * 4 }, (_, index) => {
    const y = 1 - (index / Math.max(1, 7 + level * 4)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = 1.16;

    return {
      id: `gas-${index}`,
      position: [
        Math.cos(angle) * ringRadius * radius,
        y * radius,
        Math.sin(angle) * ringRadius * radius,
      ] as const,
    };
  });
}

useTexture.preload(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
