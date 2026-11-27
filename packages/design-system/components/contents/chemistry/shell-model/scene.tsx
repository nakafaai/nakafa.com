import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
import { useShellModel } from "@repo/design-system/components/contents/chemistry/shell-model/context";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { BohrShells } from "@repo/design-system/components/three/atom/bohr";
import { AtomNucleus } from "@repo/design-system/components/three/atom/core";
import { neutronsOf } from "@repo/design-system/components/three/atom/isotope";
import { orbitsOf } from "@repo/design-system/components/three/atom/shell";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { getColor } from "@repo/design-system/lib/color";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr, Option } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** The radius of the K shell's orbit and the gap between two shells, in scene units. */
const INNER = 0.94;
const GAP = 0.64;

/** The radius of one nucleon, so calcium's forty fill the middle of the K shell. */
const NUCLEON = 0.078;

/**
 * The half side of the square the camera frames, as a share of the
 * outermost orbit's radius: the camera fits a box by its corners, and the
 * corners of this square lie just outside the round orbit, so the orbit
 * itself fills the card.
 */
const SQUARE = 0.88;

/** The dark of open space behind the atom, which outlines its labels, and how wide that outline is. */
const BACKDROP = getColor("ZINC", 950);
const OUTLINE = 0.012;

/** How far the electrons' light reaches past their orbit, which the camera must keep in frame. */
const MARGIN = 0.2;

/**
 * A neutral atom as Bohr drew it: the nucleus of its most abundant isotope,
 * every proton and neutron packed at the middle, and its electrons riding
 * luminous shells, the valence shell and its electrons glowing warm. The
 * electrons go round while the card plays and stand still for a reader who
 * asked for less motion.
 */
export function ShellModelScene() {
  const { outerShellKey, sample, shells } = useShellModel();
  const { advance, playing } = useSimulationClock(0);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const clock = useRef(0);
  const nucleus = useRef<Group>(null);
  const orbits = useMemo(
    () =>
      orbitsOf(
        Arr.map(shells, (shell) => shell.electronCount),
        INNER,
        GAP
      ),
    [shells]
  );
  const valence = Option.getOrElse(
    Arr.findFirstIndex(shells, (shell) => shell.key === outerShellKey),
    () => -1
  );
  const reach = INNER + GAP * Math.max(0, shells.length - 1) + MARGIN;

  useFrame((_, delta) => {
    const time = calm ? 0 : advance(delta);
    clock.current = time;
    if (nucleus.current !== null) {
      nucleus.current.rotation.y = time * 0.35;
      nucleus.current.rotation.x = Math.sin(time * 0.5) * 0.12;
    }
  });

  return (
    <group rotation={[-0.28, 0, 0]} scale={1.12}>
      <SimulationTicker running={playing && !calm} />
      <CameraBounds
        bounds={{
          x: { min: -reach * SQUARE, max: reach * SQUARE },
          y: { min: -MARGIN, max: MARGIN },
          z: { min: -reach * SQUARE, max: reach * SQUARE },
        }}
      >
        <group />
      </CameraBounds>
      <CameraBounds exclude>
        <group ref={nucleus}>
          <AtomNucleus
            neutrons={neutronsOf(sample.atomicNumber)}
            nucleon={NUCLEON}
            protons={sample.atomicNumber}
          />
        </group>
        <BohrShells clock={clock} orbits={orbits} valence={valence} />
      </CameraBounds>
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="reading"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[0, 0.2, -0.52]}
      >
        <InlineMath
          math={`\\vphantom{X}_{${sample.atomicNumber}}\\mathrm{${sample.symbol}}`}
        />
      </ThreeLabel>
      {Arr.map(shells, (shell, index) => (
        <ThreeLabel
          color={QUANTUM_COLORS.spaceLabel}
          fontSize="reading"
          key={shell.key}
          outlineColor={BACKDROP}
          outlineWidth={OUTLINE}
          position={[INNER + GAP * index + 0.2, 0.14, 0.12]}
        >
          <InlineMath math={`\\mathrm{${shell.key}}`} />
        </ThreeLabel>
      ))}
    </group>
  );
}
