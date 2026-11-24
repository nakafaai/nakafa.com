import type {
  FeatureCheck,
  FeatureValue,
  KingdomId,
  SpecimenId,
} from "@repo/design-system/components/contents/biology/kingdom/model";
import {
  isPlacementRight,
  KINGDOMS,
  specimenProfileOf,
} from "@repo/design-system/components/contents/biology/kingdom/model";
import { KingdomSortScene } from "@repo/design-system/components/contents/biology/kingdom/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
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
import {
  VisualFact,
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function KingdomSortLab({
  description,
  labels,
  specimens,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly checks: Readonly<Record<FeatureCheck, string>>;
    readonly kingdom?: ReactNode;
    readonly kingdoms: Readonly<Record<KingdomId, string>>;
    readonly place: string;
    readonly right?: ReactNode;
    readonly specimen: string;
    readonly specimens: Readonly<Partial<Record<SpecimenId, ReactNode>>>;
    readonly values: Readonly<Record<FeatureValue, string>>;
    readonly view: string;
    readonly wrong?: ReactNode;
  };
  readonly specimens: readonly [SpecimenId, ...SpecimenId[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [specimen, setSpecimen] = useState<SpecimenId>(specimens[0]);
  const [placements, setPlacements] = useState<
    Readonly<Partial<Record<SpecimenId, KingdomId>>>
  >({});

  const profile = specimenProfileOf(specimen);
  const placed = Option.fromNullishOr(placements[specimen]);
  const showFeedback =
    labels.right !== undefined &&
    labels.wrong !== undefined &&
    labels.kingdom !== undefined;
  const specimenOptions = Arr.map(specimens, (entry) => ({
    label: entry,
    value: entry,
  }));

  function placeInTray(tray: KingdomId) {
    setPlacements((current) => ({ ...current, [specimen]: tray }));
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSpecimen(specimens[0]);
          setPlacements({});
        }}
      />

      <VisualCardToolbar>
        {specimens.length > 1 ? (
          <Select
            items={specimenOptions}
            onValueChange={(next: SpecimenId | null) => {
              if (next !== null) {
                setSpecimen(next);
              }
            }}
            value={specimen}
          >
            <SelectTrigger aria-label={labels.specimen} className="w-full">
              <SelectValue placeholder={labels.specimen}>
                {labels.specimens[specimen] ?? specimen}
              </SelectValue>
            </SelectTrigger>
            <SelectContent label={labels.specimen}>
              {Arr.map(specimens, (entry) => (
                <SelectItem key={entry} plain value={entry}>
                  {labels.specimens[entry] ?? entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <ToggleGroup
          aria-label={labels.place}
          gridColumns="3"
          onValueChange={(next: string) => {
            Option.map(
              Arr.findFirst(KINGDOMS, (entry) => entry === next),
              placeInTray
            );
          }}
          type="single"
          value={Option.getOrElse(placed, () => "")}
          variant="outline"
        >
          {Arr.map(KINGDOMS, (kingdom) => (
            <ToggleGroupItem key={kingdom} value={kingdom}>
              {labels.kingdoms[kingdom]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-0.06} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <KingdomSortScene
              kingdomNames={labels.kingdoms}
              onPlace={placeInTray}
              placed={placed}
              showFeedback={showFeedback}
              specimen={specimen}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.checks.nucleus}
            value={labels.values[profile.nucleus]}
          />
          <VisualFact
            label={labels.checks.cells}
            value={labels.values[profile.cells]}
          />
          <VisualFact
            label={labels.checks.wall}
            value={labels.values[profile.wall]}
          />
          <VisualFact
            label={labels.checks.food}
            value={labels.values[profile.food]}
          />
          {showFeedback && Option.isSome(placed) ? (
            <>
              <VisualFactIndicator
                indicatorColor={
                  isPlacementRight(specimen, placed.value)
                    ? CLASSIFICATION_COLORS.trayCorrect
                    : CLASSIFICATION_COLORS.trayWrong
                }
                label={labels.place}
                value={
                  isPlacementRight(specimen, placed.value)
                    ? labels.right
                    : labels.wrong
                }
              />
              <VisualFact
                label={labels.kingdom}
                value={labels.kingdoms[profile.kingdom]}
              />
            </>
          ) : null}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
