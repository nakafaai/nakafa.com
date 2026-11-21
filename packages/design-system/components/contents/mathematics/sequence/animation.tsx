import { DashboardSpeed01Icon, Table01Icon } from "@hugeicons/core-free-icons";
import { useIntersection, useMediaQuery } from "@mantine/hooks";
import { getTableChairArrangement } from "@repo/design-system/components/contents/mathematics/sequence/arrangement";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  usePauseVisualScene,
  useStartVisualScene,
  useVisualReset,
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Effect, Fiber, Schedule } from "effect";
import {
  AnimatePresence,
  domMax,
  LayoutGroup,
  LazyMotion,
  MotionConfig,
} from "motion/react";
import { div as MotionDiv } from "motion/react-m";
import type { ReactNode } from "react";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";

const MAX_TABLES_MOBILE = 2;
const MAX_TABLES_DESKTOP = 3;
const ANIMATION_INTERVAL_MS = 2000;
const STAGGER_DELAY = 0.01;
const SPEED_HALF = 0.5;
const SPEED_NORMAL = 1;
const SPEED_FAST = 1.5;
const SPEED_VERY_FAST = 2;
const SPEED_VALUES = [SPEED_HALF, SPEED_NORMAL, SPEED_FAST, SPEED_VERY_FAST];
const Z_INDEX_TABLE = 10;
const Z_INDEX_CHAIR = 20;

interface TableChairsProps {
  labels: {
    title: NonNullable<ReactNode>;
    table: string;
    chair: string;
    reset: string;
    pause: string;
    play: string;
    setSpeed: string;
    setTableCount: string;
  };
}

/**
 * Renders the table-chair sequence animation used by the sequence concept page.
 *
 * Uses the shared `VisualCard` store and `VisualCardSceneActions` so Play,
 * Pause, Fullscreen, and Reset behave identically to every other visual card.
 */
export default function TableChairsAnimation({ labels }: TableChairsProps) {
  const { ref, entry } = useIntersection({
    threshold: 0.1,
  });
  const isInView = entry?.isIntersecting ?? false;

  return (
    <VisualCard ref={ref}>
      <VisualCardHeader
        description={`${labels.table} & ${labels.chair}`}
        title={labels.title}
      />
      <TableChairsContent isInView={isInView} labels={labels} />
    </VisualCard>
  );
}

/** Controls, stage, actions, and footer inside the shared `VisualCard` store. */
function TableChairsContent({
  isInView,
  labels,
}: {
  readonly isInView: boolean;
  readonly labels: TableChairsProps["labels"];
}) {
  const common = useTranslations("Common");
  const [tableCount, setTableCount] = useState(1);
  const [speed, setSpeed] = useState(1);
  const playing = useVisualScene((state) => state.playing, false);
  const start = useStartVisualScene();
  const pause = usePauseVisualScene();
  const startedOnce = useRef(false);
  const shownPlaying = useRef(playing);
  const startOnEnter = useEffectEvent(() => start());

  const isMobile = useMediaQuery("(max-width: 640px)");
  const maxTables = isMobile ? MAX_TABLES_MOBILE : MAX_TABLES_DESKTOP;

  // Start playing once the card first enters the viewport, matching BacterialGrowth.
  useEffect(() => {
    if (isInView && !startedOnce.current) {
      startedOnce.current = true;
      startOnEnter();
    }
  }, [isInView]);

  // Pressing Play while parked at the maximum table count replays from 1.
  useEffect(() => {
    const justStarted = playing && !shownPlaying.current;
    shownPlaying.current = playing;
    if (justStarted && tableCount >= maxTables) {
      setTableCount(1);
    }
  }, [maxTables, playing, tableCount]);

  useVisualReset(() => {
    setTableCount(1);
    setSpeed(1);
  });

  const isAnimating = playing && tableCount < maxTables && isInView;
  const deferredAnimating = useDeferredValue(isAnimating);
  const deferredTableCount = useDeferredValue(tableCount);

  // Calculate chair count based on the formula U_n = 2n + 2
  const chairCount = 2 * deferredTableCount + 2;

  useEffect(() => {
    if (!deferredAnimating) {
      return;
    }

    const interval = Effect.runFork(
      Effect.schedule(
        Effect.sync(() => {
          setTableCount((prev) => {
            if (prev < maxTables) {
              return prev + 1;
            }
            return prev;
          });
        }),
        Schedule.spaced(ANIMATION_INTERVAL_MS / speed)
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(interval));
    };
  }, [deferredAnimating, maxTables, speed]);

  // Stop the play toggle cleanly once the sequence reaches its final step.
  const pauseAtEnd = useEffectEvent(() => pause());
  useEffect(() => {
    if (playing && tableCount >= maxTables) {
      pauseAtEnd();
    }
  }, [maxTables, playing, tableCount]);

  const arrangement = useMemo(
    () => getTableChairArrangement(deferredTableCount),
    [deferredTableCount]
  );
  const speedItems = Arr.map(SPEED_VALUES, (value) => ({
    label: `${value}x`,
    value,
  }));
  const tableItems = Arr.makeBy(maxTables, (index) => ({
    label: `${index + 1} ${labels.table}`,
    value: index + 1,
  }));

  return (
    <>
      <VisualCardToolbar>
        <ButtonGroup>
          <Select
            items={speedItems}
            onValueChange={(next: number | null) => {
              if (next !== null) {
                setSpeed(next);
              }
            }}
            value={speed}
          >
            <SelectTrigger aria-label={labels.setSpeed}>
              <HugeIcons
                className="text-muted-foreground"
                icon={DashboardSpeed01Icon}
              />
              <SelectValue />
            </SelectTrigger>
            <SelectContent label={common("menu-speed")}>
              {Arr.map(speedItems, (item) => (
                <SelectItem key={item.value} plain value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={tableItems}
            onValueChange={(next: number | null) => {
              if (next !== null) {
                setTableCount(next);
                pause();
              }
            }}
            value={tableCount}
          >
            <SelectTrigger aria-label={labels.setTableCount}>
              <HugeIcons className="text-muted-foreground" icon={Table01Icon} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent label={common("menu-count")}>
              {Arr.map(tableItems, (item) => (
                <SelectItem key={item.value} plain value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ButtonGroup>
      </VisualCardToolbar>

      <VisualCardBody className="p-(--card-spacing)">
        <div className="relative aspect-square h-full w-full overflow-hidden sm:aspect-video">
          <div className="flex h-full flex-col items-center justify-center gap-8">
            <div className="relative flex w-full items-center justify-center">
              <div
                className="relative"
                style={{
                  width: arrangement.width,
                  height: arrangement.height,
                }}
              >
                <MotionConfig reducedMotion="user">
                  <LazyMotion features={domMax} strict>
                    <LayoutGroup>
                      <AnimatePresence mode="popLayout">
                        {Arr.map(arrangement.tables, (table) => (
                          <MotionDiv
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute rounded-md shadow-sm"
                            exit={{ opacity: 0, scale: 0.95 }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            key={`table-${table.id}`}
                            layout
                            style={{
                              backgroundColor: PLOT_COLORS.teal,
                              left: table.x,
                              top: table.y,
                              width: table.width,
                              height: table.height,
                              zIndex: Z_INDEX_TABLE,
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30,
                              delay: (table.id - 1) * STAGGER_DELAY,
                            }}
                          />
                        ))}
                      </AnimatePresence>

                      <AnimatePresence mode="popLayout">
                        {Arr.map(arrangement.chairs, (chair) => (
                          <MotionDiv
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute rounded-full shadow-sm"
                            exit={{ opacity: 0, scale: 0.95 }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            key={`chair-${chair.id}`}
                            layout
                            style={{
                              backgroundColor: PLOT_COLORS.violet,
                              left: chair.x,
                              top: chair.y,
                              width: arrangement.chairSize,
                              height: arrangement.chairSize,
                              zIndex: Z_INDEX_CHAIR,
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30,
                              delay: chair.id * STAGGER_DELAY,
                            }}
                          />
                        ))}
                      </AnimatePresence>
                    </LayoutGroup>
                  </LazyMotion>
                </MotionConfig>
              </div>
            </div>
          </div>
        </div>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.table} value={deferredTableCount} />
          <VisualFactTabular label={labels.chair} value={chairCount} />
        </VisualCardFacts>
      </VisualCardFooter>
    </>
  );
}
