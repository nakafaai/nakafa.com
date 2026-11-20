import type {
  Glucose,
  Solute,
  Urea,
} from "@repo/design-system/components/contents/biology/nephron/filtration";
import {
  concentrationFactor,
  excreted,
  filteredLoad,
  perDay,
  reabsorbed,
  threshold,
  urineFlow,
} from "@repo/design-system/components/contents/biology/nephron/filtration";
import { NephronScene } from "@repo/design-system/components/contents/biology/nephron/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/**
 * One nephron of a kidney, with the filtrate flowing through it. The
 * glomerulus filters plasma into the Bowman's capsule at the filtration rate.
 * Glucose is taken back in the proximal tubule up to the tubules' maximum,
 * so above the renal threshold it spills into the urine. Urea is filtered and
 * kept while water is taken back, so the urine carries it many times more
 * concentrated than the plasma.
 */
export function NephronLab({
  description,
  filtration,
  glucose,
  labels,
  title,
  urea,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly filtration: number;
  readonly glucose?: Glucose;
  readonly labels: {
    readonly daily: ReactNode;
    readonly factor: ReactNode;
    readonly filtrate: ReactNode;
    readonly flow: ReactNode;
    readonly load: ReactNode;
    readonly plasma: string;
    readonly reabsorbed: ReactNode;
    readonly solute: string;
    readonly solutes: Readonly<{ glucose: string; urea: string }>;
    readonly threshold: ReactNode;
    readonly urine: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
  readonly urea?: Urea;
}) {
  const [solute, setSolute] = useState<Solute>(
    glucose === undefined ? "urea" : "glucose"
  );
  const [plasma, setPlasma] = useState(glucose?.plasma ?? 0);
  const quantity = useQuantity();
  const maximum = glucose?.maximum ?? 0;
  const limit = Math.max(2 * threshold(maximum, filtration), plasma);
  const load = filteredLoad(filtration, plasma);
  const share = load === 0 ? 1 : reabsorbed(load, maximum) / load;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {glucose !== undefined && (
        <VisualCardToolbar>
          {urea !== undefined && (
            <ToggleGroup
              aria-label={labels.solute}
              onValueChange={(value: string) => {
                if (value === "glucose" || value === "urea") {
                  setSolute(value);
                }
              }}
              type="single"
              value={solute}
              variant="outline"
            >
              <ToggleGroupItem value="glucose">
                {labels.solutes.glucose}
              </ToggleGroupItem>
              <ToggleGroupItem value="urea">
                {labels.solutes.urea}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {solute === "glucose" && (
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span>{labels.plasma}</span>
                <span className="shrink-0 tabular-nums">
                  <InlineMath
                    math={quantity(plasma, "\\text{ mg cm}^{-3}", 2)}
                  />
                </span>
              </div>
              <Slider
                aria-label={labels.plasma}
                max={limit}
                min={0}
                onValueChange={(value: number) => setPlasma(value)}
                step={limit / 100}
                value={plasma}
              />
            </div>
          )}
        </VisualCardToolbar>
      )}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={4} setting="studio">
          <Suspense fallback={null}>
            <NephronScene
              amount={limit === 0 ? 0 : plasma / limit}
              share={share}
              solute={solute}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        {solute === "glucose" ? (
          <VisualCardFacts>
            <VisualFactTabular
              label={labels.load}
              value={
                <InlineMath
                  math={`${quantity(filtration, "", 1)} \\times ${quantity(plasma, "", 2)} = ${quantity(load, "\\text{ mg min}^{-1}", 1)}`}
                />
              }
            />
            <VisualFactTabular
              label={labels.reabsorbed}
              value={
                <InlineMath
                  math={quantity(
                    reabsorbed(load, maximum),
                    "\\text{ mg min}^{-1}",
                    1
                  )}
                />
              }
            />
            <VisualFactTabular
              label={labels.urine}
              value={
                <InlineMath
                  math={quantity(
                    excreted(load, maximum),
                    "\\text{ mg min}^{-1}",
                    1
                  )}
                />
              }
            />
            <VisualFactTabular
              label={labels.threshold}
              value={
                <InlineMath
                  math={`\\dfrac{${quantity(maximum, "", 1)}}{${quantity(filtration, "", 1)}} = ${quantity(threshold(maximum, filtration), "\\text{ mg cm}^{-3}", 2)}`}
                />
              }
            />
          </VisualCardFacts>
        ) : (
          urea !== undefined && (
            <VisualCardFacts>
              <VisualFactTabular
                label={labels.filtrate}
                value={
                  <InlineMath
                    math={quantity(perDay(filtration), "\\text{ dm}^3", 1)}
                  />
                }
              />
              <VisualFactTabular
                label={labels.factor}
                value={
                  <InlineMath
                    math={`\\dfrac{${quantity(urea.urine, "", 2)}}{${quantity(urea.plasma, "", 2)}} = ${quantity(concentrationFactor(urea), "", 1)}`}
                  />
                }
              />
              <VisualFactTabular
                label={labels.flow}
                value={
                  <InlineMath
                    math={quantity(
                      urineFlow(filtration, urea),
                      "\\text{ cm}^3\\text{ min}^{-1}",
                      2
                    )}
                  />
                }
              />
              <VisualFactTabular
                label={labels.daily}
                value={
                  <InlineMath
                    math={quantity(
                      perDay(urineFlow(filtration, urea)),
                      "\\text{ dm}^3",
                      2
                    )}
                  />
                }
              />
            </VisualCardFacts>
          )
        )}
      </VisualCardFooter>
    </VisualCard>
  );
}
