import { Menu01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { lazy } from "@repo/design-system/lib/lazy";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { useTranslations } from "use-intl";

/** The code of the menu's sheet, which a wide screen never opens and a phone needs only once the Menu button is near a press. */
const loadSheet = () =>
  import("@/components/marketing/shared/header/sheet").then((module) => ({
    default: module.HeaderSheet,
  }));

/** The menu's sheet, read from its own chunk. */
const HeaderSheet = lazy(loadSheet);

/**
 * The Menu button below `lg`, and the sheet of the header's sections it opens.
 * The sheet's code stays out of every marketing page's first JavaScript: the
 * reader's intent (a hover, a focus, a touch or a press) loads it and mounts it
 * closed, so the press that follows opens it with its slide. A press that comes
 * before its code opens it once the code arrives.
 */
export function HeaderDrawer({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const [warm, setWarm] = useState(false);
  const [open, setOpen] = useState(false);
  const intend = () => setWarm(true);

  return (
    <>
      <Button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="lg:hidden"
        onClick={() => {
          setWarm(true);
          setOpen(true);
        }}
        onFocus={intend}
        onMouseEnter={intend}
        onPointerDown={intend}
        onTouchStart={intend}
        type="button"
        variant="outline"
      >
        <HugeIcons icon={Menu01Icon} />
        {t("Marketing.menu")}
      </Button>
      {warm ? (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <HeaderSheet onOpenChange={setOpen} open={open}>
              {children}
            </HeaderSheet>
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </>
  );
}
