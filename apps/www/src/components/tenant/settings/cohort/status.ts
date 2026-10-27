import { Archive02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import type { CohortStatus } from "@repo/backend/confect/tenancy/cohort";
import type { StatusLook } from "@/components/shared/table/status";

/**
 * The look of each cohort status, in the cohorts table and in its Filter menu: the class together,
 * and an archive, each in its tone.
 */
export const COHORT_STATUS_LOOKS = {
  active: { icon: UserGroupIcon, tone: "success" },
  archived: { icon: Archive02Icon, tone: "neutral" },
} as const satisfies Record<typeof CohortStatus.Type, StatusLook>;
