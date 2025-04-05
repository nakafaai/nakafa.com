"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PauseIcon, PlayIcon, TimerResetIcon } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts";

type TableChairsProps = {
  labels?: {
    title?: string;
    table?: string;
    chair?: string;
  };
};

type TableItem = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChairItem = {
  id: number;
  x: number;
  y: number;
  side: "left" | "right" | "top" | "bottom";
};

export default function TableChairsAnimation({
  labels = {
    title: "Table and Chair Sequence Pattern",
    table: "Table",
    chair: "Chair",
  },
}: TableChairsProps) {
  const [tableCount, setTableCount] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const deferredPlaying = useDeferredValue(isPlaying);
  const deferredTableCount = useDeferredValue(tableCount);

  const isMobile = useMediaQuery("(max-width: 640px)");

  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
  });

  // Start playing when component comes into view
  useEffect(() => {
    if (isIntersecting) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isIntersecting]);

  const maxTables = isMobile ? 2 : 3;

  // Calculate chair count based on the formula U_n = 2n + 2
  const chairCount = useMemo(
    () => 2 * deferredTableCount + 2,
    [deferredTableCount]
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;

    // Stop playing when maximum table count is reached
    if (deferredTableCount >= maxTables) {
      setIsPlaying(false);
      return;
    }

    if (deferredPlaying) {
      interval = setInterval(() => {
        setTableCount((prev) => {
          if (prev < maxTables) {
            return prev + 1;
          }
          return prev;
        });
      }, 2000 / speed);
    }

    return () => clearInterval(interval);
  }, [deferredPlaying, deferredTableCount, maxTables, speed]);

  const resetAnimation = useCallback(() => {
    setTableCount(1);
    setIsPlaying(true);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!isPlaying && tableCount >= maxTables) {
      // If at max table count and trying to play, restart from beginning
      setTableCount(1);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, tableCount, maxTables]);

  // Constants for sizing and spacing
  const tableWidth = 100;
  const tableHeight = 80;
  const tableSpacing = 4; // Gap between tables
  const chairSize = 24;
  const chairOffset = 8; // Distance of chair from table edge

  // Generate arrangement of tables and chairs
  const arrangement = useMemo(() => {
    const tables: TableItem[] = [];
    const chairs: ChairItem[] = [];

    // Calculate total width of all tables
    const totalWidth = deferredTableCount * tableWidth;

    // For single table
    if (deferredTableCount === 1) {
      tables.push({
        id: 1,
        x: 0,
        y: 0,
        width: tableWidth,
        height: tableHeight,
      });

      // Add 4 chairs around the table (positioned at midpoints of each side)
      chairs.push(
        {
          id: 1,
          x: -chairSize - chairOffset,
          y: tableHeight / 2 - chairSize / 2,
          side: "left",
        },
        {
          id: 2,
          x: tableWidth + chairOffset,
          y: tableHeight / 2 - chairSize / 2,
          side: "right",
        },
        {
          id: 3,
          x: tableWidth / 2 - chairSize / 2,
          y: -chairSize - chairOffset,
          side: "top",
        },
        {
          id: 4,
          x: tableWidth / 2 - chairSize / 2,
          y: tableHeight + chairOffset,
          side: "bottom",
        }
      );
    } else {
      // For multiple tables
      for (let i = 0; i < deferredTableCount; i++) {
        tables.push({
          id: i + 1,
          x: i * (tableWidth + tableSpacing),
          y: 0,
          width: tableWidth,
          height: tableHeight,
        });
      }

      // Add chairs on the left side of the leftmost table
      chairs.push({
        id: 1,
        x: -chairSize - chairOffset, // No need to add spacing between tables for the first chair
        y: tableHeight / 2 - chairSize / 2,
        side: "left",
      });

      // Add chairs on the right side of the rightmost table
      chairs.push({
        id: 2,
        x: totalWidth + chairOffset + (deferredTableCount - 1) * tableSpacing, // Add spacing between tables
        y: tableHeight / 2 - chairSize / 2,
        side: "right",
      });

      // Add chairs on the top of each table
      for (let i = 0; i < deferredTableCount; i++) {
        chairs.push({
          id: 3 + i,
          x: i * tableWidth + tableWidth / 2 - chairSize / 2,
          y: -chairSize - chairOffset,
          side: "top",
        });
      }

      // Add chairs on the bottom of each table
      for (let i = 0; i < deferredTableCount; i++) {
        chairs.push({
          id: 3 + deferredTableCount + i,
          x: i * tableWidth + tableWidth / 2 - chairSize / 2,
          y: tableHeight + chairOffset,
          side: "bottom",
        });
      }
    }

    return { tables, chairs };
  }, [deferredTableCount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>
          {deferredTableCount} {labels.table} dan {chairCount} {labels.chair}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div
          ref={ref}
          className="relative aspect-square w-full overflow-hidden rounded-lg border border-cyan-100 bg-cyan-50 p-4 sm:aspect-video dark:border-cyan-900 dark:bg-cyan-950"
        >
          <div className="flex h-full flex-col items-center justify-center gap-8">
            {/* Table and chairs visualization */}
            <div className="relative flex w-full items-center justify-center">
              <div
                className="relative"
                style={{
                  width:
                    deferredTableCount * tableWidth +
                    (deferredTableCount - 1) * tableSpacing,
                  height: tableHeight,
                }}
              >
                <LayoutGroup>
                  {/* Tables */}
                  <AnimatePresence mode="popLayout">
                    {arrangement.tables.map((table) => (
                      <motion.div
                        key={`table-${table.id}`}
                        layout
                        className="absolute rounded-md bg-teal-300 shadow-sm transition-colors hover:bg-teal-400 dark:bg-teal-500"
                        style={{
                          left: table.x,
                          top: table.y,
                          width: table.width,
                          height: table.height,
                          zIndex: 10,
                        }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                          delay: (table.id - 1) * 0.01, // Stagger effect
                        }}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Chairs */}
                  <AnimatePresence mode="popLayout">
                    {arrangement.chairs.map((chair) => (
                      <motion.div
                        key={`chair-${chair.id}`}
                        layout
                        className="absolute rounded-full bg-cyan-300 shadow-sm transition-colors hover:bg-cyan-400 dark:bg-cyan-500"
                        style={{
                          left: chair.x,
                          top: chair.y,
                          width: 24,
                          height: 24,
                          zIndex: 20,
                        }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                          delay: chair.id * 0.01, // Stagger effect
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </LayoutGroup>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 px-0">
        <div className="flex w-full flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              aria-label="Reset"
              onClick={resetAnimation}
              size="icon"
            >
              <TimerResetIcon className="size-4 shrink-0" />
              <span className="sr-only">Reset</span>
            </Button>
            <Button
              variant={isPlaying ? "outline" : "default"}
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlayPause}
              size="icon"
            >
              {isPlaying ? (
                <PauseIcon className="size-4 shrink-0" />
              ) : (
                <PlayIcon className="size-4 shrink-0" />
              )}
              <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
            </Button>
          </div>

          <div className="flex gap-2">
            {[0.5, 1, 1.5, 2].map((speedValue) => (
              <Button
                key={speedValue}
                variant={speed === speedValue ? "default" : "outline"}
                aria-label={`Set speed to ${speedValue}x`}
                size="sm"
                onClick={() => setSpeed(speedValue)}
              >
                {speedValue}x
              </Button>
            ))}
          </div>
        </div>

        <div className="w-full border-t px-6 pt-4">
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: maxTables }).map((_, i) => (
              <Button
                key={i}
                variant={tableCount === i + 1 ? "default" : "outline"}
                aria-label={`Set table count to ${i + 1}`}
                size="sm"
                onClick={() => {
                  setTableCount(i + 1);
                  setIsPlaying(false);
                }}
              >
                {i + 1} {labels.table}
              </Button>
            ))}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
