import { useThree } from "@react-three/fiber";
import {
  balanceTex,
  economyTex,
  equationTex,
  getReaction,
  massBalanceTex,
  moleculeCountTex,
  type ReactionId,
  ReactionIdSchema,
} from "@repo/design-system/components/contents/chemistry/equation/catalog";
import { layoutReaction } from "@repo/design-system/components/contents/chemistry/equation/layout";
import {
  type ReactionLayout,
  ReactionScene,
} from "@repo/design-system/components/contents/chemistry/equation/scene";
import {
  ReactionProvider,
  useReactionState,
} from "@repo/design-system/components/contents/chemistry/equation/store";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisual,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option, Result, Schema } from "effect";
import { type ReactNode, Suspense, useState } from "react";
import { useFormatter } from "use-intl";

/** One reaction a lesson offers: its catalog id, toggle face, and spoken name. */
interface ReactionChoice {
  readonly id: ReactionId;
  /** The name of the reaction, for assistive technology. */
  readonly name: string;
  /** What its toggle shows, such as the product's formula. */
  readonly tab: ReactNode;
}

/** The words a reaction lab reads from its lesson. */
interface ReactionLabels {
  /** The readout of the atoms of each element on both sides. */
  readonly atoms: ReactNode;
  /** The name of the toggle that chooses a reaction, for assistive technology. */
  readonly choose: string;
  /** The readout of the atom economy, shown when `reading` is "economy". */
  readonly economy?: ReactNode;
  /** The readout of the balanced equation. */
  readonly equation: ReactNode;
  /** The readout of the masses of both sides. */
  readonly mass: ReactNode;
  /** The readout of the molecules on both sides, shown when `reading` is "molecules". */
  readonly molecules?: ReactNode;
  /** The words under the products. */
  readonly products: ReactNode;
  /** The name of the slider that runs the reaction by hand. */
  readonly progress: string;
  /** The words under the reactants. */
  readonly reactants: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * A reaction lab: the balanced reaction run atom by atom, from the reactant
 * molecules on the left to the product molecules on the right, built from the
 * measured shapes of the molecule lab. The footer reads the equation, the
 * atoms of each element on both sides, the masses of both sides, and either
 * the atom economy of the first product or the molecules on each side.
 *
 * @param reactions - Each reaction to offer, in order
 * @param reading - Which fourth reading the footer shows
 */
export function ReactionBalanceLab(props: {
  readonly description: ReactNode;
  readonly labels: ReactionLabels;
  readonly reactions: readonly ReactionChoice[];
  readonly reading: "economy" | "molecules";
  readonly title: ReactNode;
}) {
  return (
    <ReactionProvider>
      <ReactionCard {...props} />
    </ReactionProvider>
  );
}

function ReactionCard({
  description,
  labels,
  reactions,
  reading,
  title,
}: Parameters<typeof ReactionBalanceLab>[0]) {
  const format = useFormatter();
  const offered = Arr.filter(reactions, (each) =>
    Schema.is(ReactionIdSchema)(each.id)
  );
  const [chosen, setChosen] = useState<ReactionId | undefined>(undefined);
  const entry = Arr.findFirst(offered, (each) => each.id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );
  const layout =
    entry === undefined
      ? undefined
      : Result.getOrUndefined(layoutReaction(getReaction(entry.id)));

  if (entry === undefined || layout === undefined) {
    return null;
  }
  const shown = entry.id;

  const number = (value: number) =>
    mathNumber(
      format.number(value, { ...MATH_NUMBER_OPTIONS, maximumFractionDigits: 1 })
    );

  function choose(value: string) {
    if (Schema.is(ReactionIdSchema)(value)) {
      setChosen(value);
    }
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          {offered.length > 1 ? (
            <ToggleGroup
              aria-label={labels.choose}
              gridColumns={offered.length > 3 ? "4" : "3"}
              onValueChange={choose}
              type="single"
              value={shown}
              variant="outline"
            >
              {Arr.map(offered, (each) => (
                <ToggleGroupItem
                  aria-label={each.name}
                  key={each.id}
                  value={each.id}
                >
                  {each.tab}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          <div className="flex flex-col gap-3">
            <span className="text-sm">{labels.progress}</span>
            <ReactionSlider label={labels.progress} />
          </div>
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={`${labels.view}: ${entry.name}`}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={layout.span / 2 + 1} setting="studio">
          <Suspense>
            <ReactionCamera layout={layout} />
            <ReactionScene
              key={shown}
              layout={layout}
              products={labels.products}
              reactants={labels.reactants}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.equation}
            value={<InlineMath math={equationTex(shown)} />}
          />
          <VisualFact
            label={labels.atoms}
            value={<InlineMath math={balanceTex(shown)} />}
          />
          <VisualFact
            label={labels.mass}
            value={<InlineMath math={massBalanceTex(shown, number)} />}
          />
          {reading === "economy" ? (
            <VisualFact
              label={labels.economy}
              value={Option.match(economyTex(shown, number), {
                onNone: () => null,
                onSome: (tex) => <InlineMath math={tex} />,
              })}
            />
          ) : (
            <VisualFact
              label={labels.molecules}
              value={<InlineMath math={moleculeCountTex(shown)} />}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Runs the reaction by hand. Taking the slider stops the card playing, so the
 * reader's hand, not the clock, moves the atoms.
 */
function ReactionSlider({ label }: { readonly label: string }) {
  const progress = useReactionState((state) => state.progress);
  const setProgress = useReactionState((state) => state.setProgress);
  const { playing, togglePlaying } = useVisual((state) => ({
    playing: state.playing,
    togglePlaying: state.togglePlaying,
  }));

  return (
    <Slider
      aria-label={label}
      max={1}
      min={0}
      onValueChange={(value: number) => {
        if (playing) {
          togglePlaying();
        }
        setProgress(value);
      }}
      step={0.01}
      value={Math.min(1, progress)}
    />
  );
}

/**
 * Frames both sides of the reaction from a little above, wide enough for the
 * whole run: farther back on a narrow card, where the width runs out first.
 */
function ReactionCamera({ layout }: { readonly layout: ReactionLayout }) {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = Math.max(5, layout.span * (narrow ? 1.5 : 1.02));
  return (
    <CameraControls
      cameraPosition={[0, distance * 0.22, distance]}
      cameraTarget={[0, -0.3, 0]}
      fov={40}
      maxDistance={distance * 2}
      minDistance={2.5}
    />
  );
}
