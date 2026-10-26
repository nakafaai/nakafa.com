import {
  CheckmarkBadge01Icon,
  Clock01Icon,
  TimeQuarterPassIcon,
  Unlink01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";
import type { LinkStatus } from "@repo/backend/confect/guardians/schema";
import type { StatusLook } from "@/components/shared/table/status";

/**
 * The look of each state of a guardian link, wherever the state shows (lists, filters, and the open
 * link): its own icon, and the tone of its badge.
 */
export const LINK_STATUS_LOOKS = {
  expired: { icon: TimeQuarterPassIcon, tone: "warning" },
  pending: { icon: Clock01Icon, tone: "info" },
  revoked: { icon: Unlink01Icon, tone: "neutral" },
  verified: { icon: CheckmarkBadge01Icon, tone: "success" },
  withdrawn: { icon: UserRemove01Icon, tone: "neutral" },
} as const satisfies Record<typeof LinkStatus.Type, StatusLook>;
