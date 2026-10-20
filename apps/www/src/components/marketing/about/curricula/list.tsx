import { Globe02Icon } from "@hugeicons/core-free-icons";
import {
  useFocusWithin,
  useHover,
  useIntersection,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { animate } from "motion";
import { useMotionValue, useMotionValueEvent } from "motion/react";
import { useEffect, useState } from "react";
import { CountryFlagIcon } from "@/components/shared/flag";
import type { readRuntimeCurriculumOptions } from "@/lib/curriculum/model";

/** How long one curriculum stays bright before the next one lights up. */
const LIGHT_FOR_MS = 1800;

/** One curriculum of the catalog, as the page links to it. */
type CurriculumLink = Pick<
  ReturnType<typeof readRuntimeCurriculumOptions>[number],
  "countryCode" | "href" | "programKey" | "title"
>;

interface CurriculumListProps {
  readonly curricula: readonly CurriculumLink[];
  readonly label: string;
}

/**
 * The curricula as a list in large letters. One name is bright at a time and the
 * others are dimmed to a contrast that still reads (4.6:1 in light, 6.7:1 in dark);
 * a pointer or a keyboard on a name makes it the bright one.
 * The lighting moves on by itself while the list is on screen. It waits while
 * a pointer or focus is on the list, and holds on the first name with reduced
 * motion.
 */
export function CurriculumList({ curricula, label }: CurriculumListProps) {
  const { entry, ref: viewRef } = useIntersection({ threshold: 0.5 });
  const { hovered, ref: hoverRef } = useHover();
  const { focused, ref: focusRef } = useFocusWithin();
  const ref = useMergedRef(viewRef, hoverRef, focusRef);
  const shouldReduceMotion = useReducedMotion();
  const [bright, setBright] = useState(0);
  // The lighting as a count of names lit so far: Motion moves it one name every
  // LIGHT_FOR_MS, and the bright name is that count around the list.
  const lit = useMotionValue(0);
  const reading = hovered || focused;
  const playing =
    (entry?.isIntersecting ?? false) && !shouldReduceMotion && !reading;

  useMotionValueEvent(lit, "change", (latest) => {
    setBright(Math.floor(latest) % curricula.length);
  });

  useEffect(() => {
    if (!playing) {
      return;
    }
    const from = Math.floor(lit.get());
    const controls = animate(lit, [from, from + curricula.length], {
      duration: (curricula.length * LIGHT_FOR_MS) / 1000,
      ease: "linear",
      repeat: Number.POSITIVE_INFINITY,
    });
    return () => controls.stop();
  }, [curricula.length, lit, playing]);

  /** Lights the name a pointer or the keyboard is on, and the lighting goes on from it. */
  const light = (position: number) => {
    lit.jump(position);
    setBright(position);
  };

  return (
    <nav aria-label={label} className="grid gap-4" ref={ref}>
      {Arr.map(curricula, (curriculum, position) => (
        <NavigationLink
          className={cn(
            "flex w-fit items-center gap-4 text-xl tracking-tight transition-opacity duration-300 sm:text-3xl",
            position === bright ? "opacity-100" : "opacity-60"
          )}
          href={curriculum.href}
          key={curriculum.programKey}
          onFocus={() => light(position)}
          onPointerEnter={() => light(position)}
        >
          <CountryFlagIcon
            className="h-auto w-6 shrink-0 rounded-xs ring-1 ring-foreground/10"
            countryCode={curriculum.countryCode}
            fallback={
              <HugeIcons className="size-6 shrink-0" icon={Globe02Icon} />
            }
          />
          {curriculum.title}
        </NavigationLink>
      ))}
    </nav>
  );
}
