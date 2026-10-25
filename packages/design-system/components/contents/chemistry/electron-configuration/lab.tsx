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
import { Array as Arr, Result } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";

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
  const [store] = useState(() =>
    createShellModelSampleStore<ElectronConfigurationSampleId>(HYDROGEN_ID)
  );
  const selectedSampleId = useStore(store, (state) => state.sampleId);
  const selectSample = useStore(store, (state) => state.selectSample);
  const selectedSample = ELECTRON_CONFIGURATION_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const t = useTranslations("Common");
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
      </VisualCardToolbar>

      <ShellModelCanvas
        aria-label={`${selectedLabels.name}, ${labels.electronTotal} ${selectedSample.atomicNumber}`}
        outerShellKey={outerShell.key}
        sample={selectedSample}
        shells={shellConfiguration}
      />

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.note} />
          <VisualFact
            label={labels.atomicNumber}
            value={<InlineMath math={`Z = ${selectedSample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.electronTotal}
            value={<InlineMath math={`e^- = ${selectedSample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.configuration}
            value={<InlineMath math={`${configurationMath}`} />}
          />
          <VisualFact
            label={labels.outerShell}
            value={<InlineMath math={`\\mathrm{${outerShell.key}}`} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
