"use client";

import {
  ATOM_SHELL_SAMPLE_IDS,
  ATOM_SHELL_SAMPLES,
  type AtomShellSampleId,
  CALCIUM_ID,
  getEarlyElementShellConfiguration,
  isAtomShellSampleId,
} from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import { ShellModelCanvas } from "@repo/design-system/components/contents/chemistry/shell-model/canvas";
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
import { Array as Arr, Result } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";

interface AtomShellLabProps {
  description: ReactNode;
  labels: {
    atomicNumber: string;
    chooseAtom: string;
    configuration: string;
    electronTotal: string;
    maximumCapacity: string;
    outerShell: string;
    samples: Record<
      AtomShellSampleId,
      {
        name: string;
        note: ReactNode;
        tab: string;
      }
    >;
  };
  title: ReactNode;
}

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
  const shellResult = getEarlyElementShellConfiguration(
    selectedSample.atomicNumber
  );
  if (Result.isFailure(shellResult)) {
    throw shellResult.failure;
  }
  const shellConfiguration = shellResult.success;
  const visibleShells = Arr.filter(
    shellConfiguration,
    (shell) => shell.electronCount > 0
  );
  const outerShell = visibleShells.at(-1);
  const configurationMath = Arr.join(
    Arr.map(visibleShells, (shell) => String(shell.electronCount)),
    ", "
  );

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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseAtom}
          gridColumns="6"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {Arr.map(ATOM_SHELL_SAMPLE_IDS, (sampleId) => {
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
      </VisualCardBody>

      <VisualCardFooter>
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
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
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
