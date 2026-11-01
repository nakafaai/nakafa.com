import { Refresh03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import { EmptyNina } from "@/components/state/empty";

/**
 * A read that failed where its content would stand, in the anatomy of an empty state: Nina, a title and
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
    <Empty className="flex-1 md:p-10" role="alert">
      <EmptyHeader>
        <EmptyNina act="searching" />
        <EmptyTitle className="text-base">{t("load-error-title")}</EmptyTitle>
        <EmptyDescription>{t("load-error")}</EmptyDescription>
      </EmptyHeader>
      {onRetry === undefined ? null : (
        <EmptyContent>
          <Button
            disabled={isPending}
            onClick={onRetry}
            size="sm"
            variant="outline"
          >
            <HugeIcons icon={Refresh03Icon} />
            {t("retry")}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
