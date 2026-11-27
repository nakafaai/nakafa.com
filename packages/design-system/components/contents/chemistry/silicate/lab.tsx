import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { SilicateMaterial } from "@repo/design-system/components/contents/chemistry/silicate/model";
import { GlassCeramicScene } from "@repo/design-system/components/contents/chemistry/silicate/scene";
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
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function GlassCeramicLatticeLab({
  description,
  labels,
  materials,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly material: string;
    readonly materials: Readonly<
      Partial<
        Record<
          SilicateMaterial,
          {
            readonly name: ReactNode;
            readonly propertyNote: ReactNode;
            readonly useNote: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "boronNode" | "clayLayer" | "crystalGrain" | "silicaTetrahedron",
        string
      >
    >;
    readonly propertyNote?: ReactNode;
    readonly useNote?: ReactNode;
    readonly view: string;
  };
  readonly materials: readonly [SilicateMaterial, ...SilicateMaterial[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<SilicateMaterial>(materials[0]);
  const active = Arr.contains(materials, selected) ? selected : materials[0];
  const copy = labels.materials[active];
  const dotColor = Match.value(active).pipe(
    Match.when("sodaLimeGlass", () => PROCESS_COLORS.silicaBlue),
    Match.when("borosilicateGlass", () => PROCESS_COLORS.boronMint),
    Match.when("traditionalCeramic", () => PROCESS_COLORS.alloyBronze),
    Match.when("advancedCeramic", () => PROCESS_COLORS.alloySteel),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(materials[0]);
        }}
      />

      {materials.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.material}
            gridColumns={toggleColumns(materials.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(materials, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(materials, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.materials[id]?.name ?? id}
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
        <ScienceStage floor={0} reach={1.25} setting="lab">
          <Suspense fallback={null}>
            <GlassCeramicScene material={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={dotColor}
            label={labels.material}
            value={copy?.name ?? active}
          />
          {labels.propertyNote === undefined || copy === undefined ? null : (
            <VisualFact label={labels.propertyNote} value={copy.propertyNote} />
          )}
          {labels.useNote === undefined || copy === undefined ? null : (
            <VisualFact label={labels.useNote} value={copy.useNote} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
