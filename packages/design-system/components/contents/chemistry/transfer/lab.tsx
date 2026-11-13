import { useFrame, useThree } from "@react-three/fiber";
import { getAtomSceneColors } from "@repo/design-system/components/contents/chemistry/color";
import { toggleColumns } from "@repo/design-system/components/contents/chemistry/columns";
import { ELEMENTS } from "@repo/design-system/components/contents/chemistry/molecule/elements";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import {
  getPair,
  type IonAtom,
  ionTex,
  type PairId,
  PairIdSchema,
  shellsAfterGain,
  shellsAfterLoss,
  shellsTex,
} from "@repo/design-system/components/contents/chemistry/transfer/ions";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr, Option, Schema } from "effect";
import {
  createRef,
  type ReactNode,
  Suspense,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Mesh } from "three";
import { useFormatter } from "use-intl";

/** How many picometres one scene unit spans. */
const PICOMETRES = 100;

/** How far each atom stands from the middle, in scene units. */
const APART = 2.6;

/** How long one transfer takes while the card plays, in seconds. */
const CYCLE = 5;

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
  readonly description: ReactNode;
  readonly labels: TransferLabels;
  readonly pairs: readonly PairId[];
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const offered = Arr.filter(pairs, (id) => Schema.is(PairIdSchema)(id));
  const [chosen, setChosen] = useState<PairId | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const shown = Arr.findFirst(offered, (id) => id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const pair = getPair(shown);
  const number = (value: number) =>
    mathNumber(format.number(value, MATH_NUMBER_OPTIONS));
  const metalAfter = shellsAfterLoss(pair.metal.shells, pair.electrons);
  const nonmetalAfter = shellsAfterGain(pair.nonmetal.shells, pair.electrons);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          {offered.length > 1 ? (
            <ToggleGroup
              aria-label={labels.choose}
              gridColumns={toggleColumns(offered.length)}
              onValueChange={(value: string) => {
                if (Schema.is(PairIdSchema)(value)) {
                  setChosen(value);
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
          <span className="text-sm">{labels.progress}</span>
          <HandSlider
            label={labels.progress}
            max={1}
            onChange={setProgress}
            step={0.01}
            value={progress}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={APART + 2.4} setting="studio">
          <Suspense>
            <TransferCamera />
            <TransferScene key={shown} pairId={shown} progress={progress} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.metalShells}
            value={
              <StateChange
                after={`${ionTex(pair.metal.symbol, pair.electrons)}\\ ${shellsTex(metalAfter)}`}
                before={`\\mathrm{${pair.metal.symbol}}\\ ${shellsTex(pair.metal.shells)}`}
              />
            }
          />
          <VisualFact
            label={labels.nonmetalShells}
            value={
              <StateChange
                after={`${ionTex(pair.nonmetal.symbol, -pair.electrons)}\\ ${shellsTex(nonmetalAfter)}`}
                before={`\\mathrm{${pair.nonmetal.symbol}}\\ ${shellsTex(pair.nonmetal.shells)}`}
              />
            }
          />
          <VisualFact
            label={labels.metalRadius}
            value={
              <StateChange
                after={`${number(pair.metal.ionic)}\\ \\mathrm{pm}`}
                before={`${number(pair.metal.atomic)}\\ \\mathrm{pm}`}
              />
            }
          />
          <VisualFact
            label={labels.nonmetalRadius}
            value={
              <StateChange
                after={`${number(pair.nonmetal.ionic)}\\ \\mathrm{pm}`}
                before={`${number(pair.nonmetal.atomic)}\\ \\mathrm{pm}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * A reading that changes, its state before on one line and after on the
 * next, so neither state breaks across a line on a narrow card.
 */
function StateChange({
  after,
  before,
}: {
  readonly after: string;
  readonly before: string;
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <InlineMath math={before} />
      <InlineMath math={`\\rightarrow ${after}`} />
    </span>
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
  pairId,
  progress,
}: {
  readonly pairId: PairId;
  readonly progress: number;
}) {
  const pair = getPair(pairId);
  const playing = useVisualScene((card) => card.playing, false);
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const colors = getAtomSceneColors(resolvedTheme);
  const metalSphere = useRef<Mesh>(null);
  const nonmetalSphere = useRef<Mesh>(null);
  const movers = useMemo(
    () =>
      Arr.map(Arr.range(1, pair.electrons), (number) => ({
        number,
        ref: createRef<Mesh>(),
      })),
    [pair.electrons]
  );
  const [ions, setIons] = useState(false);
  const metalOuter = shellRadius(pair.metal, pair.metal.shells.length);
  const nonmetalOuter = shellRadius(pair.nonmetal, pair.nonmetal.shells.length);

  useFrame((state) => {
    const share = playing
      ? smooth(((state.clock.elapsedTime % CYCLE) / CYCLE) * 1.3 - 0.15)
      : progress;
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
    <group>
      <AtomShells atom={pair.metal} keep={pair.electrons} x={-APART} />
      <AtomShells atom={pair.nonmetal} keep={0} x={APART} />
      <mesh position={[-APART, 0, 0]} ref={metalSphere}>
        <sphereGeometry args={[1, 64, 48]} />
        <GlassMaterial
          color={ELEMENTS[pair.metal.symbol].color}
          opacity={0.16}
        />
      </mesh>
      <mesh position={[APART, 0, 0]} ref={nonmetalSphere}>
        <sphereGeometry args={[1, 64, 48]} />
        <GlassMaterial
          color={ELEMENTS[pair.nonmetal.symbol].color}
          opacity={0.16}
        />
      </mesh>
      {Arr.map(movers, (mover) => (
        <mesh key={`mover-${mover.number}`} ref={mover.ref}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial
            color={getColor("SLATE", 50)}
            emissive={getColor("SLATE", 200)}
            emissiveIntensity={2.4}
          />
        </mesh>
      ))}
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        position={[-APART, -2.3, 0]}
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
        color={colors.text}
        fontSize="compact"
        position={[APART, -2.3, 0]}
      >
        <InlineMath
          math={
            ions
              ? ionTex(pair.nonmetal.symbol, -pair.electrons)
              : `\\mathrm{${pair.nonmetal.symbol}}`
          }
        />
      </ThreeLabel>
    </group>
  );
}

/** The radius of shell `index` (1 for K) drawn inside an atom, spread evenly to its edge. */
function shellRadius(atom: IonAtom, index: number) {
  return ((atom.atomic / PICOMETRES) * 0.82 * index) / atom.shells.length;
}

/**
 * The nucleus and shells of one atom, each shell a thin ring with its
 * electrons spaced around it; the outer shell leaves out the `keep` electrons
 * that cross to the other atom, which are drawn on their own.
 */
function AtomShells({
  atom,
  keep,
  x,
}: {
  readonly atom: IonAtom;
  readonly keep: number;
  readonly x: number;
}) {
  const shells = Arr.map(atom.shells, (count, index) => ({
    count: index === atom.shells.length - 1 ? count - keep : count,
    radius: shellRadius(atom, index + 1),
    shell: index + 1,
  }));

  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.1, 24, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={ELEMENTS[atom.symbol].color}
          roughness={0.3}
        />
      </mesh>
      {Arr.map(shells, (shell) => (
        <group key={shell.shell}>
          <mesh>
            <torusGeometry args={[shell.radius, 0.008, 8, 128]} />
            <meshStandardMaterial color={getColor("SLATE", 400)} />
          </mesh>
          {Arr.map(
            shell.count > 0 ? Arr.range(1, shell.count) : [],
            (electron) => {
              const angle =
                (2 * Math.PI * electron) / shell.count + shell.shell;
              return (
                <mesh
                  key={electron}
                  position={[
                    shell.radius * Math.cos(angle),
                    shell.radius * Math.sin(angle),
                    0,
                  ]}
                >
                  <sphereGeometry args={[0.055, 14, 10]} />
                  <meshStandardMaterial
                    color={getColor("SLATE", 50)}
                    emissive={getColor("SLATE", 200)}
                    emissiveIntensity={1.2}
                  />
                </mesh>
              );
            }
          )}
        </group>
      ))}
    </group>
  );
}

/** Faces both atoms from the front, farther back on a narrow card. */
function TransferCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 15 : 11;
  return (
    <CameraControls
      cameraPosition={[0, distance * 0.15, distance]}
      cameraTarget={[0, -0.2, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={3}
    />
  );
}
