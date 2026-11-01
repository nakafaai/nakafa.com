import { Alert02Icon, Refresh03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";

/**
 * Keeps already loaded content visible when its next read fails, with one line
 * beside it that says so and no frame of its own. A list that can ask the server
 * again passes `onRetry`, and the line offers that Retry. A read with nothing on
 * screen yet shows `LoadFailure` in its place.
 */
export function DataFailure({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations("Common");

  return (
    <div
      className="text-destructive flex flex-wrap items-center gap-2 text-sm"
      role="alert"
    >
      <HugeIcons icon={Alert02Icon} />
      {t("load-error")}
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline">
          <HugeIcons icon={Refresh03Icon} />
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
