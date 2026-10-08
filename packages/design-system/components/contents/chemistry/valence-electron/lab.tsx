"use client";

import { ShellModelCanvas } from "@repo/design-system/components/contents/chemistry/shell-model/canvas";
import {
  CALCIUM_ID,
  getValenceElectronFacts,
  isValenceElectronSampleId,
  VALENCE_ELECTRON_SAMPLE_IDS,
  VALENCE_ELECTRON_SAMPLES,
  type ValenceElectronLabLabels,
  type ValenceElectronSampleId,
} from "@repo/design-system/components/contents/chemistry/valence-electron/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useState } from "react";

interface ValenceElectronLabProps {
  description: ReactNode;
  labels: ValenceElectronLabLabels;
  title: ReactNode;
}

/** Renders a 3D reader for valence electrons in neutral atoms. */
export function ValenceElectronLab({
  title,
  description,
  labels,
}: ValenceElectronLabProps) {
  const [selectedSampleId, setSelectedSampleId] =
    useState<ValenceElectronSampleId>(CALCIUM_ID);
  const selectedSample = VALENCE_ELECTRON_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const facts = getValenceElectronFacts(selectedSample.atomicNumber);

  /** Keeps the current atom selected when ToggleGroup emits an empty value. */
  function handleSampleChange(value: string) {
    if (!value) {
      return;
    }

    if (!isValenceElectronSampleId(value)) {
      return;
    }

    setSelectedSampleId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseAtom}
          gridColumns="4"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {VALENCE_ELECTRON_SAMPLE_IDS.map((sampleId) => {
            const sample = VALENCE_ELECTRON_SAMPLES[sampleId];

            return (
              <ToggleGroupItem
                aria-label={labels.samples[sampleId].name}
                key={sampleId}
                value={sampleId}
              >
                <InlineMath math={`\\mathrm{${sample.symbol}}`} />
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        <ShellModelCanvas
          aria-label={`${selectedLabels.name}, ${labels.valenceElectron} ${facts.valenceElectronCount}`}
          outerShellKey={facts.outerShell.key}
          sample={selectedSample}
          shells={facts.shellConfiguration}
        />

        <p className="mx-auto max-w-3xl text-center text-muted-foreground text-sm leading-relaxed">
          {selectedLabels.note}
        </p>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <ValenceFact
            label={labels.valenceElectron}
            value={<InlineMath math={`${facts.valenceElectronCount}`} />}
          />
          <ValenceFact
            label={labels.outerShell}
            value={<InlineMath math={`\\mathrm{${facts.outerShell.key}}`} />}
          />
          <ValenceFact
            label={labels.configuration}
            value={<InlineMath math={facts.configurationMath} />}
          />
          <ValenceFact
            className="sm:col-span-3"
            label={labels.behavior}
            value={selectedLabels.tendency}
          />
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Presents one compact fact about the selected atom. */
function ValenceFact({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
