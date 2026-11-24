import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  VertebraPart,
  VertebraRegion,
} from "@repo/design-system/components/contents/biology/vertebra/model";
import { vertebraSpecOf } from "@repo/design-system/components/contents/biology/vertebra/model";
import { VertebraScene } from "@repo/design-system/components/contents/biology/vertebra/scene";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function VertebraLab({
  description,
  labels,
  regions,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly count: ReactNode;
    readonly fused: ReactNode;
    readonly job: ReactNode;
    readonly no: ReactNode;
    readonly parts: Readonly<Record<VertebraPart, string>>;
    readonly region: string;
    readonly regions: Readonly<
      Partial<
        Record<
          VertebraRegion,
          { readonly job: ReactNode; readonly name: string }
        >
      >
    >;
    readonly view: string;
    readonly yes: ReactNode;
  };
  readonly regions: readonly [VertebraRegion, ...VertebraRegion[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [region, setRegion] = useState<VertebraRegion>(regions[0]);
  const spec = vertebraSpecOf(region);
  const entry = labels.regions[region];
  const options = Arr.map(regions, (item) => ({
    label: labels.regions[item]?.name ?? item,
    value: item,
  }));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset onReset={() => setRegion(regions[0])} />

      <VisualCardToolbar>
        {regions.length > 4 ? (
          <Select
            items={options}
            onValueChange={(next: VertebraRegion | null) => {
              if (next !== null) {
                setRegion(next);
              }
            }}
            value={region}
          >
            <SelectTrigger aria-label={labels.region} className="w-full">
              <SelectValue
                labels={Arr.map(options, (item) => item.label)}
                placeholder={labels.region}
              />
            </SelectTrigger>
            <SelectContent label={labels.region}>
              {Arr.map(options, (item) => (
                <SelectItem key={item.value} plain value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {regions.length > 1 && regions.length <= 4 ? (
          <ToggleGroup
            aria-label={labels.region}
            gridColumns={toggleColumns(regions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(regions, (item) => item === next),
                setRegion
              );
            }}
            type="single"
            value={region}
            variant="outline"
          >
            {Arr.map(regions, (item) => (
              <ToggleGroupItem key={item} value={item}>
                {labels.regions[item]?.name ?? item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="studio">
          <Suspense fallback={null}>
            <VertebraScene parts={labels.parts} region={region} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.count} value={spec.count} />
          <VisualFact
            label={labels.fused}
            value={spec.fused ? labels.yes : labels.no}
          />
          <VisualFact label={labels.job} value={entry?.job ?? region} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
