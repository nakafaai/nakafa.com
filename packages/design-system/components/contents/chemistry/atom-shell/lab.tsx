"use client";

import {
  ATOM_SHELL_SAMPLE_IDS,
  ATOM_SHELL_SAMPLES,
  type AtomShellSampleId,
  CALCIUM_ID,
  isAtomShellSampleId,
} from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import { getAtomShellReadings } from "@repo/design-system/components/contents/chemistry/atom-shell/readings";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";

interface AtomShellLabProps {
  description?: ReactNode;
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
        name?: string;
        note?: ReactNode;
        tab: string;
      }
    >;
  };
  /**
   * Whether the three-dimensional model is mounted. A lab that is not live keeps
   * its whole card in place, with an empty frame where the model goes.
   */
  live?: boolean;
  title?: ReactNode;
}

/** Renders a 3D Bohr shell reader for neutral atoms up to calcium. */
export function AtomShellLab({
  title,
  description,
  labels,
  live = true,
}: AtomShellLabProps) {
  const [selectedSampleId, setSelectedSampleId] =
    useState<AtomShellSampleId>(CALCIUM_ID);
  const selectedSample = ATOM_SHELL_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const {
    configurationMath,
    outerShell,
    shells: shellConfiguration,
  } = getAtomShellReadings(selectedSample.atomicNumber);

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
          aria-label={`${selectedLabels.name ?? selectedSample.symbol}, ${labels.electronTotal} ${selectedSample.atomicNumber}`}
          live={live}
          outerShellKey={outerShell.key}
          sample={selectedSample}
          shells={shellConfiguration}
        />

        {selectedLabels.note === undefined ? null : (
          <p className="mx-auto max-w-3xl text-center text-muted-foreground text-sm leading-relaxed">
            {selectedLabels.note}
          </p>
        )}
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <VisualFact
            label={labels.atomicNumber}
            value={<InlineMath math={`Z = ${selectedSample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.configuration}
            value={<InlineMath math={`${configurationMath}`} />}
          />
          <VisualFact
            label={labels.outerShell}
            value={<InlineMath math={`\\mathrm{${outerShell.key}}`} />}
          />
          <VisualFact
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
