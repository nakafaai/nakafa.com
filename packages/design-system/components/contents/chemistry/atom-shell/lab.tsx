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
import { createShellModelSampleStore } from "@repo/design-system/components/contents/chemistry/shell-model/store";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";

interface AtomShellLabProps {
  /** The sample the lab opens on. It starts at calcium when none is given. */
  defaultSampleId?: AtomShellSampleId | undefined;
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
  /** Reports each sample the reader picks, so a window can keep it while this lab is unmounted. */
  onSampleIdChange?: (sampleId: AtomShellSampleId) => void;
  title?: ReactNode;
}

/** Renders a 3D Bohr shell reader for neutral atoms up to calcium. */
export function AtomShellLab({
  defaultSampleId = CALCIUM_ID,
  title,
  description,
  labels,
  live = true,
  onSampleIdChange,
}: AtomShellLabProps) {
  const [store] = useState(() =>
    createShellModelSampleStore<AtomShellSampleId>(defaultSampleId)
  );
  const selectedSampleId = useStore(store, (state) => state.sampleId);
  const selectSample = useStore(store, (state) => state.selectSample);
  const selectedSample = ATOM_SHELL_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const t = useTranslations("Common");
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

    selectSample(value);
    onSampleIdChange?.(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
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
      </VisualCardToolbar>

      <ShellModelCanvas
        aria-label={`${selectedLabels.name ?? selectedSample.symbol}, ${labels.electronTotal} ${selectedSample.atomicNumber}`}
        live={live}
        outerShellKey={outerShell.key}
        sample={selectedSample}
        shells={shellConfiguration}
      />

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {selectedLabels.note === undefined ? null : (
            <VisualFact label={t("note")} value={selectedLabels.note} />
          )}
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
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
