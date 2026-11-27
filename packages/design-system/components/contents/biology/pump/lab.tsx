import type {
  TransportDirection,
  TransportMode,
} from "@repo/design-system/components/contents/biology/pump/model";
import { evaluateTransport } from "@repo/design-system/components/contents/biology/pump/model";
import { MembranePumpScene } from "@repo/design-system/components/contents/biology/pump/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function ActiveTransportPumpLab({
  description,
  gradient,
  labels,
  modes,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly gradient: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly atpUse?: ReactNode;
    readonly direction?: ReactNode;
    readonly directions: Readonly<Record<TransportDirection, string>>;
    readonly gradient: string;
    readonly mode: string;
    readonly modes: Readonly<
      Partial<
        Record<
          TransportMode,
          { readonly mechanism: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "adp" | "atp" | "bilayer" | "carrierPump" | "channelProtein" | "solute",
        string
      >
    >;
    readonly view: string;
  };
  readonly modes: readonly [TransportMode, ...TransportMode[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<TransportMode>(modes[0]);
  const [gradVal, setGradVal] = useState(gradient.value);

  const active = Arr.contains(modes, selected) ? selected : modes[0];
  const reading = evaluateTransport(active, gradVal);
  const modeCopy = labels.modes[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(modes[0]);
          setGradVal(gradient.value);
        }}
      />

      <VisualCardToolbar>
        {modes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.mode}
            gridColumns={toggleColumns(modes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(modes, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(modes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.modes[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.gradient}
          label={labels.gradient}
          max={gradient.max}
          min={gradient.min}
          onValueChange={setGradVal}
          readout={`${Math.round(gradVal)}`}
          step={Math.max(1, (gradient.max - gradient.min) / 100)}
          value={gradVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <MembranePumpScene mode={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {modeCopy === undefined ? null : (
            <VisualFact label={labels.mode} value={modeCopy.mechanism} />
          )}
          {labels.direction === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={
                reading.direction === "againstGradient"
                  ? HOMEOSTASIS_COLORS.carrierPump
                  : HOMEOSTASIS_COLORS.channelProtein
              }
              label={labels.direction}
              value={labels.directions[reading.direction]}
            />
          )}
          {labels.atpUse === undefined ? null : (
            <VisualFactTabular
              label={labels.atpUse}
              value={`${reading.atpPerCycle} ATP`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
