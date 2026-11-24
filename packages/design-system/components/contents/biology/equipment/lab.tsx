import { PickProvider } from "@repo/design-system/components/contents/biology/equipment/pick";
import type {
  Category,
  Equipment,
} from "@repo/design-system/components/contents/biology/equipment/places";
import {
  categoriesOf,
  categoryOf,
  firstIn,
  itemsIn,
} from "@repo/design-system/components/contents/biology/equipment/places";
import { EquipmentScene } from "@repo/design-system/components/contents/biology/equipment/scene";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
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
import { Suspense, useCallback, useState } from "react";

/** The words of one item: its name, what it is for, and how to handle it safely. */
interface Words {
  readonly care: NonNullable<ReactNode>;
  readonly name: string;
  readonly use: NonNullable<ReactNode>;
}

/** How far the lab reaches from its middle, in metres: the corner is about 3.4 m across and 2.4 m tall. */
const REACH = 2.2;

/**
 * One corner of a school biology laboratory at real size, for learning the
 * equipment by sight: the apparatus on the bench, the personal protective
 * equipment a learner wears, and the safety equipment on the wall. The
 * learner picks a group and an item, or clicks an item in the room; the
 * camera turns to it, and the readouts give its group, what it is for and how
 * to handle it safely. Playing tours the items one by one. Every word comes
 * from the lesson, so the same corner serves a chemistry or physics lesson
 * on laboratory safety.
 */
export function LabEquipmentLab({
  description,
  items,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly items: readonly [Equipment, ...Equipment[]];
  readonly labels: {
    readonly care: string;
    readonly categories: Readonly<Record<Category, string>>;
    readonly category: string;
    readonly item: string;
    readonly items: Readonly<Partial<Record<Equipment, Words>>>;
    readonly use: string;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [shown, setShown] = useState({ item: items[0], visit: 0 });
  const pick = useCallback(
    (item: Equipment) => setShown((last) => ({ item, visit: last.visit + 1 })),
    []
  );
  const category = categoryOf(shown.item);
  const words = labels.items[shown.item];
  const groups = Arr.map(categoriesOf(items), (value) => ({
    label: labels.categories[value],
    value,
  }));
  const named = Arr.flatMap(itemsIn(items, category), (value) => {
    const entry = labels.items[value];
    return entry === undefined ? [] : [{ label: entry.name, value }];
  });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <Select
          items={groups}
          onValueChange={(next: Category | null) => {
            if (next !== null) {
              pick(firstIn(items, next));
            }
          }}
          value={category}
        >
          <SelectTrigger
            aria-label={labels.category}
            className="min-w-36 flex-1"
          >
            <SelectValue labels={Arr.map(groups, (group) => group.label)} />
          </SelectTrigger>
          <SelectContent label={labels.category}>
            {Arr.map(groups, (group) => (
              <SelectItem key={group.value} plain value={group.value}>
                {group.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={named}
          onValueChange={(next: Equipment | null) => {
            if (next !== null) {
              pick(next);
            }
          }}
          value={shown.item}
        >
          <SelectTrigger aria-label={labels.item} className="min-w-36 flex-1">
            <SelectValue labels={Arr.map(named, (entry) => entry.label)} />
          </SelectTrigger>
          <SelectContent label={labels.item}>
            {Arr.map(named, (entry) => (
              <SelectItem key={entry.value} plain value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={REACH} setting="lab">
          <Suspense fallback={null}>
            <PickProvider
              current={shown.item}
              items={items}
              name={words?.name}
              pick={pick}
              visit={shown.visit}
            >
              <EquipmentScene />
            </PickProvider>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.item} value={words?.name} />
          <VisualFact
            label={labels.category}
            value={labels.categories[category]}
          />
        </VisualCardFacts>
        <VisualCardFacts>
          <VisualFact label={labels.use} value={words?.use} />
        </VisualCardFacts>
        <VisualCardFacts>
          <VisualFact label={labels.care} value={words?.care} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
