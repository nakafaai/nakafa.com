import {
  Building03Icon,
  Calendar03Icon,
  ConnectIcon,
  CreditCardIcon,
  DocumentValidationIcon,
  FileSpreadsheetIcon,
  InformationCircleIcon,
  Mail01Icon,
  Plug01Icon,
  SecurityCheckIcon,
  StudentIcon,
  UserListIcon,
  UserLove01Icon,
  UserMultiple02Icon,
  UserSettings01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { SchoolSettingsGroup } from "@/lib/settings/school";

/**
 * The icon of each section, beside its name. A section added without one does not compile, and
 * no section draws the icon of another section, so each entry of the sidebar is told apart by
 * its icon alone.
 */
export const settingsSectionIcons: Record<
  SchoolSettingsGroup["sections"][number]["labelKey"],
  IconSvgElement
> = {
  audit: DocumentValidationIcon,
  billing: CreditCardIcon,
  clients: Plug01Icon,
  cohorts: UserMultiple02Icon,
  connections: ConnectIcon,
  guardians: UserLove01Icon,
  invites: Mail01Icon,
  members: UserListIcon,
  periods: Calendar03Icon,
  policies: SecurityCheckIcon,
  profile: InformationCircleIcon,
  roles: UserSettings01Icon,
  roster: FileSpreadsheetIcon,
  students: StudentIcon,
  units: Building03Icon,
};
