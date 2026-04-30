"use client";

import { ArrowDown02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import {
  ION_SAMPLE_IDS,
  ION_SAMPLES,
  type IonLabProps,
  type IonSampleId,
  isIonSampleId,
  SODIUM_CATION_ID,
} from "@repo/design-system/components/contents/chemistry/ion/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import type { ReactNode } from "react";
import { useState } from "react";

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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <ToggleGroup
          aria-label={labels.chooseIon}
          className="grid w-full grid-cols-2 sm:grid-cols-4"
          layout="grid"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {ION_SAMPLE_IDS.map((sampleId) => {
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

        <div className="grid gap-2 py-2 md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] md:items-center">
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
        </div>

        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <IonFact
            label={labels.electronChange}
            value={selectedLabels.action}
          />
          <IonFact
            label={labels.electrons}
            value={<InlineMath math={`e^-: ${electronFlowMath}`} />}
          />
        </dl>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <IonFact
            label={labels.protons}
            value={<InlineMath math={`${selectedSample.atomicNumber}`} />}
          />
          <IonFact
            label={labels.neutrons}
            value={
              <InlineMath
                math={`${selectedSample.massNumber} - ${selectedSample.atomicNumber} = ${neutronCount}`}
              />
            }
          />
          <IonFact
            label={labels.charge}
            value={
              <InlineMath
                math={`q = p^+ - e^- = ${selectedSample.atomicNumber} - ${ionElectrons} = ${signedChargeMath}`}
              />
            }
          />
        </dl>
      </CardFooter>
    </Card>
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
          <IonMiniFact label={labels.electrons} value={electrons} />
          <IonMiniFact label={labels.charge} value={charge} />
        </dl>
      </div>
    </section>
  );
}

/**
 * Renders one compact value inside a particle card.
 */
function IonMiniFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Renders one compact ion fact.
 */
function IonFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
