import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  SeaAnimal,
  SeaLanguage,
} from "@repo/design-system/components/contents/biology/vernacular/model";
import {
  seaCommonName,
  seaSpeciesOf,
} from "@repo/design-system/components/contents/biology/vernacular/model";
import { SeaNameScene } from "@repo/design-system/components/contents/biology/vernacular/scene";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function SeaNameLab({
  animals,
  description,
  labels,
  languages,
  title,
}: {
  readonly animals: readonly [SeaAnimal, ...SeaAnimal[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly animal: string;
    readonly group: ReactNode;
    readonly groups?: Readonly<Partial<Record<SeaAnimal, ReactNode>>>;
    readonly language: string;
    readonly languages: Readonly<Partial<Record<SeaLanguage, string>>>;
    readonly names: Readonly<
      Partial<Record<SeaAnimal, Readonly<Partial<Record<SeaLanguage, string>>>>>
    >;
    readonly scientific: string;
    readonly view: string;
  };
  readonly languages: readonly [SeaLanguage, ...SeaLanguage[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [language, setLanguage] = useState<SeaLanguage>(languages[0]);
  const [selected, setSelected] = useState<SeaAnimal>(animals[0]);
  const species = seaSpeciesOf(selected);
  const common = seaCommonName(labels.names, selected, language);
  const groupReading = labels.groups?.[selected];
  const animalOptions = Arr.map(animals, (animal) => ({
    label: seaCommonName(labels.names, animal, language),
    value: animal,
  }));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setLanguage(languages[0]);
          setSelected(animals[0]);
        }}
      />

      <VisualCardToolbar>
        {languages.length > 1 ? (
          <ToggleGroup
            aria-label={labels.language}
            gridColumns={toggleColumns(languages.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(languages, (entry) => entry === next),
                setLanguage
              );
            }}
            type="single"
            value={language}
            variant="outline"
          >
            {Arr.map(languages, (entry) => (
              <ToggleGroupItem key={entry} value={entry}>
                {labels.languages[entry] ?? entry}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {animals.length > 1 ? (
          <Select
            items={animalOptions}
            onValueChange={(next: SeaAnimal | null) => {
              if (next !== null) {
                setSelected(next);
              }
            }}
            value={selected}
          >
            <SelectTrigger aria-label={labels.animal} className="w-full">
              <SelectValue
                labels={Arr.map(animalOptions, (item) => item.label)}
                placeholder={labels.animal}
              />
            </SelectTrigger>
            <SelectContent label={labels.animal}>
              {Arr.map(animalOptions, (item) => (
                <SelectItem key={item.value} plain value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-0.02} ground="sand" reach={3.4} setting="sky">
          <Suspense fallback={null}>
            <SeaNameScene
              animals={animals}
              language={language}
              names={labels.names}
              onSelect={setSelected}
              selected={selected}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.animal} value={common} />
          <VisualFact
            label={labels.scientific}
            value={<em>{species.scientific}</em>}
          />
          {groupReading === undefined ? null : (
            <VisualFact label={labels.group} value={groupReading} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
