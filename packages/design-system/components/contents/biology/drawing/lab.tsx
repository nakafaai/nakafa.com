"use client";

import type {
  Specimen,
  Version,
} from "@repo/design-system/components/contents/biology/drawing/scale";
import {
  FAULTS,
  formatMagnification,
  magnificationOf,
  VERSIONS,
} from "@repo/design-system/components/contents/biology/drawing/scale";
import { DrawingScene } from "@repo/design-system/components/contents/biology/drawing/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface SpecimenDrawingLabProps {
  readonly actual: number;
  readonly description: NonNullable<ReactNode>;
  readonly drawing: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly drawing: string;
    readonly faults: Readonly<
      Record<"shading" | "sketchy" | "arrows" | "title", NonNullable<ReactNode>>
    >;
    readonly magnification?: NonNullable<ReactNode>;
    readonly parts: {
      readonly cytoplasm: string;
      readonly membrane?: string;
      readonly nucleus: string;
      readonly wall?: string;
    };
    readonly size: NonNullable<ReactNode>;
    readonly version: string;
    readonly versions: Readonly<Record<Version, string>>;
    readonly view: string;
  };
  readonly specimen: Specimen;
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive biological drawing workbench comparing a correct scientific
 * drawing against common faults and computing live linear magnification.
 */
export function SpecimenDrawingLab({
  actual,
  description,
  drawing,
  labels,
  specimen,
  title,
}: SpecimenDrawingLabProps) {
  const [version, setVersion] = useState<Version>("correct");
  const [drawingMm, setDrawingMm] = useState(drawing.value);
  const quantity = useQuantity();

  const magnification = formatMagnification(magnificationOf(drawingMm, actual));
  const boundaryLabel =
    specimen === "cheek"
      ? (labels.parts.membrane ?? "")
      : (labels.parts.wall ?? "");

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setVersion("correct");
          setDrawingMm(drawing.value);
        }}
      />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.version}
          onValueChange={(next) => {
            if (next === "correct" || next === "faulty") {
              setVersion(next);
            }
          }}
          size="sm"
          type="single"
          value={version}
        >
          {Arr.map(VERSIONS, (id) => (
            <ToggleGroupItem key={id} value={id}>
              {labels.versions[id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <VisualSlider
          heading={labels.drawing}
          label={labels.drawing}
          max={drawing.max}
          min={drawing.min}
          onValueChange={setDrawingMm}
          readout={<InlineMath math={quantity(drawingMm, "\\text{ mm}", 0)} />}
          step={1}
          value={drawingMm}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={1.5} setting="studio">
          <Suspense fallback={null}>
            <DrawingScene
              boundaryLabel={boundaryLabel}
              cytoplasmLabel={labels.parts.cytoplasm}
              drawingMax={drawing.max}
              drawingMin={drawing.min}
              drawingMm={drawingMm}
              magnificationText={
                labels.magnification === undefined ? undefined : magnification
              }
              nucleusLabel={labels.parts.nucleus}
              specimen={specimen}
              version={version}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.size}
            value={
              <InlineMath
                math={`${quantity(drawingMm, "\\text{ mm}", 0)} / ${quantity(actual, "\\ \\mu\\text{m}", 0)}`}
              />
            }
          />

          {labels.magnification !== undefined && (
            <VisualFactTabular
              label={labels.magnification}
              value={magnification}
            />
          )}

          {version === "faulty" &&
            Arr.map(FAULTS, (fault, index) => (
              <VisualFact
                key={fault}
                label={`${index + 1}`}
                value={labels.faults[fault]}
              />
            ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
