import type { Part } from "@repo/design-system/components/contents/biology/mitochondrion/labels";
import type {
  Cell,
  Condition,
} from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import {
  atpAtMembrane,
  atpMade,
  CellSchema,
  conditionOf,
  GLYCOLYSIS_ATP,
  oxygenSite,
  yieldOf,
} from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import {
  MitochondrionScene,
  PartLabels,
} from "@repo/design-system/components/contents/biology/mitochondrion/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/**
 * Where each stage of cellular respiration happens, and what oxygen changes:
 * a stretch of cytoplasm and one mitochondrion cut open lengthwise, at the
 * scale of an electron micrograph. Glucose splits into two pyruvate in the
 * cytoplasm, making 2 ATP. With oxygen, pyruvate enters the matrix, carbon
 * dioxide leaves, hydrogen carried to the cristae meets oxygen there as
 * water, and the inner membrane makes the rest of the ATP. Without oxygen
 * the mitochondrion goes quiet: a muscle cell turns pyruvate into lactic
 * acid and a yeast cell into ethanol and carbon dioxide, both in the
 * cytoplasm, and the ATP stays at 2. The footer reads what one glucose gives:
 * its ATP, its carbon dioxide, where its oxygen is used, its products and,
 * when the lesson names it, the energy it releases.
 *
 * @param atp - The aerobic ATP per glucose the lesson teaches, since
 * textbooks differ
 * @param cells - The cells the learner can choose between, muscle and yeast
 */
export function MitochondrionLab({
  atp,
  cells,
  description,
  labels,
  title,
}: {
  readonly atp: number;
  readonly cells: readonly [Cell, ...Cell[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly atp: ReactNode;
    readonly carbonDioxide: ReactNode;
    readonly cell: string;
    readonly cells: Readonly<Record<Cell, string>>;
    readonly energy?: ReactNode;
    readonly oxygen: string;
    readonly oxygens: Readonly<{ absent: string; present: string }>;
    readonly parts: Readonly<Record<Part, string>>;
    readonly product: ReactNode;
    readonly products: Readonly<Record<Condition, ReactNode>>;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [oxygen, setOxygen] = useState(true);
  const [chosen, setChosen] = useState<Cell>(cells[0]);
  const cell = Arr.contains(cells, chosen) ? chosen : cells[0];
  const condition = conditionOf(oxygen, cell);
  const given = yieldOf(condition);
  const quantity = useQuantity();
  const membrane = atpAtMembrane(condition, atp);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setOxygen(true);
          setChosen(cells[0]);
        }}
      />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.oxygen}
          gridColumns="2"
          onValueChange={(value: string) => {
            if (value === "present" || value === "absent") {
              setOxygen(value === "present");
            }
          }}
          type="single"
          value={oxygen ? "present" : "absent"}
          variant="outline"
        >
          <ToggleGroupItem value="present">
            {labels.oxygens.present}
          </ToggleGroupItem>
          <ToggleGroupItem value="absent">
            {labels.oxygens.absent}
          </ToggleGroupItem>
        </ToggleGroup>
        {cells.length > 1 && (
          <ToggleGroup
            aria-label={labels.cell}
            gridColumns={toggleColumns(cells.length)}
            onValueChange={(value: string) => {
              if (Schema.is(CellSchema)(value)) {
                setChosen(value);
              }
            }}
            type="single"
            value={cell}
            variant="outline"
          >
            {Arr.map(cells, (option) => (
              <ToggleGroupItem key={option} value={option}>
                {labels.cells[option]}
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
        <ScienceStage reach={3} setting="studio">
          <Suspense fallback={null}>
            <MitochondrionScene atp={atp} cell={cell} condition={condition}>
              <PartLabels parts={labels.parts} />
            </MitochondrionScene>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.atp}
            value={
              <InlineMath
                math={
                  membrane > 0
                    ? `${quantity(GLYCOLYSIS_ATP, "", 0)} + ${quantity(membrane, "", 0)} = ${quantity(atpMade(condition, atp), "", 0)}`
                    : quantity(GLYCOLYSIS_ATP, "", 0)
                }
              />
            }
          />
          <VisualFactTabular
            label={labels.carbonDioxide}
            value={
              <InlineMath
                math={`${quantity(given.carbonDioxide, "", 0)}\\ \\mathrm{CO_2}`}
              />
            }
          />
          <VisualFact
            label={labels.oxygen}
            value={Option.match(oxygenSite(condition), {
              onNone: () => labels.oxygens.absent,
              onSome: (part) => (
                <span>
                  {labels.parts[part]}{" "}
                  <InlineMath
                    math={`(${quantity(given.oxygen, "", 0)}\\ \\mathrm{O_2})`}
                  />
                </span>
              ),
            })}
          />
          <VisualFact
            label={labels.product}
            value={labels.products[condition]}
          />
          {labels.energy !== undefined && (
            <VisualFactTabular
              label={labels.energy}
              value={
                <InlineMath math={quantity(given.energy, "\\text{ kJ}", 0)} />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
