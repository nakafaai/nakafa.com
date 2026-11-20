import {
  binaryMath,
  clampCount,
  digitsOf,
  type Grouping,
  GroupingSchema,
  groupedMath,
  inBase,
  largestCount,
  nextCount,
} from "@repo/design-system/components/contents/mathematics/binary/bits";
import {
  BinaryScene,
  PanelCounter,
} from "@repo/design-system/components/contents/mathematics/binary/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { Array as Arr, Option } from "effect";
import { type ReactNode, Suspense, useState } from "react";

/** The groupings in the order the toolbar offers them. */
const GROUPINGS = GroupingSchema.literals;

/**
 * A number in base two as a row of lamps on a counting panel. Each lamp is
 * one place value, a power of two, and is on when its digit is 1; its switch
 * shows the same digit. The learner picks the number, or presses play to
 * watch the panel count up and carry, and reads the same row in pairs for
 * base four or in threes for base eight, each group making one digit of the
 * other base. Without `showReadout`, as in a question that asks for the
 * number, the slider hides its number, the groups show no digit, and the
 * footer lists nothing.
 */
export function BinaryLampLab({
  bits,
  description,
  labels,
  showReadout = false,
  title,
  value,
}: {
  readonly bits: number;
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly binary: ReactNode;
    readonly decimal: ReactNode;
    readonly grouped: ReactNode;
    readonly grouping: string;
    readonly groups: Readonly<Record<Grouping, string>>;
    readonly value: string;
    readonly viewLabel: string;
  };
  readonly showReadout?: boolean;
  readonly title: NonNullable<ReactNode>;
  readonly value: number;
}) {
  const [count, setCount] = useState(() => clampCount(value, bits));
  const [grouping, setGrouping] = useState<Grouping>("none");

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 items-center">
          <Slider
            aria-label={labels.value}
            max={largestCount(bits)}
            min={0}
            onValueChange={(next: number) => setCount(clampCount(next, bits))}
            step={1}
            value={count}
          />
        </div>
        <ToggleGroup
          aria-label={labels.grouping}
          gridColumns="3"
          onValueChange={(next: string) => {
            Option.map(
              Arr.findFirst(GROUPINGS, (each) => each === next),
              setGrouping
            );
          }}
          type="single"
          value={grouping}
          variant="outline"
        >
          {Arr.map(GROUPINGS, (each) => (
            <ToggleGroupItem key={each} value={each}>
              {labels.groups[each]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.6} setting="lab">
          <PanelCounter
            onCount={(counts) => {
              setCount((shown) =>
                Arr.reduce(Arr.range(1, counts), shown, (each) =>
                  nextCount(each, bits)
                )
              );
            }}
          />
          <Suspense fallback={null}>
            <BinaryScene
              bits={bits}
              digits={digitsOf(count, bits)}
              grouping={grouping}
              showDigits={showReadout}
              value={count}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      {showReadout ? (
        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFactTabular
              label={labels.binary}
              value={<InlineMath math={binaryMath(count, bits)} />}
            />
            <VisualFactTabular
              label={labels.grouped}
              value={<InlineMath math={groupedMath(count, bits, grouping)} />}
            />
            <VisualFactTabular
              label={labels.decimal}
              value={<InlineMath math={inBase(count, 10)} />}
            />
          </VisualCardFacts>
        </VisualCardFooter>
      ) : null}
    </VisualCard>
  );
}
