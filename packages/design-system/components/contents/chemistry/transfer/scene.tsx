import { useFrame } from "@react-three/fiber";
import type {
  IonAtom,
  PairId,
} from "@repo/design-system/components/contents/chemistry/transfer/ions";
import {
  getPair,
  ionTex,
  shellsAfterGain,
  shellsAfterLoss,
} from "@repo/design-system/components/contents/chemistry/transfer/ions";
import {
  useCycleClock,
  useInvalidateOnChange,
} from "@repo/design-system/components/contents/simulation/clock";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { BohrShells } from "@repo/design-system/components/three/atom/bohr";
import { AtomNucleus } from "@repo/design-system/components/three/atom/core";
import { neutronsOf } from "@repo/design-system/components/three/atom/isotope";
import { Spark } from "@repo/design-system/components/three/atom/light";
import { orbitsOf } from "@repo/design-system/components/three/atom/shell";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { getColor } from "@repo/design-system/lib/color";
import { PARTICLE_COLORS } from "@repo/design-system/lib/material/particle";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import type { ReactNode, RefObject } from "react";
import { createRef, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** How many picometres one scene unit spans. */
const PICOMETRES = 100;

/** The room kept between the outer shells of the two atoms, in scene units. */
const ROOM = 0.34;

/** The share of an atom's radius its outermost occupied shell is drawn at. */
const EDGE = 0.82;

/**
 * The way a crossing electron takes: the angle off the line between the
 * atoms at which it leaves the metal's outer shell and at which it lands
 * on the nonmetal's, in radians, how far its arc bows away from the
 * straight way across and how far it comes toward the reader, in scene
 * units. The first electron bows above the line and the second below, so
 * neither crosses an atom.
 */
const LEAVE = 0.6;
const LAND = 0.7;
const RISE = 0.45;
const NEAR = 0.4;

/** The room the two symbols take below the atoms, in scene units, which the camera frames too. */
const LABEL_ROOM = 0.45;

/** The shares of the way across after which the electrons have left the metal's outer shell, and after which the two atoms are ions. */
const LEFT = 0.06;
const DONE = 0.95;

/** How long one transfer takes while the card plays, in seconds. */
const CYCLE = 5;

/** The radius of one nucleon, small enough that potassium's nucleus sits well inside its K shell. */
const NUCLEON = 0.026;

/** How wide the glow of an electron on its way across is drawn, in scene units. */
const SPARK = 0.5;

/**
 * The share of the pair's height the camera's box takes in: the camera
 * fits the ball about its box, which reaches past the atoms' round edges,
 * so a lower box lets the pair fill the card.
 */
const FIT = 0.8;

/** How far below the larger atom the two symbols are written, in scene units. */
const LABEL_DROP = 0.3;

/** The dark of open space behind the atoms, which outlines their labels, and how wide that outline is. */
const BACKDROP = getColor("ZINC", 950);
const OUTLINE = 0.012;

/** Eases a share in and out. */
function smooth(share: number) {
  const clamped = Math.min(1, Math.max(0, share));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * The two atoms, their shells and electrons, and the electrons that cross.
 * The atoms stand side by side with the same room between their outer
 * shells all the way through, so the pair fills the card while one draws in
 * and the other swells. While the card plays the transfer runs by itself;
 * paused, the slider sets it.
 */
export function TransferScene({
  onProgress,
  pairId,
  progress,
}: {
  readonly onProgress: (progress: number) => void;
  readonly pairId: PairId;
  readonly progress: number;
}) {
  const pair = getPair(pairId);
  useInvalidateOnChange(pairId);
  const time = useRef(0);
  const metal = useRef<Group>(null);
  const nonmetal = useRef<Group>(null);
  const metalShells = useRef<Group>(null);
  const nonmetalShells = useRef<Group>(null);
  const movers = useMemo(
    () =>
      Arr.map(Arr.range(1, pair.electrons), (number) => ({
        number,
        ref: createRef<Group>(),
      })),
    [pair.electrons]
  );
  const clock = useCycleClock({
    initial: 0,
    onValue: onProgress,
    rate: 1 / CYCLE,
    steps: 100,
    total: 1,
    value: progress,
  });
  const [phase, setPhase] = useState(0);
  const ions = phase === 2;
  const metalOuter = shellRadius(pair.metal, pair.metal.shells.length);
  const nonmetalOuter = shellRadius(pair.nonmetal, pair.nonmetal.shells.length);
  const metalDrawn = drawnAsIon(pair.metal, pair.metal.shells.length - 1);
  const nonmetalDrawn = drawnAsIon(pair.nonmetal, pair.nonmetal.shells.length);
  const metalEdge = edgeOf(pair.metal.ionic);
  const nonmetalEdge = edgeOf(pair.nonmetal.ionic);
  const tallest = Math.max(metalOuter, nonmetalEdge);
  const widest =
    ROOM / 2 + Math.max(metalOuter + nonmetalOuter, metalEdge + nonmetalEdge);

  useFrame(() => {
    const share = smooth(clock.current);
    time.current = clock.current * CYCLE;
    const metalReach = metalOuter + (metalEdge - metalOuter) * share;
    const nonmetalSize = 1 + (nonmetalDrawn - 1) * share;
    const nonmetalReach = nonmetalOuter * nonmetalSize;
    const half = ROOM / 2 + metalReach + nonmetalReach;
    const metalX = metalReach - half;
    const nonmetalX = half - nonmetalReach;
    metal.current?.position.setX(metalX);
    nonmetal.current?.position.setX(nonmetalX);
    metalShells.current?.scale.setScalar(1 + (metalDrawn - 1) * share);
    nonmetalShells.current?.scale.setScalar(nonmetalSize);
    for (const { number, ref } of movers) {
      const side = number % 2 === 1 ? 1 : -1;
      const fromX = metalX + metalOuter * Math.cos(LEAVE);
      const fromY = metalOuter * Math.sin(LEAVE);
      const toX = nonmetalX - nonmetalReach * Math.cos(LAND);
      const toY = nonmetalReach * Math.sin(LAND);
      ref.current?.position.set(
        fromX + (toX - fromX) * share,
        side *
          (fromY + (toY - fromY) * share + Math.sin(Math.PI * share) * RISE),
        Math.sin(Math.PI * share) * NEAR
      );
    }
    const next = phaseAt(share);
    if (next !== phase) {
      setPhase(next);
    }
  });

  return (
    <CameraBounds
      bounds={{
        x: { min: -widest, max: widest },
        y: { min: -tallest * FIT - LABEL_ROOM, max: tallest * FIT },
        z: { min: -0.1, max: 0.1 },
      }}
    >
      <AtomShells
        atom={pair.metal}
        clock={time}
        counts={
          phase === 0
            ? shellsAfterGain(pair.metal.shells, -pair.electrons)
            : shellsAfterLoss(pair.metal.shells, pair.electrons)
        }
        place={metal}
        shells={metalShells}
      >
        <ThreeLabel
          color={QUANTUM_COLORS.spaceLabel}
          fontSize="reading"
          outlineColor={BACKDROP}
          outlineWidth={OUTLINE}
          position={[0, -tallest - LABEL_DROP, 0]}
        >
          <InlineMath
            math={
              ions
                ? ionTex(pair.metal.symbol, pair.electrons)
                : `\\mathrm{${pair.metal.symbol}}`
            }
          />
        </ThreeLabel>
      </AtomShells>
      <AtomShells
        atom={pair.nonmetal}
        clock={time}
        counts={
          ions
            ? shellsAfterGain(pair.nonmetal.shells, pair.electrons)
            : pair.nonmetal.shells
        }
        place={nonmetal}
        shells={nonmetalShells}
      >
        <ThreeLabel
          color={QUANTUM_COLORS.spaceLabel}
          fontSize="reading"
          outlineColor={BACKDROP}
          outlineWidth={OUTLINE}
          position={[0, -tallest - LABEL_DROP, 0]}
        >
          <InlineMath
            math={
              ions
                ? ionTex(pair.nonmetal.symbol, -pair.electrons)
                : `\\mathrm{${pair.nonmetal.symbol}}`
            }
          />
        </ThreeLabel>
      </AtomShells>
      <group visible={!ions}>
        {Arr.map(movers, (mover) => (
          <group key={`mover-${mover.number}`} ref={mover.ref}>
            <Spark color={PARTICLE_COLORS.valence} size={SPARK} />
          </group>
        ))}
      </group>
    </CameraBounds>
  );
}

/**
 * Where the transfer stands at `share` of the way across: 0 while the
 * electrons are still on the metal's outer shell, 1 once they have left it
 * empty, 2 once both atoms are ions.
 */
function phaseAt(share: number) {
  if (share > DONE) {
    return 2;
  }
  return share > LEFT ? 1 : 0;
}

/** Where the outermost occupied shell of an atom or ion of `radius` picometres is drawn, in scene units. */
function edgeOf(radius: number) {
  return (radius / PICOMETRES) * EDGE;
}

/** The radius of shell `index` (1 for K) drawn inside a neutral atom, spread evenly to its edge. */
function shellRadius(atom: IonAtom, index: number) {
  return (edgeOf(atom.atomic) * index) / atom.shells.length;
}

/**
 * How much the shells of `atom` are scaled once it is an ion whose
 * outermost occupied shell is shell `outer` (1 for K), so that shell
 * stands at the edge of the ion's real radius.
 */
function drawnAsIon(atom: IonAtom, outer: number) {
  return (atom.ionic * atom.shells.length) / (atom.atomic * outer);
}

/**
 * One atom as Bohr drew it, facing the reader: its nucleus of protons and
 * neutrons and `counts` electrons on its luminous shells, the outermost
 * shell warm, with what the lab writes about it as children. The atom
 * hangs on `place` and its shells on `shells`, so the scene can move it
 * and draw its shells in or let them swell while the nucleus keeps its
 * size.
 */
function AtomShells({
  atom,
  children,
  clock,
  counts,
  place,
  shells,
}: {
  readonly atom: IonAtom;
  readonly children: ReactNode;
  readonly clock: RefObject<number>;
  readonly counts: readonly number[];
  readonly place: RefObject<Group | null>;
  readonly shells: RefObject<Group | null>;
}) {
  const step = shellRadius(atom, 1);
  const orbits = useMemo(() => orbitsOf(counts, step, step), [counts, step]);
  const protons = Arr.reduce(atom.shells, 0, (sum, count) => sum + count);

  return (
    <group ref={place}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <AtomNucleus
          neutrons={neutronsOf(protons)}
          nucleon={NUCLEON}
          protons={protons}
        />
        <group ref={shells}>
          <BohrShells
            clock={clock}
            orbits={orbits}
            valence={counts.length - 1}
          />
        </group>
      </group>
      {children}
    </group>
  );
}

/** Faces both atoms from the front and frames the pair, whatever the card's shape. */
export function TransferCamera() {
  return (
    <CameraControls
      cameraPosition={[0, 1.6, 11]}
      cameraTarget={[0, -0.2, 0]}
      fov={40}
      framing="content"
    />
  );
}
