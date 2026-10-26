import {
  CheckmarkBadge01Icon,
  Clock01Icon,
  TimeQuarterPassIcon,
  Unlink01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";

/** The icon of each state of a guardian link, wherever the state shows: lists, filters, and the open link. */
export const LINK_STATUS_ICONS = {
  expired: TimeQuarterPassIcon,
  pending: Clock01Icon,
  revoked: Unlink01Icon,
  verified: CheckmarkBadge01Icon,
  withdrawn: UserRemove01Icon,
};
