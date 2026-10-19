"use client";

import { ShellModelCanvas } from "@repo/design-system/components/contents/chemistry/shell-model/canvas";
import { createShellModelSampleStore } from "@repo/design-system/components/contents/chemistry/shell-model/store";
import {
  CALCIUM_ID,
  getValenceElectronFacts,
  isValenceElectronSampleId,
  VALENCE_ELECTRON_SAMPLE_IDS,
  VALENCE_ELECTRON_SAMPLES,
  type ValenceElectronSampleId,
} from "@repo/design-system/components/contents/chemistry/valence-electron/data";
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
import { Array as Arr, Result } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import { useStore } from "zustand";

interface ValenceElectronLabProps {
  description: ReactNode;
  labels: {
    atomicNumber: string;
    behavior: string;
    chooseAtom: string;
    configuration: string;
    outerShell: string;
    samples: Record<
      ValenceElectronSampleId,
      {
        name: string;
        note: ReactNode;
        tab: string;
        tendency: ReactNode;
      }
    >;
    valenceElectron: string;
  };
  title: ReactNode;
}

/** Renders a 3D reader for valence electrons in neutral atoms. */
export function ValenceElectronLab({
  title,
  description,
  labels,
}: ValenceElectronLabProps) {
  const [store] = useState(() =>
    createShellModelSampleStore<ValenceElectronSampleId>(CALCIUM_ID)
  );
  const selectedSampleId = useStore(store, (state) => state.sampleId);
  const selectSample = useStore(store, (state) => state.selectSample);
  const selectedSample = VALENCE_ELECTRON_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const t = useTranslations("Common");
  const facts = Result.getOrThrow(
    getValenceElectronFacts(selectedSample.atomicNumber)
  );

  /** Keeps the current atom selected when ToggleGroup emits an empty value. */
  function handleSampleChange(value: string) {
    if (!value) {
      return;
    }

    if (!isValenceElectronSampleId(value)) {
      return;
    }

    selectSample(value);
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
          {Arr.map(VALENCE_ELECTRON_SAMPLE_IDS, (sampleId) => {
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
      </VisualCardToolbar>

      <ShellModelCanvas
        aria-label={`${selectedLabels.name}, ${labels.valenceElectron} ${facts.valenceElectronCount}`}
        outerShellKey={facts.outerShell.key}
        sample={selectedSample}
        shells={facts.shellConfiguration}
      />

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.note} />
          <VisualFact
            label={labels.valenceElectron}
            value={<InlineMath math={`${facts.valenceElectronCount}`} />}
          />
          <VisualFact
            label={labels.outerShell}
            value={<InlineMath math={`\\mathrm{${facts.outerShell.key}}`} />}
          />
          <VisualFact
            label={labels.configuration}
            value={<InlineMath math={facts.configurationMath} />}
          />
          <VisualFact label={labels.behavior} value={selectedLabels.tendency} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
