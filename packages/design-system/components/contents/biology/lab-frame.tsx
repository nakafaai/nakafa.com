"use client";

import {
  BIOLOGY_DEFAULT_VIEW,
  type BiologySceneColors,
  getBiologySceneColors,
  isBiologyItemIndex,
} from "@repo/design-system/components/contents/biology/data";
import { biologyReadings } from "@repo/design-system/components/contents/biology/readings";
import { SceneSpinner } from "@repo/design-system/components/three/placeholder";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { Array as Arr } from "effect";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";

/** The stage loads once the lab asks for it, and its frame holds the place meanwhile. */
const BiologyStage = dynamic(
  () =>
    import("@repo/design-system/components/contents/biology/stage").then(
      ({ BiologyStage }) => BiologyStage
    ),
  { loading: SceneSpinner }
);

export interface BiologyLabCalloutProps {
  id: string;
  label: ReactNode;
}

export interface BiologyLabItemProps {
  callouts?: readonly BiologyLabCalloutProps[];
  caption?: ReactNode;
  focus?: ReactNode;
  tab: string;
  takeaway?: ReactNode;
}

export interface BiologyLabProps<
  Item extends BiologyLabItemProps = BiologyLabItemProps,
> {
  description?: ReactNode;
  labels: {
    chooseMode: string;
    focusLabel?: string;
    items: readonly [Item, ...Item[]];
    takeawayLabel?: string;
    viewLabel: string;
  };
  /**
   * Whether the three-dimensional scene is mounted. A lab that is not live keeps
   * its whole card in place, with an empty frame where the scene goes.
   */
  live?: boolean;
  title?: ReactNode;
}

export interface BiologySceneProps<
  Item extends BiologyLabItemProps = BiologyLabItemProps,
> {
  colors: BiologySceneColors;
  item: Item;
  selectedIndex: number;
}

/**
 * Renders the shared card, controls, and camera frame for one biology 3D lab.
 */
export function BiologyLabFrame<Item extends BiologyLabItemProps>({
  description,
  labels,
  live = true,
  scene: Scene,
  title,
  view = BIOLOGY_DEFAULT_VIEW,
}: BiologyLabProps<Item> & {
  scene: ComponentType<BiologySceneProps<Item>>;
  view?: NarrowCameraPose;
}) {
  const { resolvedTheme } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const colors = getBiologySceneColors(resolvedTheme);
  const selectedItem = labels.items[selectedIndex];
  const hasMultipleItems = labels.items.length > 1;
  const readings = biologyReadings(selectedItem, labels);

  /**
   * Keeps one tab active when ToggleGroup emits an empty value.
   */
  function handleItemChange(value: string) {
    if (!value) {
      return;
    }

    if (!isBiologyItemIndex(value, labels.items.length)) {
      return;
    }

    setSelectedIndex(Number(value));
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        {hasMultipleItems && (
          <ToggleGroup
            aria-label={labels.chooseMode}
            gridColumns="auto"
            onValueChange={handleItemChange}
            type="single"
            value={String(selectedIndex)}
            variant="outline"
          >
            {Arr.map(labels.items, (item, index) => (
              <ToggleGroupItem key={item.tab} value={String(index)}>
                {item.tab}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <VisualCardScene
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          {live ? (
            <BiologyStage
              colors={colors}
              selectedIndex={selectedIndex}
              view={view}
            >
              <Scene
                colors={colors}
                item={selectedItem}
                selectedIndex={selectedIndex}
              />
            </BiologyStage>
          ) : null}
        </VisualCardScene>

        {selectedItem.caption === undefined ? null : (
          <p className="text-muted-foreground text-sm">
            {selectedItem.caption}
          </p>
        )}
      </VisualCardBody>

      <VisualCardFooter>
        {readings.length === 0 ? null : (
          <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {Arr.map(readings, (reading) => (
              <VisualFact
                key={reading.key}
                label={reading.label}
                value={reading.value}
              />
            ))}
          </dl>
        )}
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}
