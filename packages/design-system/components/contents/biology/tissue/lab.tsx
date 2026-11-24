import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { PlantTissue } from "@repo/design-system/components/contents/biology/tissue/model";
import { tissueProfile } from "@repo/design-system/components/contents/biology/tissue/model";
import { PlantTissueScene } from "@repo/design-system/components/contents/biology/tissue/scene";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
import {
  VisualFact,
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function PlantTissueAnatomyLab({
  description,
  labels,
  tissues,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly function?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "companion"
        | "lignin"
        | "lumen"
        | "nucleus"
        | "sievePlate"
        | "vacuole"
        | "wall",
        string
      >
    >;
    readonly status?: ReactNode;
    readonly statuses: Readonly<Record<"dead" | "living", string>>;
    readonly tissue: string;
    readonly tissues: Readonly<
      Partial<
        Record<
          PlantTissue,
          {
            readonly name: string;
            readonly role: ReactNode;
            readonly wall: ReactNode;
          }
        >
      >
    >;
    readonly view: string;
    readonly wall: ReactNode;
  };
  readonly tissues: readonly [PlantTissue, ...PlantTissue[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<PlantTissue>(tissues[0]);
  const active = tissues.includes(selected) ? selected : tissues[0];
  const profile = tissueProfile(active);
  const copy = labels.tissues[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset onReset={() => setSelected(tissues[0])} />

      {tissues.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.tissue}
            gridColumns={toggleColumns(tissues.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(tissues, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(tissues, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.tissues[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <PlantTissueScene parts={labels.parts} tissue={active} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.wall} value={copy.wall} />
          )}
          {labels.status === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={
                profile.status === "living"
                  ? FOLIAGE_COLORS.palisade
                  : FOLIAGE_COLORS.lignin
              }
              label={labels.status}
              value={labels.statuses[profile.status]}
            />
          )}
          {labels.function === undefined || copy === undefined ? null : (
            <VisualFact label={labels.function} value={copy.role} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
