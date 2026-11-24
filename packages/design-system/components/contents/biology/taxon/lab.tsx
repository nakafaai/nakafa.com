import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  TaxonOrganism,
  TaxonRank,
} from "@repo/design-system/components/contents/biology/taxon/model";
import {
  compareTaxons,
  TAXON_RANKS,
} from "@repo/design-system/components/contents/biology/taxon/model";
import { TaxonRankScene } from "@repo/design-system/components/contents/biology/taxon/scene";
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

export function TaxonRankLab({
  description,
  labels,
  organisms,
  pair,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly count: ReactNode;
    readonly first: string;
    readonly none: ReactNode;
    readonly organisms: Readonly<Partial<Record<TaxonOrganism, string>>>;
    readonly ranks: Readonly<Record<TaxonRank, string>>;
    readonly second: string;
    readonly shared: ReactNode;
    readonly view: string;
  };
  readonly organisms: readonly [TaxonOrganism, ...TaxonOrganism[]];
  readonly pair: readonly [TaxonOrganism, TaxonOrganism];
  readonly title: NonNullable<ReactNode>;
}) {
  const [first, setFirst] = useState<TaxonOrganism>(pair[0]);
  const [second, setSecond] = useState<TaxonOrganism>(pair[1]);
  const comparison = compareTaxons(first, second);
  const options = Arr.map(organisms, (entry) => ({
    label: labels.organisms[entry] ?? entry,
    value: entry,
  }));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setFirst(pair[0]);
          setSecond(pair[1]);
        }}
      />

      <VisualCardToolbar>
        <Select
          items={options}
          onValueChange={(next: TaxonOrganism | null) => {
            if (next !== null) {
              setFirst(next);
            }
          }}
          value={first}
        >
          <SelectTrigger aria-label={labels.first} className="w-full">
            <SelectValue
              labels={Arr.map(options, (item) => item.label)}
              placeholder={labels.first}
            />
          </SelectTrigger>
          <SelectContent label={labels.first}>
            {Arr.map(options, (item) => (
              <SelectItem key={item.value} plain value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={options}
          onValueChange={(next: TaxonOrganism | null) => {
            if (next !== null) {
              setSecond(next);
            }
          }}
          value={second}
        >
          <SelectTrigger aria-label={labels.second} className="w-full">
            <SelectValue
              labels={Arr.map(options, (item) => item.label)}
              placeholder={labels.second}
            />
          </SelectTrigger>
          <SelectContent label={labels.second}>
            {Arr.map(options, (item) => (
              <SelectItem key={item.value} plain value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.4} setting="studio">
          <Suspense fallback={null}>
            <TaxonRankScene
              first={first}
              organismNames={labels.organisms}
              rankNames={labels.ranks}
              second={second}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.shared}
            value={Option.match(comparison.lowestRank, {
              onNone: () => labels.none,
              onSome: (rank) =>
                Option.match(comparison.lowestTaxon, {
                  onNone: () => labels.ranks[rank],
                  onSome: (taxon) => `${labels.ranks[rank]} (${taxon})`,
                }),
            })}
          />
          <VisualFactTabular
            label={labels.count}
            value={`${comparison.count} / ${TAXON_RANKS.length}`}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
