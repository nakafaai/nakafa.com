"use client";

import {
  ATOM_SHELL_SAMPLE_IDS,
  ATOM_SHELL_SAMPLES,
  type AtomShellLabProps,
  type AtomShellSampleId,
  CALCIUM_ID,
  getEarlyElementShellConfiguration,
  isAtomShellSampleId,
} from "@repo/design-system/components/contents/chemistry/atom-shell/data";
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

/** Renders a 3D Bohr shell reader for neutral atoms up to calcium. */
export function AtomShellLab({
  title,
  description,
  labels,
}: AtomShellLabProps) {
  const [selectedSampleId, setSelectedSampleId] =
    useState<AtomShellSampleId>(CALCIUM_ID);
  const selectedSample = ATOM_SHELL_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const shellConfiguration = getEarlyElementShellConfiguration(
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
    throw new Error("Atom shell lab requires at least one occupied shell.");
  }

  /** Keeps the current atom selected when ToggleGroup emits an empty value. */
  function handleSampleChange(value: string) {
    if (!value) {
      return;
    }

    if (!isAtomShellSampleId(value)) {
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
          className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          layout="grid"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {ATOM_SHELL_SAMPLE_IDS.map((sampleId) => {
            const sample = ATOM_SHELL_SAMPLES[sampleId];

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
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <LabFact
            label={labels.atomicNumber}
            value={<InlineMath math={`Z = ${selectedSample.atomicNumber}`} />}
          />
          <LabFact
            label={labels.configuration}
            value={<InlineMath math={`${configurationMath}`} />}
          />
          <LabFact
            label={labels.outerShell}
            value={<InlineMath math={`\\mathrm{${outerShell.key}}`} />}
          />
          <LabFact
            label={labels.maximumCapacity}
            value={
              <InlineMath
                math={`2(${outerShell.principalQuantumNumber})^2 = ${outerShell.maximumElectrons}`}
              />
            }
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

/** Renders one compact fact in the shell lab footer. */
function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
