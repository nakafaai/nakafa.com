"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  AnimatePresence,
  domMax,
  LazyMotion,
  MotionConfig,
} from "motion/react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  ANCIENT_ATOM_LEVELS,
  type AncientAtomLabProps,
  type AncientAtomLevelId,
  WHOLE_MATTER_LEVEL_ID,
} from "./data";

/**
 * Renders a grade-level thought experiment for Greek atomism.
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
  const selectedLevel = ANCIENT_ATOM_LEVELS.find(
    (level) => level.id === selectedLevelId
  );

  if (!selectedLevel) {
    return null;
  }

  const pieces = Array.from(
    { length: selectedLevel.pieces },
    (_, pieceIndex) => pieceIndex
  );
  const visibleColumns = Math.min(selectedLevel.pieces, 4);
  const visibleRows = Math.ceil(selectedLevel.pieces / visibleColumns);

  /**
   * Keeps one cutting stage selected when ToggleGroup emits an empty value.
   */
  function handleLevelChange(levelId: string) {
    if (!levelId) {
      return;
    }

    const nextLevel = ANCIENT_ATOM_LEVELS.find((level) => level.id === levelId);

    if (!nextLevel) {
      return;
    }

    setSelectedLevelId(nextLevel.id);
  }

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        <Card className="overflow-hidden content-auto-card">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            <ToggleGroup
              aria-label={labels.chooseLevel}
              className="grid w-full grid-cols-4"
              onValueChange={handleLevelChange}
              type="single"
              value={selectedLevelId}
              variant="outline"
            >
              {ANCIENT_ATOM_LEVELS.map((level) => (
                <ToggleGroupItem key={level.id} value={level.id}>
                  {labels.levels[level.id].tab}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="aspect-video">
              <div
                className="grid h-full items-stretch gap-2"
                style={{
                  gridTemplateColumns: `repeat(${visibleColumns}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${visibleRows}, minmax(0, 1fr))`,
                }}
              >
                <AnimatePresence mode="popLayout">
                  {pieces.map((pieceIndex) => (
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
            </div>
          </CardContent>

          <CardFooter className="border-t">
            <dl className="flex w-full flex-col gap-4 text-sm sm:flex-row">
              <Perspective
                label={labels.aristotleLabel}
                value={labels.aristotleBody}
              />
              <Perspective
                label={labels.democritusLabel}
                value={labels.democritusBody}
              />
            </dl>
          </CardFooter>
        </Card>
      </LazyMotion>
    </MotionConfig>
  );
}

/**
 * Displays one compact perspective in the lab footer.
 */
function Perspective({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
