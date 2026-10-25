import {
  ATOM_SYMBOL_SAMPLE_IDS,
  ATOM_SYMBOL_SAMPLES,
  type AtomSymbolSampleId,
  CARBON_12_ID,
  isAtomSymbolSampleId,
} from "@repo/design-system/components/contents/chemistry/atom-symbol/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";

interface AtomSymbolLabProps {
  description: ReactNode;
  labels: {
    atomicNumber: string;
    chooseAtom: string;
    electronCount: string;
    elementSymbol: string;
    massNumber: string;
    neutralAtom: string;
    neutronCount: string;
    protonCount: string;
    samples: Record<
      AtomSymbolSampleId,
      {
        ariaName: string;
        name: ReactNode;
        tab: ReactNode;
      }
    >;
  };
  title: ReactNode;
}

/**
 * Renders a compact identity-card lab for reading atomic notation.
 */
export function AtomSymbolLab({
  title,
  description,
  labels,
}: AtomSymbolLabProps) {
  const [selectedSampleId, setSelectedSampleId] =
    useState<AtomSymbolSampleId>(CARBON_12_ID);
  const selectedSample = ATOM_SYMBOL_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const neutronCount = selectedSample.massNumber - selectedSample.atomicNumber;
  const notation = `{}^{${selectedSample.massNumber}}_{${selectedSample.atomicNumber}}\\mathrm{${selectedSample.symbol}}`;

  /**
   * Keeps one atom selected when ToggleGroup emits an empty value.
   */
  function handleSampleChange(value: string) {
    if (!value) {
      return;
    }

    if (!isAtomSymbolSampleId(value)) {
      return;
    }

    setSelectedSampleId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseAtom}
          gridColumns="4"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {Arr.map(ATOM_SYMBOL_SAMPLE_IDS, (sampleId) => (
            <ToggleGroupItem
              aria-label={labels.samples[sampleId].ariaName}
              key={sampleId}
              value={sampleId}
            >
              {labels.samples[sampleId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={`${selectedLabels.ariaName}, ${labels.massNumber} ${selectedSample.massNumber}, ${labels.atomicNumber} ${selectedSample.atomicNumber}`}
        className="grid min-h-44 place-items-center p-(--card-spacing) text-center sm:min-h-48 [[data-fullscreen]>&]:grid"
        render={<section />}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="text-muted-foreground text-sm">
            {selectedLabels.name}
          </div>
          <div className="text-5xl sm:text-6xl">
            <InlineMath math={notation} />
          </div>
        </div>
      </VisualCardBody>

      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.massNumber}
            value={<InlineMath math={`A = ${selectedSample.massNumber}`} />}
          />
          <VisualFact
            label={labels.atomicNumber}
            value={<InlineMath math={`Z = ${selectedSample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.elementSymbol}
            value={
              <InlineMath math={`X = \\mathrm{${selectedSample.symbol}}`} />
            }
          />
          <VisualFact
            label={labels.protonCount}
            value={<InlineMath math={`${selectedSample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.neutronCount}
            value={<InlineMath math={`${neutronCount}`} />}
          />
          <VisualFact
            label={labels.electronCount}
            value={
              <>
                <InlineMath math={`${selectedSample.atomicNumber}`} />{" "}
                <span className="text-muted-foreground">
                  {labels.neutralAtom}
                </span>
              </>
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
