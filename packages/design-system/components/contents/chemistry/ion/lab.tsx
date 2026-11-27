import type { IonSampleId } from "@repo/design-system/components/contents/chemistry/ion/data";
import {
  ION_SAMPLE_IDS,
  ION_SAMPLES,
  isIonSampleId,
  SODIUM_CATION_ID,
} from "@repo/design-system/components/contents/chemistry/ion/data";
import {
  IonParticle,
  IonScene,
} from "@repo/design-system/components/contents/chemistry/ion/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";

interface IonLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    afterChange: string;
    beforeChange: string;
    charge: string;
    chooseIon: string;
    electronChange: string;
    electrons: string;
    neutralAtom: string;
    neutrons: string;
    protons: string;
    samples: Record<
      IonSampleId,
      {
        action: ReactNode;
        name: string;
        type: string;
      }
    >;
  };
  title: NonNullable<ReactNode>;
}

/**
 * Renders a compact lab for comparing a neutral atom with its ion.
 */
export function IonLab({ title, description, labels }: IonLabProps) {
  const [selectedSampleId, setSelectedSampleId] =
    useState<IonSampleId>(SODIUM_CATION_ID);
  const selectedSample = ION_SAMPLES[selectedSampleId];
  const selectedLabels = labels.samples[selectedSampleId];
  const neutralElectrons = selectedSample.atomicNumber;
  const ionElectrons = selectedSample.atomicNumber - selectedSample.charge;
  const neutronCount = selectedSample.massNumber - selectedSample.atomicNumber;
  const chargeMath = getChargeMath(selectedSample.charge);
  const electronFlowMath = `${neutralElectrons} \\rightarrow ${ionElectrons}`;
  const signedChargeMath = getSignedChargeMath(selectedSample.charge);
  const neutralNotation = `\\vphantom{X}^{${selectedSample.massNumber}}_{${selectedSample.atomicNumber}}\\mathrm{${selectedSample.symbol}}`;
  const ionNotation = `${neutralNotation}^{${chargeMath}}`;

  /**
   * Keeps one ion selected when ToggleGroup emits an empty value.
   */
  function handleSampleChange(value: string) {
    if (!value) {
      return;
    }

    if (!isIonSampleId(value)) {
      return;
    }

    setSelectedSampleId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseIon}
          gridColumns="4"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {Arr.map(ION_SAMPLE_IDS, (sampleId) => {
            const sample = ION_SAMPLES[sampleId];
            const ionFormula = `\\mathrm{${sample.symbol}}^{${getChargeMath(sample.charge)}}`;

            return (
              <ToggleGroupItem
                aria-label={labels.samples[sampleId].name}
                key={sampleId}
                value={sampleId}
              >
                <InlineMath math={ionFormula} />
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={`${labels.beforeChange}: ${labels.neutralAtom}, ${labels.afterChange}: ${selectedLabels.type}`}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={5} setting="space">
          <IonScene>
            <IonParticle
              electrons={neutralElectrons}
              heading={`${labels.beforeChange}: ${labels.neutralAtom}`}
              neutrons={neutronCount}
              protons={selectedSample.atomicNumber}
              side={-1}
            >
              <ParticleReadings
                charge="0"
                electrons={neutralElectrons}
                notation={neutralNotation}
              >
                {labels.electrons}
                {labels.charge}
              </ParticleReadings>
            </IonParticle>
            <IonParticle
              electrons={ionElectrons}
              heading={`${labels.afterChange}: ${selectedLabels.type}`}
              neutrons={neutronCount}
              protons={selectedSample.atomicNumber}
              side={1}
            >
              <ParticleReadings
                charge={signedChargeMath}
                electrons={ionElectrons}
                notation={ionNotation}
              >
                {labels.electrons}
                {labels.charge}
              </ParticleReadings>
            </IonParticle>
          </IonScene>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.electronChange}
            value={selectedLabels.action}
          />
          <VisualFact
            label={labels.electrons}
            value={<InlineMath math={`e^-: ${electronFlowMath}`} />}
          />
          <VisualFact
            label={labels.protons}
            value={<InlineMath math={`${selectedSample.atomicNumber}`} />}
          />
          <VisualFact
            label={labels.neutrons}
            value={
              <InlineMath
                math={`${selectedSample.massNumber} - ${selectedSample.atomicNumber} = ${neutronCount}`}
              />
            }
          />
          <VisualFact
            label={labels.charge}
            value={
              <InlineMath
                math={`q = p^+ - e^- = ${selectedSample.atomicNumber} - ${ionElectrons} = ${signedChargeMath}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Formats an ion charge as the superscript used in chemical notation.
 */
function getChargeMath(charge: number) {
  if (charge === 1) {
    return "+";
  }

  if (charge === -1) {
    return "-";
  }

  if (charge === 0) {
    return "0";
  }

  if (charge > 0) {
    return `${charge}+`;
  }

  return `${Math.abs(charge)}-`;
}

/**
 * Formats an ion charge as a signed arithmetic result.
 */
function getSignedChargeMath(charge: number) {
  if (charge > 0) {
    return `+${charge}`;
  }

  return `${charge}`;
}

/**
 * What is read under one particle: its notation, then its electron count and
 * its charge, each after the lesson's word for it. The two words are its
 * children, the word for electrons first.
 */
function ParticleReadings({
  charge,
  children,
  electrons,
  notation,
}: {
  readonly charge: string;
  readonly children: readonly [ReactNode, ReactNode];
  readonly electrons: number;
  readonly notation: string;
}) {
  return (
    <span className="flex flex-col items-center gap-1 whitespace-nowrap">
      <span>
        <InlineMath math={notation} />
      </span>
      <span>
        {children[0]}: <InlineMath math={`${electrons}`} />
      </span>
      <span>
        {children[1]}: <InlineMath math={charge} />
      </span>
    </span>
  );
}
