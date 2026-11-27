import type { IsotopeSampleId } from "@repo/design-system/components/contents/chemistry/isotope/data";
import {
  HYDROGEN_1_ID,
  ISOTOPE_SAMPLE_IDS,
  ISOTOPE_SAMPLES,
  isIsotopeSampleId,
} from "@repo/design-system/components/contents/chemistry/isotope/data";
import { NuclideScene } from "@repo/design-system/components/contents/chemistry/isotope/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";

interface IsotopeLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    abundance: string;
    atomicNumber: string;
    chooseIsotope: string;
    electrons: string;
    massNumber: string;
    neutrons: string;
    protons: string;
    samples: Record<
      IsotopeSampleId,
      {
        abundance: ReactNode;
        ariaName: string;
        name: ReactNode;
        note: ReactNode;
        tab: ReactNode;
      }
    >;
  };
  title: NonNullable<ReactNode>;
}

/**
 * Renders a compact lab for comparing isotopes by their neutron count.
 */
export function IsotopeLab({ title, description, labels }: IsotopeLabProps) {
  const [selectedSampleId, setSelectedSampleId] =
    useState<IsotopeSampleId>(HYDROGEN_1_ID);
  const selectedSample = ISOTOPE_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const neutronCount = selectedSample.massNumber - selectedSample.atomicNumber;
  const electronCount = selectedSample.atomicNumber;

  /**
   * Keeps one isotope selected when ToggleGroup emits an empty value.
   */
  function handleSampleChange(value: string) {
    if (!value) {
      return;
    }

    if (!isIsotopeSampleId(value)) {
      return;
    }

    setSelectedSampleId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseIsotope}
          gridColumns="3"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {Arr.map(ISOTOPE_SAMPLE_IDS, (sampleId) => (
            <ToggleGroupItem
              aria-label={labels.samples[sampleId].ariaName}
              key={sampleId}
              value={sampleId}
            >
              {labels.samples[sampleId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={`${selectedLabels.ariaName}, ${labels.massNumber} ${selectedSample.massNumber}, ${labels.protons}: ${selectedSample.atomicNumber}, ${labels.neutrons}: ${neutronCount}`}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={4} setting="space">
          <NuclideScene
            neutrons={neutronCount}
            notation={selectedLabels.name}
            protons={selectedSample.atomicNumber}
          />
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.atomicNumber}
            value={<InlineMath math={`Z = ${selectedSample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.massNumber}
            value={<InlineMath math={`A = ${selectedSample.massNumber}`} />}
          />
          <VisualFact
            label={labels.neutrons}
            value={
              <InlineMath
                math={`n^0 = ${selectedSample.massNumber} - ${selectedSample.atomicNumber} = ${neutronCount}`}
              />
            }
          />
          <VisualFact
            label={labels.abundance}
            value={selectedLabels.abundance}
          />
          <VisualFact
            label={labels.protons}
            value={<InlineMath math={`${selectedSample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.electrons}
            value={<InlineMath math={`${electronCount}`} />}
          />
          <VisualFact label={labels.neutrons} value={selectedLabels.note} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
