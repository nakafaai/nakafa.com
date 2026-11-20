import { useFrame } from "@react-three/fiber";
import { EyepieceView } from "@repo/design-system/components/contents/biology/microscope/eyepiece";
import type {
  Field,
  Graticule,
  Specimen,
} from "@repo/design-system/components/contents/biology/microscope/optics";
import {
  cellsAcross,
  divisionsSpanned,
  divisionValue,
  fieldAt,
  totalMagnification,
} from "@repo/design-system/components/contents/biology/microscope/optics";
import { MicroscopeStand } from "@repo/design-system/components/contents/biology/microscope/stand";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useRef, useState } from "react";

/** How long each objective stays in place while the card plays, in seconds. */
const OBJECTIVE_HOLD = 2.4;

/** A typical cell of each specimen, in micrometres, when the lesson names none. */
const TYPICAL_CELL = {
  cheek: 60,
  micrometer: 10,
  onion: 240,
  root: 18,
} as const;

/**
 * A light microscope, seen on the bench or down its eyepiece. Turning the
 * nosepiece to a stronger objective magnifies more and shrinks the field of
 * view in proportion, so fewer cells fit across it. An eyepiece graticule,
 * calibrated against a stage micrometer at the first objective, measures a
 * cell in divisions whose value falls as the objective grows.
 */
export function MicroscopeLab({
  cell,
  description,
  eyepiece,
  field,
  graticule,
  labels,
  objectives,
  specimen,
  title,
}: {
  readonly cell?: number;
  readonly description: NonNullable<ReactNode>;
  readonly eyepiece: number;
  readonly field?: Field;
  readonly graticule?: Graticule;
  readonly labels: {
    readonly across: ReactNode;
    readonly cell: ReactNode;
    readonly division: ReactNode;
    readonly field: ReactNode;
    readonly magnification: ReactNode;
    readonly objective: string;
    readonly span: ReactNode;
    readonly view: string;
    readonly views: Readonly<{ eyepiece: string; stand: string }>;
  };
  readonly objectives: readonly [number, ...number[]];
  readonly specimen: Specimen;
  readonly title: NonNullable<ReactNode>;
}) {
  const [objective, setObjective] = useState(objectives[0]);
  const [view, setView] = useState<"eyepiece" | "stand">("eyepiece");
  const quantity = useQuantity();
  const magnification = totalMagnification(eyepiece, objective);
  const diameter = fieldAt({
    eyepiece,
    field,
    graticule,
    objective,
    objectives,
  });
  const length = cell ?? TYPICAL_CELL[specimen];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.objective}
          onValueChange={(value: string) => {
            if (value !== "") {
              setObjective(Number(value));
            }
          }}
          type="single"
          value={String(objective)}
          variant="outline"
        >
          {Arr.map(objectives, (each) => (
            <ToggleGroupItem key={each} value={String(each)}>
              <InlineMath math={`\\times ${each}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          aria-label={labels.view}
          onValueChange={(value: string) => {
            if (value === "eyepiece" || value === "stand") {
              setView(value);
            }
          }}
          type="single"
          value={view}
          variant="outline"
        >
          <ToggleGroupItem value="eyepiece">
            {labels.views.eyepiece}
          </ToggleGroupItem>
          <ToggleGroupItem value="stand">{labels.views.stand}</ToggleGroupItem>
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        {view === "eyepiece" ? (
          <ScienceStage reach={60} setting="studio">
            <Suspense fallback={null}>
              <ObjectiveCycle
                objectives={objectives}
                onObjective={setObjective}
              />
              <EyepieceView
                cell={length}
                diameter={diameter}
                graticule={graticule !== undefined}
                specimen={specimen}
              />
            </Suspense>
          </ScienceStage>
        ) : (
          <ScienceStage floor={0} reach={0.4} setting="lab">
            <Suspense fallback={null}>
              <ObjectiveCycle
                objectives={objectives}
                onObjective={setObjective}
              />
              <MicroscopeStand objective={objective} objectives={objectives} />
            </Suspense>
          </ScienceStage>
        )}
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.magnification}
            value={
              <InlineMath
                math={`${quantity(eyepiece, "", 0)} \\times ${quantity(objective, "", 0)} = ${quantity(magnification, "", 0)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.field}
            value={<InlineMath math={quantity(diameter, "\\text{ mm}", 3)} />}
          />
          {graticule === undefined ? (
            <>
              <VisualFactTabular
                label={labels.cell}
                value={
                  <InlineMath math={quantity(length, "\\,\\mu\\text{m}", 1)} />
                }
              />
              <VisualFactTabular
                label={labels.across}
                value={
                  <InlineMath
                    math={quantity(cellsAcross(diameter, length), "", 1)}
                  />
                }
              />
            </>
          ) : (
            <>
              <VisualFactTabular
                label={labels.division}
                value={
                  <InlineMath
                    math={quantity(
                      divisionValue(graticule, objectives[0], objective),
                      "\\,\\mu\\text{m}",
                      3
                    )}
                  />
                }
              />
              <VisualFactTabular
                label={labels.span}
                value={
                  <InlineMath
                    math={quantity(
                      divisionsSpanned(
                        length,
                        divisionValue(graticule, objectives[0], objective)
                      ),
                      "",
                      1
                    )}
                  />
                }
              />
            </>
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Turns the nosepiece to the next objective every few seconds while the card
 * plays, so the learner sees the field shrink and grow on its own.
 */
function ObjectiveCycle({
  objectives,
  onObjective,
}: {
  readonly objectives: readonly [number, ...number[]];
  readonly onObjective: (objective: number) => void;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const held = useRef(0);
  const index = useRef(0);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    held.current += delta;
    if (held.current >= OBJECTIVE_HOLD) {
      held.current = 0;
      index.current = (index.current + 1) % objectives.length;
      onObjective(objectives[index.current] ?? objectives[0]);
    }
  });

  return <SimulationTicker running={playing} />;
}
