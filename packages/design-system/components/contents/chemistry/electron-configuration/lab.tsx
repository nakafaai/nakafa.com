"use client";

import { getOuterOccupiedShell } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import {
  ELECTRON_CONFIGURATION_SAMPLE_IDS,
  ELECTRON_CONFIGURATION_SAMPLES,
  type ElectronConfigurationSampleId,
  getSimpleShellConfiguration,
  HYDROGEN_ID,
  isElectronConfigurationSampleId,
} from "@repo/design-system/components/contents/chemistry/electron-configuration/data";
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

interface ElectronConfigurationLabProps {
  description: ReactNode;
  labels: {
    atomicNumber: string;
    chooseAtom: string;
    configuration: string;
    electronTotal: string;
    outerShell: string;
    samples: Record<
      ElectronConfigurationSampleId,
      {
        name: string;
        note: ReactNode;
      }
    >;
  };
  title: ReactNode;
}

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
  const shellConfiguration = Result.getOrThrow(
    getSimpleShellConfiguration(selectedSample.atomicNumber)
  );
  const visibleShells = Arr.filter(
    shellConfiguration,
    (shell) => shell.electronCount > 0
  );
  const outerShell = getOuterOccupiedShell(shellConfiguration);
  const configurationMath = Arr.join(
    Arr.map(visibleShells, (shell) => String(shell.electronCount)),
    ", "
  );

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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-5">
        <ToggleGroup
          aria-label={labels.chooseAtom}
          gridColumns="4"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {Arr.map(ELECTRON_CONFIGURATION_SAMPLE_IDS, (sampleId) => {
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
      </VisualCardBody>

      <VisualCardFooter>
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
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
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
