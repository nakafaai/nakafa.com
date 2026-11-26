import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  NuclearProcess,
  NuclideId,
} from "@repo/design-system/components/contents/physics/binding/model";
import { nuclideSpec } from "@repo/design-system/components/contents/physics/binding/model";
import { NuclearBindingScene } from "@repo/design-system/components/contents/physics/binding/scene";
import { BindingCurveTrace } from "@repo/design-system/components/contents/physics/binding/trace";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
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
import {
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function NuclearBindingCurveLab({
  description,
  labels,
  nuclides,
  processes,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly bindingPerNucleon?: ReactNode;
    readonly massDefect?: ReactNode;
    readonly nuclide: string;
    readonly nuclides: Readonly<Partial<Record<NuclideId, string>>>;
    readonly parts: Readonly<
      Record<
        "fissionZone" | "fusionZone" | "ironPeak" | "neutron" | "proton",
        string
      >
    >;
    readonly process: string;
    readonly processes: Readonly<
      Partial<
        Record<
          NuclearProcess,
          { readonly detail: ReactNode; readonly name: string }
        >
      >
    >;
    readonly stability: ReactNode;
    readonly view: string;
  };
  readonly nuclides: readonly [NuclideId, ...NuclideId[]];
  readonly processes: readonly [NuclearProcess, ...NuclearProcess[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedNuclide, setSelectedNuclide] = useState<NuclideId>(
    nuclides[0]
  );
  const [selectedProcess, setSelectedProcess] = useState<NuclearProcess>(
    processes[0]
  );
  const quantity = useQuantity();

  const activeNuclide = Arr.contains(nuclides, selectedNuclide)
    ? selectedNuclide
    : nuclides[0];
  const activeProcess = Arr.contains(processes, selectedProcess)
    ? selectedProcess
    : processes[0];
  const spec = nuclideSpec(activeNuclide);
  const processCopy = labels.processes[activeProcess];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedNuclide(nuclides[0]);
          setSelectedProcess(processes[0]);
        }}
      />

      <VisualCardToolbar>
        {nuclides.length > 1 ? (
          <ToggleGroup
            aria-label={labels.nuclide}
            gridColumns={toggleColumns(nuclides.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(nuclides, (item) => item === next),
                setSelectedNuclide
              );
            }}
            type="single"
            value={activeNuclide}
            variant="outline"
          >
            {Arr.map(nuclides, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.nuclides[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {processes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.process}
            gridColumns={toggleColumns(processes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(processes, (item) => item === next),
                setSelectedProcess
              );
            }}
            type="single"
            value={activeProcess}
            variant="outline"
          >
            {Arr.map(processes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.processes[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="studio">
          <Suspense fallback={null}>
            <NuclearBindingScene
              nuclide={activeNuclide}
              parts={labels.parts}
              process={activeProcess}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <BindingCurveTrace
          active={activeNuclide}
          fissionLabel={labels.parts.fissionZone}
          fusionLabel={labels.parts.fusionZone}
          peakLabel={labels.parts.ironPeak}
        />
        <VisualCardFacts>
          {processCopy === undefined ? null : (
            <VisualFact label={labels.stability} value={processCopy.detail} />
          )}
          {labels.bindingPerNucleon === undefined ? null : (
            <VisualFactTabular
              label={labels.bindingPerNucleon}
              value={
                <InlineMath
                  math={quantity(spec.bindingPerNucleonMev, "\\text{ MeV}", 2)}
                />
              }
            />
          )}
          {labels.massDefect === undefined ? null : (
            <VisualFactTabular
              label={labels.massDefect}
              value={
                <InlineMath
                  math={quantity(spec.massDefectU, "\\text{ u}", 4)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
