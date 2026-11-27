import { useFrame } from "@react-three/fiber";
import { MathLines } from "@repo/design-system/components/contents/chemistry/lines";
import { ELEMENTS } from "@repo/design-system/components/contents/chemistry/molecule/elements";
import type {
  IonAtom,
  PairId,
} from "@repo/design-system/components/contents/chemistry/transfer/ions";
import {
  getPair,
  ionTex,
  PairIdSchema,
  shellsAfterGain,
  shellsAfterLoss,
  shellsTex,
} from "@repo/design-system/components/contents/chemistry/transfer/ions";
import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import {
  useCycleClock,
  useInvalidateOnChange,
} from "@repo/design-system/components/contents/simulation/clock";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { BohrShells } from "@repo/design-system/components/three/atom/bohr";
import { AtomNucleus } from "@repo/design-system/components/three/atom/core";
import { neutronsOf } from "@repo/design-system/components/three/atom/isotope";
import { Spark } from "@repo/design-system/components/three/atom/light";
import { orbitsOf } from "@repo/design-system/components/three/atom/shell";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { getColor } from "@repo/design-system/lib/color";
import { PARTICLE_COLORS } from "@repo/design-system/lib/material/particle";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode, RefObject } from "react";
import { createRef, useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { useFormatter } from "use-intl";

/** How many picometres one scene unit spans. */
const PICOMETRES = 100;

/** How far each atom stands from the middle, in scene units. */
const APART = 2.6;

/** How long one transfer takes while the card plays, in seconds. */
const CYCLE = 5;

/** The radius of one nucleon, small enough that potassium's nucleus sits well inside its K shell. */
const NUCLEON = 0.026;

/** How wide the glow of an electron on its way across is drawn, in scene units. */
const SPARK = 0.5;

/**
 * The share of each atom's radius the camera's box takes in: the camera
 * fits the ball about its box, which reaches past the atoms' round edges,
 * so a smaller box lets the pair fill the card.
 */
const FIT = 0.9;

/** How far below the larger atom the two symbols are written, in scene units. */
const LABEL_DROP = 0.3;

/** The dark of open space behind the atoms, which outlines their labels, and how wide that outline is. */
const BACKDROP = getColor("ZINC", 950);
const OUTLINE = 0.012;

/** The words an ion formation lab reads from its lesson. */
interface TransferLabels {
  /** The name of the toggle that chooses a pair, for assistive technology. */
  readonly choose: string;
  /** The readout of the metal's radius before and after. */
  readonly metalRadius: ReactNode;
  /** The readout of the metal's shells before and after. */
  readonly metalShells: ReactNode;
  /** The readout of the nonmetal's radius before and after. */
  readonly nonmetalRadius: ReactNode;
  /** The readout of the nonmetal's shells before and after. */
  readonly nonmetalShells: ReactNode;
  /** The name of the slider that moves the electrons. */
  readonly progress: string;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * Two atoms become two ions: the metal's outer electrons cross to the
 * nonmetal's outer shell. As they cross, each atom's glass sphere eases from
 * its atomic radius to its ionic radius, at real scale, so the metal visibly
 * shrinks and the nonmetal swells, and each shows its new charge.
 *
 * @param pairs - The metal and nonmetal pairs to offer, in order
 */
export function IonFormationLab({
  description,
  labels,
  pairs,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: TransferLabels;
  readonly pairs: readonly PairId[];
  readonly title: NonNullable<ReactNode>;
}) {
  const format = useFormatter();
  const offered = Arr.filter(pairs, (id) => Schema.is(PairIdSchema)(id));
  const [chosen, setChosen] = useState<PairId | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const quantity = useQuantity();
  const shown = Arr.findFirst(offered, (id) => id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const pair = getPair(shown);
  const number = (value: number) => mathNumber(format.number(value, "math"));
  const metalAfter = shellsAfterLoss(pair.metal.shells, pair.electrons);
  const nonmetalAfter = shellsAfterGain(pair.nonmetal.shells, pair.electrons);

  return (
    <VisualCard
      onReset={() => {
        setChosen(undefined);
        setProgress(0);
      }}
    >
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {offered.length > 1 ? (
          <ToggleGroup
            aria-label={labels.choose}
            gridColumns={toggleColumns(offered.length)}
            onValueChange={(value: string) => {
              if (Schema.is(PairIdSchema)(value)) {
                setChosen(value);
                setProgress(0);
              }
            }}
            type="single"
            value={shown}
            variant="outline"
          >
            {Arr.map(offered, (id) => (
              <ToggleGroupItem
                aria-label={`${getPair(id).metal.symbol} ${getPair(id).nonmetal.symbol}`}
                key={id}
                value={id}
              >
                <InlineMath
                  math={`\\mathrm{${getPair(id).metal.symbol}} + \\mathrm{${getPair(id).nonmetal.symbol}}`}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <VisualSlider
          heading={labels.progress}
          label={labels.progress}
          max={1}
          min={0}
          onValueChange={setProgress}
          pauseOnChange
          readout={<InlineMath math={quantity(progress * 100, "\\%", 0)} />}
          step={0.01}
          value={progress}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={APART + 2.4} setting="space">
          <TransferCamera />
          <TransferScene
            onProgress={setProgress}
            pairId={shown}
            progress={progress}
          />
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.metalShells}
            value={
              <MathLines
                lines={[
                  `\\mathrm{${pair.metal.symbol}}\\ ${shellsTex(pair.metal.shells)}`,
                  `\\rightarrow ${ionTex(pair.metal.symbol, pair.electrons)}\\ ${shellsTex(metalAfter)}`,
                ]}
              />
            }
          />
          <VisualFact
            label={labels.nonmetalShells}
            value={
              <MathLines
                lines={[
                  `\\mathrm{${pair.nonmetal.symbol}}\\ ${shellsTex(pair.nonmetal.shells)}`,
                  `\\rightarrow ${ionTex(pair.nonmetal.symbol, -pair.electrons)}\\ ${shellsTex(nonmetalAfter)}`,
                ]}
              />
            }
          />
          <VisualFact
            label={labels.metalRadius}
            value={
              <MathLines
                lines={[
                  `${number(pair.metal.atomic)}\\ \\mathrm{pm}`,
                  `\\rightarrow ${number(pair.metal.ionic)}\\ \\mathrm{pm}`,
                ]}
              />
            }
          />
          <VisualFact
            label={labels.nonmetalRadius}
            value={
              <MathLines
                lines={[
                  `${number(pair.nonmetal.atomic)}\\ \\mathrm{pm}`,
                  `\\rightarrow ${number(pair.nonmetal.ionic)}\\ \\mathrm{pm}`,
                ]}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Eases a share in and out. */
function smooth(share: number) {
  const clamped = Math.min(1, Math.max(0, share));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * The two atoms, their shells and electrons, the crossing electrons, and the
 * glass spheres that size each atom. While the card plays the transfer runs
 * by itself; paused, the slider sets it.
 */
function TransferScene({
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
  const metalSphere = useRef<Mesh>(null);
  const nonmetalSphere = useRef<Mesh>(null);
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
  const [ions, setIons] = useState(false);
  const metalReach = Math.max(pair.metal.atomic, pair.metal.ionic) / PICOMETRES;
  const nonmetalReach =
    Math.max(pair.nonmetal.atomic, pair.nonmetal.ionic) / PICOMETRES;
  const tallest = Math.max(metalReach, nonmetalReach);
  const metalOuter = shellRadius(pair.metal, pair.metal.shells.length);
  const nonmetalOuter = shellRadius(pair.nonmetal, pair.nonmetal.shells.length);

  useFrame(() => {
    const share = smooth(clock.current);
    time.current = clock.current * CYCLE;
    const metalRadius =
      (pair.metal.atomic + (pair.metal.ionic - pair.metal.atomic) * share) /
      PICOMETRES;
    const nonmetalRadius =
      (pair.nonmetal.atomic +
        (pair.nonmetal.ionic - pair.nonmetal.atomic) * share) /
      PICOMETRES;
    metalSphere.current?.scale.setScalar(metalRadius);
    nonmetalSphere.current?.scale.setScalar(nonmetalRadius);
    for (const { number, ref } of movers) {
      const angle = 0.6 + (number - 1) * Math.PI;
      const fromX = -APART + metalOuter * Math.cos(angle);
      const fromY = metalOuter * Math.sin(angle);
      const toX = APART + nonmetalOuter * Math.cos(angle + Math.PI * 0.8);
      const toY = nonmetalOuter * Math.sin(angle + Math.PI * 0.8);
      ref.current?.position.set(
        fromX + (toX - fromX) * share,
        fromY + (toY - fromY) * share + Math.sin(Math.PI * share) * 0.9,
        Math.sin(Math.PI * share) * 0.6
      );
    }
    if (share > 0.95 !== ions) {
      setIons(share > 0.95);
    }
  });

  return (
    <CameraBounds
      bounds={{
        x: {
          min: -APART - metalReach * FIT,
          max: APART + nonmetalReach * FIT,
        },
        y: { min: -tallest * FIT, max: tallest * FIT },
        z: { min: -0.1, max: 0.1 },
      }}
    >
      <AtomShells
        atom={pair.metal}
        clock={time}
        keep={pair.electrons}
        x={-APART}
      />
      <AtomShells atom={pair.nonmetal} clock={time} keep={0} x={APART} />
      <mesh position={[-APART, 0, 0]} ref={metalSphere}>
        <sphereGeometry args={[1, 64, 48]} />
        <GlassMaterial
          color={ELEMENTS[pair.metal.symbol].color}
          opacity={0.07}
        />
      </mesh>
      <mesh position={[APART, 0, 0]} ref={nonmetalSphere}>
        <sphereGeometry args={[1, 64, 48]} />
        <GlassMaterial
          color={ELEMENTS[pair.nonmetal.symbol].color}
          opacity={0.07}
        />
      </mesh>
      {Arr.map(movers, (mover) => (
        <group key={`mover-${mover.number}`} ref={mover.ref}>
          <Spark color={PARTICLE_COLORS.valence} size={SPARK} />
        </group>
      ))}
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="reading"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[-APART, -tallest - LABEL_DROP, 0]}
      >
        <InlineMath
          math={
            ions
              ? ionTex(pair.metal.symbol, pair.electrons)
              : `\\mathrm{${pair.metal.symbol}}`
          }
        />
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="reading"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[APART, -tallest - LABEL_DROP, 0]}
      >
        <InlineMath
          math={
            ions
              ? ionTex(pair.nonmetal.symbol, -pair.electrons)
              : `\\mathrm{${pair.nonmetal.symbol}}`
          }
        />
      </ThreeLabel>
    </CameraBounds>
  );
}

/** The radius of shell `index` (1 for K) drawn inside an atom, spread evenly to its edge. */
function shellRadius(atom: IonAtom, index: number) {
  return ((atom.atomic / PICOMETRES) * 0.82 * index) / atom.shells.length;
}

/**
 * One atom as Bohr drew it, facing the reader: its nucleus of protons and
 * neutrons and its electrons on luminous shells, the valence shell warm.
 * The outer shell leaves out the `keep` electrons that cross to the other
 * atom, which are drawn on their own.
 */
function AtomShells({
  atom,
  clock,
  keep,
  x,
}: {
  readonly atom: IonAtom;
  readonly clock: RefObject<number>;
  readonly keep: number;
  readonly x: number;
}) {
  const step = shellRadius(atom, 1);
  const orbits = useMemo(
    () =>
      orbitsOf(
        Arr.map(atom.shells, (count, index) =>
          index === atom.shells.length - 1 ? count - keep : count
        ),
        step,
        step
      ),
    [atom.shells, keep, step]
  );
  const protons = Arr.reduce(atom.shells, 0, (sum, count) => sum + count);

  return (
    <group position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <AtomNucleus
        neutrons={neutronsOf(protons)}
        nucleon={NUCLEON}
        protons={protons}
      />
      <BohrShells
        clock={clock}
        orbits={orbits}
        valence={atom.shells.length - 1}
      />
    </group>
  );
}

/** Faces both atoms from the front and frames the pair, whatever the card's shape. */
function TransferCamera() {
  return (
    <CameraControls
      cameraPosition={[0, 1.6, 11]}
      cameraTarget={[0, -0.2, 0]}
      fov={40}
      framing="content"
    />
  );
}
