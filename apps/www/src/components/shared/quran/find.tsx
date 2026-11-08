import { Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { lazy } from "@repo/design-system/lib/lazy";
import { Effect } from "effect";
import { type ComponentProps, Suspense, useState, useTransition } from "react";
import { useTranslations } from "use-intl";

const loadJump = () => import("@/components/shared/quran/jump");

/** The surah picker, which no surah page needs before the reader turns to the search. */
const QuranSurahPicker = lazy(() =>
  loadJump().then((module) => ({ default: module.QuranSurahPicker }))
);

/** Starts the load on intent. A load that fails here is the press's to meet, through the lazy picker. */
const warmJump = () =>
  Effect.runPromise(Effect.ignore(Effect.tryPromise(loadJump)));

/** The search of a wide header: a button drawn as the search field it opens, with its icon and its words. */
export function QuranSurahSearchField(props: ComponentProps<"button">) {
  const t = useTranslations("Holy");
  return (
    <Button
      {...props}
      className="text-muted-foreground w-56 justify-start font-normal xl:w-64"
      variant="outline"
    >
      <HugeIcons icon={Search01Icon} />
      {t("search-surah")}
    </Button>
  );
}

/** The search of a phone's header: its icon alone, which its tooltip names. */
export function QuranSurahSearchIcon(props: ComponentProps<"button">) {
  const t = useTranslations("Holy");
  return (
    <Button
      {...props}
      size="icon"
      tooltip={t("search-surah")}
      variant="outline"
    >
      <HugeIcons icon={Search01Icon} />
    </Button>
  );
}

/**
 * The search of a surah page's header, beside its actions: a field on a wide
 * screen, its icon on a phone. Until the first press it is a plain button, so
 * the picker stays out of the page's first JavaScript: a pointer over it or a
 * focus on it starts the load, and the press opens the picker once it arrives.
 * The press is a transition, so the button stays on screen while it loads.
 */
export function QuranSurahFind() {
  const [isPressed, setIsPressed] = useState(false);
  const [, startTransition] = useTransition();
  const press = () => startTransition(() => setIsPressed(true));

  return (
    <Suspense fallback={null}>
      {isPressed ? (
        <QuranSurahPicker />
      ) : (
        <>
          <span className="max-md:hidden">
            <QuranSurahSearchField
              aria-haspopup="dialog"
              onClick={press}
              onFocus={warmJump}
              onPointerEnter={warmJump}
              type="button"
            />
          </span>
          <span className="md:hidden">
            <QuranSurahSearchIcon
              aria-haspopup="dialog"
              onClick={press}
              onPointerDown={warmJump}
              type="button"
            />
          </span>
        </>
      )}
    </Suspense>
  );
}
