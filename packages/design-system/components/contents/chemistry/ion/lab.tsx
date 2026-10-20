import { ArrowDown02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import {
  ION_SAMPLE_IDS,
  ION_SAMPLES,
  type IonSampleId,
  isIonSampleId,
  SODIUM_CATION_ID,
} from "@repo/design-system/components/contents/chemistry/ion/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";

interface IonLabProps {
  description: ReactNode;
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
  title: ReactNode;
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
  const neutralNotation = `{}^{${selectedSample.massNumber}}_{${selectedSample.atomicNumber}}\\mathrm{${selectedSample.symbol}}`;
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

      <VisualCardBody className="grid gap-2 p-(--card-spacing) md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] md:items-center [[data-fullscreen]>&]:grid">
        <ParticleCard
          charge={<InlineMath math="0" />}
          electrons={<InlineMath math={`${neutralElectrons}`} />}
          labels={labels}
          notation={neutralNotation}
          stage={labels.beforeChange}
          title={labels.neutralAtom}
        />

        <section
          aria-label={labels.electronChange}
          className="grid min-h-10 place-items-center text-3xl text-muted-foreground md:min-h-44"
        >
          <HugeIcons
            aria-hidden="true"
            className="size-7 md:hidden"
            icon={ArrowDown02Icon}
          />
          <HugeIcons
            aria-hidden="true"
            className="hidden size-7 md:block"
            icon={ArrowRight02Icon}
          />
        </section>

        <ParticleCard
          charge={<InlineMath math={signedChargeMath} />}
          electrons={<InlineMath math={`${ionElectrons}`} />}
          labels={labels}
          notation={ionNotation}
          stage={labels.afterChange}
          title={selectedLabels.type}
        />
      </VisualCardBody>

      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>

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
 * Shows either the neutral atom card or the resulting ion card.
 */
function ParticleCard({
  charge,
  electrons,
  labels,
  notation,
  stage,
  title,
}: {
  charge: ReactNode;
  electrons: ReactNode;
  labels: IonLabProps["labels"];
  notation: string;
  stage: string;
  title: string;
}) {
  return (
    <section
      aria-label={`${stage}: ${title}`}
      className="grid min-h-44 place-items-center p-3 text-center"
    >
      <div className="flex w-full max-w-64 flex-col gap-4">
        <div className="space-y-1">
          <div className="font-medium text-sm">{stage}</div>
          <div className="text-muted-foreground text-sm">{title}</div>
        </div>
        <div className="text-5xl sm:text-6xl">
          <InlineMath math={notation} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <VisualFact label={labels.electrons} value={electrons} />
          <VisualFact label={labels.charge} value={charge} />
        </dl>
      </div>
    </section>
  );
}
