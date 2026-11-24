import type {
  BoneCondition,
  BonePart,
  HealthState,
} from "@repo/design-system/components/contents/biology/bone/model";
import { BoneHealthScene } from "@repo/design-system/components/contents/biology/bone/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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

const STATES = ["healthy", "affected"] as const;

export function BoneHealthLab({
  conditions,
  description,
  labels,
  title,
}: {
  readonly conditions: readonly [BoneCondition, ...BoneCondition[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly change: ReactNode;
    readonly condition: string;
    readonly conditions: Readonly<
      Partial<
        Record<
          BoneCondition,
          {
            readonly change: ReactNode;
            readonly name: string;
            readonly who: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<Record<BonePart, string>>;
    readonly state: string;
    readonly states: Readonly<Record<HealthState, string>>;
    readonly view: string;
    readonly who: ReactNode;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [condition, setCondition] = useState<BoneCondition>(conditions[0]);
  const [state, setState] = useState<HealthState>("affected");
  const entry = labels.conditions[condition];
  const conditionOptions = Arr.map(conditions, (item) => ({
    label: labels.conditions[item]?.name ?? item,
    value: item,
  }));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setCondition(conditions[0]);
          setState("affected");
        }}
      />

      <VisualCardToolbar>
        {conditions.length > 3 ? (
          <Select
            items={conditionOptions}
            onValueChange={(next: BoneCondition | null) => {
              if (next !== null) {
                setCondition(next);
              }
            }}
            value={condition}
          >
            <SelectTrigger aria-label={labels.condition} className="w-full">
              <SelectValue
                labels={Arr.map(conditionOptions, (item) => item.label)}
                placeholder={labels.condition}
              />
            </SelectTrigger>
            <SelectContent label={labels.condition}>
              {Arr.map(conditionOptions, (item) => (
                <SelectItem key={item.value} plain value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {conditions.length > 1 && conditions.length <= 3 ? (
          <ToggleGroup
            aria-label={labels.condition}
            gridColumns={toggleColumns(conditions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(conditions, (item) => item === next),
                setCondition
              );
            }}
            type="single"
            value={condition}
            variant="outline"
          >
            {Arr.map(conditions, (item) => (
              <ToggleGroupItem key={item} value={item}>
                {labels.conditions[item]?.name ?? item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <ToggleGroup
          aria-label={labels.state}
          gridColumns="2"
          onValueChange={(next: string) => {
            if (next === "healthy" || next === "affected") {
              setState(next);
            }
          }}
          type="single"
          value={state}
          variant="outline"
        >
          {Arr.map(STATES, (item) => (
            <ToggleGroupItem key={item} value={item}>
              {labels.states[item]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="studio">
          <Suspense fallback={null}>
            <BoneHealthScene
              condition={condition}
              parts={labels.parts}
              state={state}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.change}
            value={entry?.change ?? condition}
          />
          <VisualFact label={labels.who} value={entry?.who ?? condition} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
