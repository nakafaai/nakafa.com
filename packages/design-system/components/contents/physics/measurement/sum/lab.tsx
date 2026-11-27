import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import {
  CopperToolSchema,
  joinedRods,
} from "@repo/design-system/components/contents/physics/measurement/sum/rods";
import { JoinScene } from "@repo/design-system/components/contents/physics/measurement/sum/scene";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface DecimalSumLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseTool: string;
    copper: ReactNode;
    iron: ReactNode;
    raw: ReactNode;
    reported: ReactNode;
    tools: Record<typeof CopperToolSchema.Type, ReactNode>;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * An iron rod read with a caliper joined to a copper rod read with a ruler
 * or the caliper. The joined end carries the band where it may really lie:
 * a ruler reading widens it past every hundredth, so the sum keeps one decimal.
 */
export function DecimalSumLab({
  description,
  labels,
  title,
}: DecimalSumLabProps) {
  const [tool, setTool] = useState<typeof CopperToolSchema.Type>("ruler");
  const fixed = useFixed();
  const rods = joinedRods(tool);
  const isTool = Schema.is(CopperToolSchema);

  return (
    <VisualCard
      onReset={() => {
        setTool("ruler");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseTool}
          gridColumns="2"
          onValueChange={(value) => {
            if (isTool(value)) {
              setTool(value);
            }
          }}
          type="single"
          value={tool}
          variant="outline"
        >
          {Arr.map(CopperToolSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.tools[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={1.2} setting="lab">
          <Suspense fallback={null}>
            <JoinScene tool={tool} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.iron}
            value={
              <InlineMath
                math={fixed(rods.iron, "\\text{ cm}", rods.ironDecimals)}
              />
            }
          />
          <VisualFactTabular
            label={labels.copper}
            value={
              <InlineMath
                math={fixed(rods.copper, "\\text{ cm}", rods.copperDecimals)}
              />
            }
          />
          <VisualFactTabular
            label={labels.raw}
            value={
              <InlineMath
                math={fixed(rods.raw, "\\text{ cm}", rods.ironDecimals)}
              />
            }
          />
          <VisualFactTabular
            label={labels.reported}
            value={
              <InlineMath
                math={fixed(rods.reported, "\\text{ cm}", rods.decimals)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
