import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { SynthesisRoute } from "@repo/design-system/components/contents/chemistry/economy/model";
import { AtomEconomyScene } from "@repo/design-system/components/contents/chemistry/economy/scene";
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
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function AtomEconomyReactorLab({
  description,
  labels,
  routes,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly atomEconomy?: ReactNode;
    readonly parts: Readonly<
      Record<
        "byproductWaste" | "desiredProduct" | "reactantFeed" | "reactorChamber",
        string
      >
    >;
    readonly route: string;
    readonly routes: Readonly<
      Partial<
        Record<
          SynthesisRoute,
          {
            readonly economy: ReactNode;
            readonly name: ReactNode;
            readonly wasteNote: ReactNode;
          }
        >
      >
    >;
    readonly view: string;
    readonly wasteNote?: ReactNode;
  };
  readonly routes: readonly [SynthesisRoute, ...SynthesisRoute[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<SynthesisRoute>(routes[0]);
  const active = Arr.contains(routes, selected) ? selected : routes[0];
  const copy = labels.routes[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(routes[0]);
        }}
      />

      {routes.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.route}
            gridColumns={toggleColumns(routes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(routes, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(routes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.routes[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.95} setting="lab">
          <Suspense fallback={null}>
            <AtomEconomyScene parts={labels.parts} route={active} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "addition"
                ? PROCESS_COLORS.greenProduct
                : PROCESS_COLORS.oleumAmber
            }
            label={labels.route}
            value={copy?.name ?? active}
          />
          {labels.atomEconomy === undefined || copy === undefined ? null : (
            <VisualFact label={labels.atomEconomy} value={copy.economy} />
          )}
          {labels.wasteNote === undefined || copy === undefined ? null : (
            <VisualFact label={labels.wasteNote} value={copy.wasteNote} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
