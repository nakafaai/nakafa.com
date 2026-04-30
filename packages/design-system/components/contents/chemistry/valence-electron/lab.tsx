"use client";

import { ShellModelCanvas } from "@repo/design-system/components/contents/chemistry/shell-model/canvas";
import {
  CALCIUM_ID,
  getValenceElectronFacts,
  isValenceElectronSampleId,
  VALENCE_ELECTRON_SAMPLE_IDS,
  VALENCE_ELECTRON_SAMPLES,
  type ValenceElectronLabProps,
  type ValenceElectronSampleId,
} from "@repo/design-system/components/contents/chemistry/valence-electron/data";
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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseAtom}
          className="grid w-full grid-cols-2 sm:grid-cols-4"
          layout="grid"
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
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
            label={labels.behavior}
            value={selectedLabels.tendency}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

/** Presents one compact fact about the selected atom. */
function ValenceFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
