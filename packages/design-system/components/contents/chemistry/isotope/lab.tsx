"use client";

import {
  HYDROGEN_1_ID,
  ISOTOPE_SAMPLE_IDS,
  ISOTOPE_SAMPLES,
  type IsotopeLabProps,
  type IsotopeSampleId,
  isIsotopeSampleId,
} from "@repo/design-system/components/contents/chemistry/isotope/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";
import { useState } from "react";

const PARTICLE_CLASS_NAMES = {
  neutron: "bg-secondary text-secondary-foreground",
  proton: "bg-primary text-primary-foreground",
};

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
  const notation = `{}^{${selectedSample.massNumber}}_{${selectedSample.atomicNumber}}\\mathrm{${selectedSample.symbol}}`;

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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseIsotope}
          className="grid w-full grid-cols-2 sm:grid-cols-3"
          layout="grid"
          onValueChange={handleSampleChange}
          type="single"
          value={selectedSampleId}
          variant="outline"
        >
          {ISOTOPE_SAMPLE_IDS.map((sampleId) => (
            <ToggleGroupItem
              aria-label={labels.samples[sampleId].ariaName}
              key={sampleId}
              value={sampleId}
            >
              {labels.samples[sampleId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex flex-col gap-5 py-2">
          <section
            aria-label={`${selectedLabels.ariaName}, ${labels.massNumber} ${selectedSample.massNumber}`}
            className="grid gap-4 text-center"
          >
            <div className="grid place-items-center px-2 py-4">
              <div className="flex flex-col items-center gap-3">
                <div className="text-muted-foreground text-sm">
                  {selectedLabels.name}
                </div>
                <div className="text-5xl sm:text-6xl">
                  <InlineMath math={notation} />
                </div>
              </div>
            </div>

            <NucleusDots
              labels={labels}
              neutronCount={neutronCount}
              protonCount={selectedSample.atomicNumber}
            />
          </section>

          <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <IsotopeFact
              label={labels.atomicNumber}
              value={<InlineMath math={`Z = ${selectedSample.atomicNumber}`} />}
            />
            <IsotopeFact
              label={labels.massNumber}
              value={<InlineMath math={`A = ${selectedSample.massNumber}`} />}
            />
            <IsotopeFact
              label={labels.neutrons}
              value={
                <InlineMath
                  math={`n^0 = ${selectedSample.massNumber} - ${selectedSample.atomicNumber} = ${neutronCount}`}
                />
              }
            />
            <IsotopeFact
              label={labels.abundance}
              value={selectedLabels.abundance}
            />
          </dl>
        </div>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <IsotopeCount
            label={labels.protons}
            value={<InlineMath math={`${selectedSample.atomicNumber}`} />}
          />
          <IsotopeCount
            label={labels.electrons}
            value={<InlineMath math={`${electronCount}`} />}
          />
          <IsotopeCount label={labels.neutrons} value={selectedLabels.note} />
        </dl>
      </CardFooter>
    </Card>
  );
}

/**
 * Renders proton and neutron dots with generated counts, not hard-coded dots.
 */
function NucleusDots({
  labels,
  neutronCount,
  protonCount,
}: {
  labels: IsotopeLabProps["labels"];
  neutronCount: number;
  protonCount: number;
}) {
  const protons = Array.from(
    { length: protonCount },
    (_, protonIndex) => protonIndex
  );
  const neutrons = Array.from(
    { length: neutronCount },
    (_, neutronIndex) => neutronIndex
  );

  return (
    <div
      aria-label={`${labels.protons}: ${protonCount}, ${labels.neutrons}: ${neutronCount}`}
      className="flex w-full justify-center p-2"
      role="img"
    >
      <div className="flex max-w-sm flex-wrap justify-center gap-2">
        {protons.map((protonIndex) => (
          <ParticleDot
            key={`proton-${protonIndex}`}
            label="p^+"
            type="proton"
          />
        ))}
        {neutrons.map((neutronIndex) => (
          <ParticleDot
            key={`neutron-${neutronIndex}`}
            label="n^0"
            type="neutron"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders one stable-size nucleus particle marker.
 */
function ParticleDot({
  label,
  type,
}: {
  label: string;
  type: keyof typeof PARTICLE_CLASS_NAMES;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 place-items-center rounded-full font-medium text-xs",
        PARTICLE_CLASS_NAMES[type]
      )}
    >
      <InlineMath math={label} />
    </span>
  );
}

/**
 * Shows one isotope notation fact.
 */
function IsotopeFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Renders one compact particle count in the lab footer.
 */
function IsotopeCount({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
