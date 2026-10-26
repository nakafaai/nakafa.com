import { Alert02Icon, Refresh03Icon } from "@hugeicons/core-free-icons";
import {
  Alert,
  AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";

/**
 * Keeps already loaded content visible when its next read fails, with one
 * sentence that says so. A list that can ask the server again passes `onRetry`,
 * and the failure offers that Retry. `isPending` holds Retry disabled while the
 * server's answer is awaited, with the same label.
 */
export function DataFailure({
  isPending = false,
  onRetry,
}: {
  isPending?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations("Common");
  return (
    <Alert variant="destructive">
      <HugeIcons icon={Alert02Icon} />
      <AlertDescription>
        {t("load-error")}
        {onRetry && (
          <Button
            disabled={isPending}
            onClick={onRetry}
            size="sm"
            variant="outline"
          >
            <HugeIcons icon={Refresh03Icon} />
            {t("retry")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
