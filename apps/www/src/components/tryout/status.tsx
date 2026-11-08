import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { statusLook, type TryoutProgress } from "@/components/tryout/progress";

/** Renders the shared icon for one try-out workflow status. */
function TryoutStatusIcon({ status }: { status: TryoutProgress }) {
  return <HugeIcons data-icon="inline-start" icon={statusLook(status).icon} />;
}

/** Renders the localized label for one try-out workflow status. */
function TryoutStatusLabel({
  className,
  status,
}: {
  className?: ComponentProps<"span">["className"];
  status: TryoutProgress;
}) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <span className={className}>{tTryouts(statusLook(status).label)}</span>
  );
}

/** Renders one consistent, filled try-out workflow badge. */
export function TryoutStatus({ status }: { status: TryoutProgress }) {
  return (
    <Badge variant={statusLook(status).variant}>
      <TryoutStatusIcon status={status} />
      <TryoutStatusLabel status={status} />
    </Badge>
  );
}
