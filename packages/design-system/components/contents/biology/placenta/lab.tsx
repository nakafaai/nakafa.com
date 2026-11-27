"use client";

import type { Substance } from "@repo/design-system/components/contents/biology/placenta/exchange";
import type { PlacentaPart } from "@repo/design-system/components/contents/biology/placenta/scene";
import { PlacentaScene } from "@repo/design-system/components/contents/biology/placenta/scene";
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
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface SubstanceCopy {
  readonly direction: NonNullable<ReactNode>;
  readonly how: NonNullable<ReactNode>;
  readonly name: ReactNode;
}

interface PlacentaLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly direction: NonNullable<ReactNode>;
    readonly how: NonNullable<ReactNode>;
    readonly parts: Readonly<Record<PlacentaPart, string>>;
    readonly substance: string;
    readonly substances: Readonly<Partial<Record<Substance, SubstanceCopy>>>;
    readonly view: string;
  };
  readonly substances: readonly [Substance, ...Substance[]];
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive placental exchange workbench demonstrating diffusion and active
 * transport across the chorionic villus wall while keeping maternal and foetal
 * blood strictly separate.
 */
export function PlacentaLab({
  description,
  labels,
  substances,
  title,
}: PlacentaLabProps) {
  const [substance, setSubstance] = useState<Substance>(substances[0]);

  const copy = labels.substances[substance];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset onReset={() => setSubstance(substances[0])} />

      <VisualCardToolbar>
        {substances.length > 1 && (
          <ToggleGroup
            aria-label={labels.substance}
            onValueChange={(next) => {
              const found = Arr.findFirst(substances, (id) => id === next);
              if (Option.isSome(found)) {
                setSubstance(found.value);
              }
            }}
            size="sm"
            type="single"
            value={substance}
          >
            {Arr.map(substances, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.substances[id]?.name ?? id}
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
        <ScienceStage floor={0} reach={2.0} setting="studio">
          <Suspense fallback={null}>
            <PlacentaScene parts={labels.parts} substance={substance} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy !== undefined && (
            <VisualFact label={labels.direction} value={copy.direction} />
          )}
          {copy !== undefined && (
            <VisualFact label={labels.how} value={copy.how} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
