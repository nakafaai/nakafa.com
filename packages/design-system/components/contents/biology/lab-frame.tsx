"use client";

import {
  BIOLOGY_DEFAULT_ITEM_INDEX,
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
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardToolbar,
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
  /** The item the lab opens on. It starts at the first item when none is given. */
  defaultItemIndex?: number | undefined;
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
  /** Reports each item the reader picks, so a window can keep it while this lab is unmounted. */
  onItemIndexChange?: (index: number) => void;
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
  defaultItemIndex = BIOLOGY_DEFAULT_ITEM_INDEX,
  description,
  labels,
  live = true,
  onItemIndexChange,
  scene: Scene,
  title,
  view = BIOLOGY_DEFAULT_VIEW,
}: BiologyLabProps<Item> & {
  scene: ComponentType<BiologySceneProps<Item>>;
  view?: NarrowCameraPose;
}) {
  const { resolvedTheme } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(defaultItemIndex);
  const colors = getBiologySceneColors(resolvedTheme);
  const selectedItem = labels.items[selectedIndex];
  const hasMultipleItems = labels.items.length > 1;
  const readings = biologyReadings(selectedItem, labels);
  const hasFooter = selectedItem.caption !== undefined || readings.length > 0;

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

    const index = Number(value);
    setSelectedIndex(index);
    onItemIndexChange?.(index);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {hasMultipleItems && (
        <VisualCardToolbar>
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
        </VisualCardToolbar>
      )}

      <VisualCardBody
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
      </VisualCardBody>

      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>

      {hasFooter && (
        <VisualCardFooter>
          {selectedItem.caption === undefined ? null : (
            <p className="text-muted-foreground text-sm">
              {selectedItem.caption}
            </p>
          )}
          {readings.length === 0 ? null : (
            <VisualCardFacts>
              {Arr.map(readings, (reading) => (
                <VisualFact
                  key={reading.key}
                  label={reading.label}
                  value={reading.value}
                />
              ))}
            </VisualCardFacts>
          )}
        </VisualCardFooter>
      )}
    </VisualCard>
  );
}
