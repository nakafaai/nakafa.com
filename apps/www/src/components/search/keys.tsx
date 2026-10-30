import {
  ArrowDown02Icon,
  ArrowMoveDownLeftIcon,
  ArrowUp02Icon,
} from "@hugeicons/core-free-icons";
import { CommandFooter } from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

/** The foot of a command palette: the keys that move through it, open a row and close it. */
export function CommandKeys() {
  const t = useTranslations("Common");

  return (
    <CommandFooter>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1">
            <CommandKey>
              <HugeIcons className="size-3" icon={ArrowUp02Icon} />
            </CommandKey>
            <CommandKey>
              <HugeIcons className="size-3" icon={ArrowDown02Icon} />
            </CommandKey>
          </div>
          <span>{t("navigate")}</span>
        </div>
        <div className="flex items-center gap-2">
          <CommandKey>
            <HugeIcons className="size-3" icon={ArrowMoveDownLeftIcon} />
          </CommandKey>
          <span>{t("open")}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <CommandKey className="w-auto px-1">Esc</CommandKey>
        <span>{t("close")}</span>
      </div>
    </CommandFooter>
  );
}

/** One key of the palette's foot. */
function CommandKey({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded bg-muted px-1 font-sans text-muted-foreground text-xs shadow-xs ring-1 ring-border [&_svg:not([class*='size-'])]:size-3",
        className
      )}
    >
      {children}
    </kbd>
  );
}
