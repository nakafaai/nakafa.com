import { Refresh03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";

/**
 * A read that failed where its content would stand, as an empty state (`EmptyState`): Nina, a title and
 * a sentence in the middle of the place, with no card around them. A part that can ask the server again
 * passes `onRetry`, and `isPending` holds Retry disabled while the server's answer is awaited. Content
 * that is already on screen keeps its place instead, under `DataFailure`.
 */
export function LoadFailure({
  isPending = false,
  onRetry,
}: {
  isPending?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations("Common");

  return (
    <EmptyState
      action={
        onRetry === undefined ? undefined : (
          <Button
            disabled={isPending}
            onClick={onRetry}
            size="sm"
            variant="outline"
          >
            <HugeIcons icon={Refresh03Icon} />
            {t("retry")}
          </Button>
        )
      }
      description={t("load-error")}
      role="alert"
      scene={<EmptyNina act="searching" />}
      title={t("load-error-title")}
    />
  );
}
