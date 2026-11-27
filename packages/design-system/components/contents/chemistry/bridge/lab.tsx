import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { GalvanicCell } from "@repo/design-system/components/contents/chemistry/bridge/model";
import { SaltBridgeScene } from "@repo/design-system/components/contents/chemistry/bridge/scene";
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
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function SaltBridgeIonFlowLab({
  cells,
  description,
  labels,
  title,
}: {
  readonly cells: readonly [GalvanicCell, ...GalvanicCell[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly cell: string;
    readonly cells: Readonly<
      Partial<
        Record<
          GalvanicCell,
          {
            readonly emf: ReactNode;
            readonly name: ReactNode;
            readonly redoxEquation: ReactNode;
          }
        >
      >
    >;
    readonly emf?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "anode"
        | "cathode"
        | "electrolyte"
        | "electronWire"
        | "saltBridge"
        | "voltmeter",
        string
      >
    >;
    readonly redoxEquation?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<GalvanicCell>(cells[0]);
  const active = Arr.contains(cells, selected) ? selected : cells[0];
  const copy = labels.cells[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(cells[0]);
        }}
      />

      {cells.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.cell}
            gridColumns={toggleColumns(cells.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(cells, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(cells, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.cells[id]?.name ?? id}
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
        <ScienceStage floor={0} reach={1.2} setting="lab">
          <Suspense fallback={null}>
            <SaltBridgeScene cell={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={PROCESS_COLORS.catalystTeal}
            label={labels.cell}
            value={copy?.name ?? active}
          />
          {labels.emf === undefined || copy === undefined ? null : (
            <VisualFact label={labels.emf} value={copy.emf} />
          )}
          {labels.redoxEquation === undefined || copy === undefined ? null : (
            <VisualFact
              label={labels.redoxEquation}
              value={copy.redoxEquation}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
