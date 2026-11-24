import type {
  CellKind,
  CellOutcome,
  Tonicity,
} from "@repo/design-system/components/contents/biology/plasmolysis/model";
import { evaluatePlasmolysis } from "@repo/design-system/components/contents/biology/plasmolysis/model";
import { PlasmolysisScene } from "@repo/design-system/components/contents/biology/plasmolysis/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function PlasmolysisCellLab({
  cells,
  description,
  labels,
  solutions,
  title,
}: {
  readonly cells: readonly [CellKind, ...CellKind[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly cell: string;
    readonly cells: Readonly<Partial<Record<CellKind, string>>>;
    readonly outcome?: ReactNode;
    readonly outcomes: Readonly<Record<CellOutcome, string>>;
    readonly parts: Readonly<
      Record<
        "cellWall" | "cytoplasm" | "membrane" | "vacuole" | "waterArrow",
        string
      >
    >;
    readonly solution: string;
    readonly solutions: Readonly<Partial<Record<Tonicity, string>>>;
    readonly view: string;
    readonly waterFlow?: ReactNode;
  };
  readonly solutions: readonly [Tonicity, ...Tonicity[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedCell, setSelectedCell] = useState<CellKind>(cells[0]);
  const [selectedSolution, setSelectedSolution] = useState<Tonicity>(
    solutions[0]
  );

  const activeCell = Arr.contains(cells, selectedCell)
    ? selectedCell
    : cells[0];
  const activeSolution = Arr.contains(solutions, selectedSolution)
    ? selectedSolution
    : solutions[0];
  const reading = evaluatePlasmolysis(activeCell, activeSolution);
  const flowArrow = Match.value(reading.waterNet).pipe(
    Match.when("in", () => "->"),
    Match.when("balanced", () => "<->"),
    Match.when("out", () => "<-"),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedCell(cells[0]);
          setSelectedSolution(solutions[0]);
        }}
      />

      <VisualCardToolbar>
        {cells.length > 1 ? (
          <ToggleGroup
            aria-label={labels.cell}
            gridColumns={toggleColumns(cells.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(cells, (item) => item === next),
                setSelectedCell
              );
            }}
            type="single"
            value={activeCell}
            variant="outline"
          >
            {Arr.map(cells, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.cells[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {solutions.length > 1 ? (
          <ToggleGroup
            aria-label={labels.solution}
            gridColumns={toggleColumns(solutions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(solutions, (item) => item === next),
                setSelectedSolution
              );
            }}
            type="single"
            value={activeSolution}
            variant="outline"
          >
            {Arr.map(solutions, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.solutions[id] ?? id}
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
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <PlasmolysisScene
              cell={activeCell}
              parts={labels.parts}
              solution={activeSolution}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.solution}
            value={labels.solutions[activeSolution] ?? activeSolution}
          />
          {labels.outcome === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={
                reading.outcome === "turgid" || reading.outcome === "normal"
                  ? HOMEOSTASIS_COLORS.receptor
                  : HOMEOSTASIS_COLORS.arteriole
              }
              label={labels.outcome}
              value={labels.outcomes[reading.outcome]}
            />
          )}
          {labels.waterFlow === undefined ? null : (
            <VisualFact label={labels.waterFlow} value={flowArrow} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
