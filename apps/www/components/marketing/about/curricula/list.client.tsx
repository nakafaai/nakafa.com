"use client";

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
 * others are dim; a pointer or a keyboard on a name makes it the bright one.
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
  const reading = hovered || focused;
  const playing =
    (entry?.isIntersecting ?? false) && !shouldReduceMotion && !reading;

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setInterval(() => {
      setBright((current) => (current + 1) % curricula.length);
    }, LIGHT_FOR_MS);
    return () => window.clearInterval(timer);
  }, [curricula.length, playing]);

  return (
    <nav aria-label={label} className="grid gap-4" ref={ref}>
      {Arr.map(curricula, (curriculum, position) => (
        <NavigationLink
          className={cn(
            "flex w-fit items-center gap-4 text-xl tracking-tight transition-opacity duration-300 sm:text-3xl",
            position === bright ? "opacity-100" : "opacity-40"
          )}
          href={curriculum.href}
          key={curriculum.programKey}
          onFocus={() => setBright(position)}
          onPointerEnter={() => setBright(position)}
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
