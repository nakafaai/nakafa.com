"use client";

import {
  ANCIENT_ATOM_LEVELS,
  type AncientAtomLevelId,
  type AncientAtomLevelLabels,
  WHOLE_MATTER_LEVEL_ID,
} from "@repo/design-system/components/contents/chemistry/ancient-atom/data";
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
import { Array as Arr, Option } from "effect";
import {
  AnimatePresence,
  domMax,
  LazyMotion,
  MotionConfig,
} from "motion/react";
// biome-ignore lint/performance/noNamespaceImport: Motion documents this namespace for the smaller LazyMotion entrypoint.
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { useState } from "react";

interface AncientAtomLabProps {
  description: ReactNode;
  labels: {
    aristotleBody: ReactNode;
    aristotleLabel: string;
    chooseLevel: string;
    democritusBody: ReactNode;
    democritusLabel: string;
    levels: Record<AncientAtomLevelId, AncientAtomLevelLabels>;
  };
  title: ReactNode;
}

/**
 * Renders an introductory thought experiment for Greek atomism.
 *
 * The visual is intentionally code-native instead of bitmap-based, so the
 * concept stays theme-aware, localizable, and easy to inspect in review.
 *
 * @see https://motion.dev/docs/react
 * @see https://motion.dev/docs/react-accessibility
 */
export function AncientAtomLab({
  title,
  description,
  labels,
}: AncientAtomLabProps) {
  const [selectedLevelId, setSelectedLevelId] = useState<AncientAtomLevelId>(
    WHOLE_MATTER_LEVEL_ID
  );
  const selectedLevel = Arr.findFirst(
    ANCIENT_ATOM_LEVELS,
    (level) => level.id === selectedLevelId
  );

  if (Option.isNone(selectedLevel)) {
    return null;
  }

  const pieces = Array.from(
    { length: selectedLevel.value.pieces },
    (_, pieceIndex) => pieceIndex
  );
  const visibleColumns = Math.min(selectedLevel.value.pieces, 4);
  const visibleRows = Math.ceil(selectedLevel.value.pieces / visibleColumns);

  /**
   * Keeps one cutting stage selected when ToggleGroup emits an empty value.
   */
  function handleLevelChange(levelId: string) {
    if (!levelId) {
      return;
    }

    const nextLevel = Arr.findFirst(
      ANCIENT_ATOM_LEVELS,
      (level) => level.id === levelId
    );

    if (Option.isNone(nextLevel)) {
      return;
    }

    setSelectedLevelId(nextLevel.value.id);
  }

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        <VisualCard>
          <VisualCardHeader description={description} title={title} />

          <VisualCardToolbar>
            <ToggleGroup
              aria-label={labels.chooseLevel}
              gridColumns="4"
              onValueChange={handleLevelChange}
              type="single"
              value={selectedLevelId}
              variant="outline"
            >
              {Arr.map(ANCIENT_ATOM_LEVELS, (level) => (
                <ToggleGroupItem key={level.id} value={level.id}>
                  {labels.levels[level.id].tab}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </VisualCardToolbar>

          <VisualCardBody className="aspect-video p-(--card-spacing)">
            <div
              className="grid h-full items-stretch gap-2"
              style={{
                gridTemplateColumns: `repeat(${visibleColumns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${visibleRows}, minmax(0, 1fr))`,
              }}
            >
              <AnimatePresence mode="popLayout">
                {Arr.map(pieces, (pieceIndex) => (
                  <m.div
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative rounded-md shadow-sm"
                    exit={{ opacity: 0, scale: 0.88 }}
                    initial={{ opacity: 0, scale: 0.88 }}
                    key={`${selectedLevelId}-${pieceIndex}`}
                    layout
                    style={{
                      backgroundColor: `var(--chart-${(pieceIndex % 5) + 1})`,
                    }}
                    transition={{ ease: "easeOut" }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </VisualCardBody>

          <VisualCardActions>
            <VisualCardFullscreen />
          </VisualCardActions>

          <VisualCardFooter>
            <VisualCardFacts>
              <VisualFact
                label={labels.aristotleLabel}
                value={labels.aristotleBody}
              />
              <VisualFact
                label={labels.democritusLabel}
                value={labels.democritusBody}
              />
            </VisualCardFacts>
          </VisualCardFooter>
        </VisualCard>
      </LazyMotion>
    </MotionConfig>
  );
}
