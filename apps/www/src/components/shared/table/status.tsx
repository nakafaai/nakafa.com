import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ComponentProps } from "react";
import type { StatusTone } from "@/components/shared/table/tone";

/** The badge that draws each tone. */
const TONE_VARIANTS = {
  danger: "destructive",
  info: "info",
  neutral: "muted",
  primary: "default",
  success: "success",
  warning: "warning",
} as const satisfies Record<
  typeof StatusTone.Type,
  ComponentProps<typeof Badge>["variant"]
>;

/**
 * A record's status in a table cell, as the try-out catalog shows a try-out's: a badge in the
 * tone of the state, with the state's own icon and its name. Every state of one table takes an
 * icon of its own, so no two states of the table share one.
 */
export function TableStatus({
  icon,
  label,
  tone,
}: {
  /** The icon of the state, which no other state of the table uses. */
  icon: ComponentProps<typeof HugeIcons>["icon"];
  /** The name of the state, as the reader sees it. */
  label: string;
  tone: typeof StatusTone.Type;
}) {
  return (
    <Badge variant={TONE_VARIANTS[tone]}>
      <HugeIcons data-icon="inline-start" icon={icon} />
      {label}
    </Badge>
  );
}
