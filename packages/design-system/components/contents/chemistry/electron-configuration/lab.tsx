"use client";

import {
  ELECTRON_CONFIGURATION_SAMPLE_IDS,
  ELECTRON_CONFIGURATION_SAMPLES,
  type ElectronConfigurationLabProps,
  type ElectronConfigurationSampleId,
  getSimpleShellConfiguration,
  HYDROGEN_ID,
  isElectronConfigurationSampleId,
} from "@repo/design-system/components/contents/chemistry/electron-configuration/data";
import { ShellModelCanvas } from "@repo/design-system/components/contents/chemistry/shell-model/canvas";
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
 * Renders an interactive shell-model reader for simple electron configurations.
 */
export function ElectronConfigurationLab({
  title,
  description,
  labels,
}: ElectronConfigurationLabProps) {
  const [selectedSampleId, setSelectedSampleId] =
    useState<ElectronConfigurationSampleId>(HYDROGEN_ID);
  const selectedSample = ELECTRON_CONFIGURATION_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const shellConfiguration = getSimpleShellConfiguration(
    selectedSample.atomicNumber
  );
  const visibleShells = shellConfiguration.filter(
    (shell) => shell.electronCount > 0
  );
  const outerShell = visibleShells.at(-1);
  const configurationMath = visibleShells
    .map((shell) => shell.electronCount)
    .join(", ");

  if (!outerShell) {
    throw new Error("Electron configuration requires at least one shell.");
  }

  /**
   * Keeps one atom selected when ToggleGroup emits an empty value.
   */
  function handleSampleChange(value: string) {
    if (!value) {
      return;
    }

    if (!isElectronConfigurationSampleId(value)) {
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
          {ELECTRON_CONFIGURATION_SAMPLE_IDS.map((sampleId) => {
            const sample = ELECTRON_CONFIGURATION_SAMPLES[sampleId];

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
          aria-label={`${selectedLabels.name}, ${labels.electronTotal} ${selectedSample.atomicNumber}`}
          outerShellKey={outerShell.key}
          sample={selectedSample}
          shells={shellConfiguration}
        />

        <p className="mx-auto max-w-3xl text-center text-muted-foreground text-sm leading-relaxed">
          {selectedLabels.note}
        </p>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-4">
          <LabFact
            label={labels.atomicNumber}
            value={<InlineMath math={`Z = ${selectedSample.atomicNumber}`} />}
          />
          <LabFact
            label={labels.electronTotal}
            value={<InlineMath math={`e^- = ${selectedSample.atomicNumber}`} />}
          />
          <LabFact
            label={labels.configuration}
            value={<InlineMath math={`${configurationMath}`} />}
          />
          <LabFact
            label={labels.outerShell}
            value={<InlineMath math={`\\mathrm{${outerShell.key}}`} />}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

/**
 * Renders one compact fact in the lab footer.
 */
function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
