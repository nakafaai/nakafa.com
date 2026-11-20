import {
  HOOP_COLORS,
  LETTERS,
} from "@repo/design-system/components/contents/mathematics/venn/mat";
import { VennScene } from "@repo/design-system/components/contents/mathematics/venn/scene";
import {
  OPERATION_MATH,
  OPERATION_TEXT,
  regionOf,
  selects,
  type VennAttribute,
  type VennObject,
  type VennOperation,
} from "@repo/design-system/components/contents/mathematics/venn/sets";
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
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

/** How far the mat, its hoops and the tray reach from their middle, in metres. */
const REACH = 1.2;

/** How many columns the toolbar lays the operations in, so each one's notation keeps its width. */
function toolbarColumns(count: number) {
  if (count <= 2) {
    return "2";
  }
  return count === 3 ? "3" : "4";
}

/**
 * Operations on sets, seen on real objects. Everyday objects wait on a tray
 * in front of a canvas mat, the universal set; on the mat lie two or three
 * hula hoops, the sets, each gathering every object with one attribute, such
 * as red or made of metal. Playing carries each object into its region, so
 * an object of two sets lands where their hoops overlap. The learner picks
 * an operation: its region is tinted on the mat, and the objects it selects
 * rise in a ring of light while the rest darken. Under the operations, each
 * set is written as its letter and what it gathers, in its hoop's colour.
 * With `showCount`, the footer reads how many objects the operation selects
 * and which they are.
 */
export function VennSortLab({
  description,
  labels,
  objects,
  operations,
  sets,
  showCount = false,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly count: ReactNode;
    readonly members: ReactNode;
    readonly operation: string;
    readonly viewLabel: string;
  };
  readonly objects: readonly {
    readonly name: string;
    readonly object: VennObject;
  }[];
  readonly operations: readonly [VennOperation, ...VennOperation[]];
  readonly sets: readonly {
    readonly attribute: VennAttribute;
    readonly name: string;
  }[];
  readonly showCount?: boolean;
  readonly title: NonNullable<ReactNode>;
}) {
  const [operation, setOperation] = useState<VennOperation>(operations[0]);
  const attributes = useMemo(
    () => Arr.map(sets, (set) => set.attribute),
    [sets]
  );
  const regions = useMemo(
    () => Arr.map(objects, (each) => regionOf(each.object, attributes)),
    [attributes, objects]
  );
  const chosen = Arr.filter(objects, (_each, index) =>
    selects(operation, Arr.getUnsafe(regions, index))
  );
  const math = OPERATION_MATH[operation];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.operation}
          gridColumns={toolbarColumns(operations.length)}
          onValueChange={(value: string) => {
            Option.map(
              Arr.findFirst(operations, (each) => each === value),
              setOperation
            );
          }}
          type="single"
          value={operation}
          variant="outline"
        >
          {Arr.map(operations, (each) => (
            <ToggleGroupItem
              aria-label={OPERATION_TEXT[each]}
              key={each}
              value={each}
            >
              <InlineMath math={OPERATION_MATH[each]} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={REACH} setting="studio">
          <Suspense fallback={null}>
            <VennScene
              objects={Arr.map(objects, (each) => each.object)}
              operation={operation}
              regions={regions}
              sets={sets.length}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(sets, (set, index) => (
            <VisualFactIndicator
              indicatorColor={HOOP_COLORS[index]}
              key={LETTERS[index]}
              label={<InlineMath math={LETTERS[index]} />}
              value={`{${set.name}}`}
            />
          ))}
          {showCount ? (
            <>
              <VisualFactTabular
                label={labels.count}
                value={<InlineMath math={`n(${math}) = ${chosen.length}`} />}
              />
              <VisualFactTabular
                label={labels.members}
                value={
                  <span>
                    <InlineMath math={`${math} =`} />{" "}
                    {chosen.length === 0
                      ? "{ }"
                      : `{ ${Arr.join(
                          Arr.map(chosen, (each) => each.name),
                          ", "
                        )} }`}
                  </span>
                }
              />
            </>
          ) : null}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
