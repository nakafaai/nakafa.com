"use client";

import type {
  Bond,
  Condition,
  Level,
} from "@repo/design-system/components/contents/biology/protein/folding";
import {
  activeBonds,
  isWorking,
} from "@repo/design-system/components/contents/biology/protein/folding";
import { ProteinScene } from "@repo/design-system/components/contents/biology/protein/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Fragment, Suspense, useState } from "react";

interface ProteinFoldLabProps {
  readonly conditions: readonly [Condition, ...Condition[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly bonds: Readonly<Record<Bond, NonNullable<ReactNode>>>;
    readonly condition: string;
    readonly conditions: Readonly<Partial<Record<Condition, string>>>;
    readonly holds: NonNullable<ReactNode>;
    readonly level: string;
    readonly levels: Readonly<Partial<Record<Level, string>>>;
    readonly no: NonNullable<ReactNode>;
    readonly parts: Readonly<
      Record<"chain" | "helix" | "sheet" | "haem", string>
    >;
    readonly peptide: NonNullable<ReactNode>;
    readonly view: string;
    readonly works: NonNullable<ReactNode>;
    readonly yes: NonNullable<ReactNode>;
  };
  readonly levels: readonly [Level, ...Level[]];
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive protein folding and denaturation workbench tracing primary,
 * secondary, tertiary, and quaternary structure under normal, heated, and
 * acidic conditions.
 */
export function ProteinFoldLab({
  conditions,
  description,
  labels,
  levels,
  title,
}: ProteinFoldLabProps) {
  const [level, setLevel] = useState<Level>(levels[0]);
  const [condition, setCondition] = useState<Condition>(conditions[0]);

  const bonds = activeBonds(level, condition);
  const working = isWorking(level, condition);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setLevel(levels[0]);
          setCondition(conditions[0]);
        }}
      />

      <VisualCardToolbar>
        {levels.length > 1 && (
          <ToggleGroup
            aria-label={labels.level}
            onValueChange={(next) => {
              if (
                next === "primary" ||
                next === "secondary" ||
                next === "tertiary" ||
                next === "quaternary"
              ) {
                setLevel(next);
              }
            }}
            size="sm"
            type="single"
            value={level}
          >
            {Arr.map(levels, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.levels[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {conditions.length > 1 && (
          <ToggleGroup
            aria-label={labels.condition}
            onValueChange={(next) => {
              if (next === "normal" || next === "heated" || next === "acid") {
                setCondition(next);
              }
            }}
            size="sm"
            type="single"
            value={condition}
          >
            {Arr.map(conditions, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.conditions[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.9} setting="studio">
          <Suspense fallback={null}>
            <ProteinScene
              condition={condition}
              level={level}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.holds}
            value={
              <span>
                {Arr.map(bonds, (bond, index) => (
                  <Fragment key={bond}>
                    {index > 0 ? ", " : null}
                    {labels.bonds[bond]}
                  </Fragment>
                ))}
              </span>
            }
          />
          <VisualFact label={labels.peptide} value={labels.yes} />
          <VisualFact
            label={labels.works}
            value={working ? labels.yes : labels.no}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
