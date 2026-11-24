import type {
  GardenPlant,
  MatchMode,
  NameStyle,
} from "@repo/design-system/components/contents/biology/binomial/model";
import {
  botanicalOf,
  matchingPlants,
} from "@repo/design-system/components/contents/biology/binomial/model";
import { GardenNameScene } from "@repo/design-system/components/contents/biology/binomial/scene";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const STYLES = ["printed", "handwritten"] as const;
const MATCHES = ["genus", "epithet"] as const;

export function GardenNameLab({
  description,
  labels,
  plants,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly epithet: ReactNode;
    readonly family: ReactNode;
    readonly genus: ReactNode;
    readonly match: string;
    readonly matches: Readonly<Record<MatchMode, string>>;
    readonly plant: string;
    readonly plants: Readonly<Partial<Record<GardenPlant, string>>>;
    readonly style: string;
    readonly styles: Readonly<Record<NameStyle, string>>;
    readonly view: string;
  };
  readonly plants: readonly [GardenPlant, ...GardenPlant[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<GardenPlant>(plants[0]);
  const [style, setStyle] = useState<NameStyle>("printed");
  const [matchMode, setMatchMode] = useState<MatchMode>("genus");
  const spec = botanicalOf(selected);
  const matched = matchingPlants(plants, selected, matchMode);
  const plantOptions = Arr.map(plants, (plant) => ({
    label: labels.plants[plant] ?? plant,
    value: plant,
  }));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(plants[0]);
          setStyle("printed");
          setMatchMode("genus");
        }}
      />

      <VisualCardToolbar>
        {plants.length > 1 ? (
          <Select
            items={plantOptions}
            onValueChange={(next: GardenPlant | null) => {
              if (next !== null) {
                setSelected(next);
              }
            }}
            value={selected}
          >
            <SelectTrigger aria-label={labels.plant} className="w-full">
              <SelectValue
                labels={Arr.map(plantOptions, (item) => item.label)}
                placeholder={labels.plant}
              />
            </SelectTrigger>
            <SelectContent label={labels.plant}>
              {Arr.map(plantOptions, (item) => (
                <SelectItem key={item.value} plain value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <ToggleGroup
          aria-label={labels.style}
          gridColumns="2"
          onValueChange={(next: string) => {
            if (next === "printed" || next === "handwritten") {
              setStyle(next);
            }
          }}
          type="single"
          value={style}
          variant="outline"
        >
          {Arr.map(STYLES, (entry) => (
            <ToggleGroupItem key={entry} value={entry}>
              {labels.styles[entry]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ToggleGroup
          aria-label={labels.match}
          gridColumns="2"
          onValueChange={(next: string) => {
            if (next === "genus" || next === "epithet") {
              setMatchMode(next);
            }
          }}
          type="single"
          value={matchMode}
          variant="outline"
        >
          {Arr.map(MATCHES, (entry) => (
            <ToggleGroupItem key={entry} value={entry}>
              {labels.matches[entry]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="soil" reach={3.2} setting="field">
          <Suspense fallback={null}>
            <GardenNameScene
              matched={matched}
              matchMode={matchMode}
              onSelect={setSelected}
              plantNames={labels.plants}
              plants={plants}
              selected={selected}
              style={style}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              matchMode === "genus"
                ? CLASSIFICATION_COLORS.matchGenus
                : undefined
            }
            label={labels.genus}
            value={
              style === "handwritten" ? (
                <span className="underline underline-offset-2">
                  {spec.genus}
                </span>
              ) : (
                <em>{spec.genus}</em>
              )
            }
          />
          <VisualFactIndicator
            indicatorColor={
              matchMode === "epithet"
                ? CLASSIFICATION_COLORS.matchEpithet
                : undefined
            }
            label={labels.epithet}
            value={
              style === "handwritten" ? (
                <span className="underline underline-offset-2">
                  {spec.epithet}
                </span>
              ) : (
                <em>{spec.epithet}</em>
              )
            }
          />
          <VisualFact label={labels.family} value={spec.family} />
          <VisualFact
            label={labels.match}
            value={Arr.join(
              Arr.map(matched, (plant) => labels.plants[plant] ?? plant),
              ", "
            )}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
