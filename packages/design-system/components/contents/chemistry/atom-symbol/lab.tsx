"use client";

import {
  ATOM_SYMBOL_SAMPLE_IDS,
  ATOM_SYMBOL_SAMPLES,
  type AtomSymbolLabProps,
  type AtomSymbolSampleId,
  CARBON_12_ID,
  isAtomSymbolSampleId,
} from "@repo/design-system/components/contents/chemistry/atom-symbol/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import type { ReactNode } from "react";
import { useState } from "react";

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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <ToggleGroup
          aria-label={labels.chooseAtom}
          className="grid w-full grid-cols-2 sm:grid-cols-4"
          layout="grid"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {ATOM_SYMBOL_SAMPLE_IDS.map((sampleId) => (
            <ToggleGroupItem
              aria-label={labels.samples[sampleId].ariaName}
              key={sampleId}
              value={sampleId}
            >
              {labels.samples[sampleId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex flex-col gap-5 py-2">
          <section
            aria-label={`${selectedLabels.ariaName}, ${labels.massNumber} ${selectedSample.massNumber}, ${labels.atomicNumber} ${selectedSample.atomicNumber}`}
            className="grid min-h-44 place-items-center p-2 text-center sm:min-h-48"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="text-muted-foreground text-sm">
                {selectedLabels.name}
              </div>
              <div className="text-5xl sm:text-6xl">
                <InlineMath math={notation} />
              </div>
            </div>
          </section>

          <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <NotationFact
              label={labels.massNumber}
              value={<InlineMath math={`A = ${selectedSample.massNumber}`} />}
            />
            <NotationFact
              label={labels.atomicNumber}
              value={<InlineMath math={`Z = ${selectedSample.atomicNumber}`} />}
            />
            <NotationFact
              label={labels.elementSymbol}
              value={
                <InlineMath math={`X = \\mathrm{${selectedSample.symbol}}`} />
              }
            />
          </dl>
        </div>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <AtomCount
            label={labels.protonCount}
            value={<InlineMath math={`${selectedSample.atomicNumber}`} />}
          />
          <AtomCount
            label={labels.neutronCount}
            value={<InlineMath math={`${neutronCount}`} />}
          />
          <AtomCount
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
        </dl>
      </CardFooter>
    </Card>
  );
}

/**
 * Shows one part of the atomic notation without creating nested cards.
 */
function NotationFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Renders one compact particle count in the lab footer.
 */
function AtomCount({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
