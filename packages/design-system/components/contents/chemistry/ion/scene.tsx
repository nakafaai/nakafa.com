import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
import { getAtomShellReadings } from "@repo/design-system/components/contents/chemistry/atom-shell/readings";
import {
  useInvalidateOnChange,
  useSimulationClock,
} from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { BohrShells } from "@repo/design-system/components/three/atom/bohr";
import { AtomNucleus } from "@repo/design-system/components/three/atom/core";
import { orbitsOf } from "@repo/design-system/components/three/atom/shell";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { getColor } from "@repo/design-system/lib/color";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import type { ReactNode, RefObject } from "react";
import { createContext, use, useMemo, useRef } from "react";

/** How far each particle stands from the middle, in scene units. */
const APART = 1.95;

/** The radius every neutral atom's outermost shell is drawn at, in scene units, which sets where every label stands. */
const WIDEST = 1.34;

/** The radius of the K shell's orbit, as a share of the gap between two shells. */
const INNER = 1.2;

/** How far past the widest atom the words above and below it stand. */
const CLEAR = 0.22;

/** The radius of one nucleon, so sodium's nucleus sits well inside its K shell. */
const NUCLEON = 0.04;

/**
 * The share of the pair's height the camera's box takes in: the camera fits
 * the ball about its box, which reaches past the atoms' round edges, so a
 * lower box lets the pair fill the card. The box keeps the pair's full
 * width, so neither atom ever reaches the card's edge.
 */
const FIT = 0.86;

/** The dark of open space behind the atoms, which outlines their labels, and how wide that outline is. */
const BACKDROP = getColor("ZINC", 950);
const OUTLINE = 0.012;

/** The scene's time in seconds, which both particles' electrons read each frame. */
const Clock = createContext<RefObject<number>>({ current: 0 });

/**
 * A neutral atom and the ion it becomes, side by side in open space, with an
 * arrow from one to the other. The scene owns the camera and the clock: the
 * electrons of both particles go round while the card plays and stand still
 * for a reader who asked for less motion. The lab composes the two
 * particles as its children.
 */
export function IonScene({ children }: { readonly children: ReactNode }) {
  const { advance, playing } = useSimulationClock(0);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current = calm ? 0 : advance(delta);
  });

  return (
    <group>
      <SimulationTicker running={playing && !calm} />
      <CameraControls
        cameraPosition={[0, 0.5, 10]}
        cameraTarget={[0, 0, 0]}
        fov={30}
        framing="content"
      />
      <CameraBounds
        bounds={{
          x: { min: -APART - WIDEST, max: APART + WIDEST },
          y: { min: -WIDEST * FIT, max: WIDEST * FIT },
          z: { min: -0.1, max: 0.1 },
        }}
      >
        <group />
      </CameraBounds>
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="display"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[0, 0, 0]}
      >
        <InlineMath math="\rightarrow" />
      </ThreeLabel>
      <Clock value={clock}>{children}</Clock>
    </group>
  );
}

/** How many electrons each occupied shell holds when `electrons` fill them from the K shell outward. */
function occupiedOf(electrons: number) {
  return Arr.filter(
    Arr.map(
      getAtomShellReadings(electrons).shells,
      (shell) => shell.electronCount
    ),
    (count) => count > 0
  );
}

/**
 * One particle of the pair as Bohr drew it, facing the reader: its nucleus
 * of `protons` and `neutrons` and its `electrons` on their shells, filled 2,
 * 8, 8, 2 from the K shell outward, the outermost occupied shell warm. An
 * ion has the same nucleus as its atom and a different number of electrons.
 * The shells are spaced so the neutral atom of these `protons` always
 * reaches the same width, whichever element it is, and its ion is drawn on
 * the same shells, so a cation that lost its outer shell is visibly smaller.
 * `heading` is written above it and the lab's readings, its children, below.
 * `side` is -1 for the particle on the left and 1 for the one on the right.
 */
export function IonParticle({
  children,
  electrons,
  heading,
  neutrons,
  protons,
  side,
}: {
  readonly children: ReactNode;
  readonly electrons: number;
  readonly heading: ReactNode;
  readonly neutrons: number;
  readonly protons: number;
  readonly side: -1 | 1;
}) {
  useInvalidateOnChange(`${protons}:${electrons}`);
  const clock = use(Clock);
  const orbits = useMemo(() => {
    const gap = WIDEST / (INNER + occupiedOf(protons).length - 1);
    return orbitsOf(occupiedOf(electrons), INNER * gap, gap);
  }, [electrons, protons]);

  return (
    <group position={[side * APART, 0, 0]}>
      <CameraBounds exclude>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <AtomNucleus
            neutrons={neutrons}
            nucleon={NUCLEON}
            protons={protons}
          />
          <BohrShells
            clock={clock}
            orbits={orbits}
            valence={orbits.length - 1}
          />
        </group>
      </CameraBounds>
      <ThreeLabel
        anchorY="bottom"
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="diagram"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[0, WIDEST + CLEAR, 0]}
      >
        {heading}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="diagram"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[0, -WIDEST - CLEAR, 0]}
      >
        {children}
      </ThreeLabel>
    </group>
  );
}
