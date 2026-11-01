import { PaintBoardIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { lazy } from "@repo/design-system/lib/lazy";
import { Effect } from "effect";
import { type ComponentProps, Suspense, useState } from "react";
import { useTranslations } from "use-intl";

const loadThemeMenu = () => import("@/components/shared/theme/menu");

/**
 * Loads the selector on first intent. It carries the menu and one icon for each
 * theme, which no page needs before a visitor reaches for the button.
 */
const ThemeMenu = lazy(() =>
  loadThemeMenu().then((module) => ({ default: module.ThemeMenu }))
);

/** Starts the load on intent. A load that fails here is the press's to meet, through the lazy menu. */
const warmThemeMenu = () =>
  Effect.runPromise(Effect.ignore(Effect.tryPromise(loadThemeMenu)));

/** What the button shows before and after the selector loads. */
function ThemeLabel() {
  const t = useTranslations("Common");
  return (
    <>
      <HugeIcons icon={PaintBoardIcon} />
      {t("theme")}
    </>
  );
}

/**
 * Renders the theme selector. Until the first press it is a plain button, so the
 * menu stays out of a page's first JavaScript. The selected theme lives in the
 * theme store.
 */
export function ThemePicker({
  variant = "outline",
}: {
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const [isPressed, setIsPressed] = useState(false);

  if (!isPressed) {
    return (
      <Button
        aria-haspopup="menu"
        onClick={() => setIsPressed(true)}
        onFocus={warmThemeMenu}
        onPointerEnter={warmThemeMenu}
        variant={variant}
      >
        <ThemeLabel />
      </Button>
    );
  }

  return (
    <Suspense
      fallback={
        <Button variant={variant}>
          <ThemeLabel />
        </Button>
      }
    >
      <ThemeMenu>
        <Button variant={variant}>
          <ThemeLabel />
        </Button>
      </ThemeMenu>
    </Suspense>
  );
}
