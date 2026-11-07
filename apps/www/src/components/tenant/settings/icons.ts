import {
  BookOpen01Icon,
  Building03Icon,
  Calendar03Icon,
  ConnectIcon,
  CreditCardIcon,
  DocumentValidationIcon,
  FileSpreadsheetIcon,
  InformationCircleIcon,
  Mail01Icon,
  Plug01Icon,
  PlugSocketIcon,
  Presentation01Icon,
  School01Icon,
  SecurityCheckIcon,
  Shield01Icon,
  StudentIcon,
  Target02Icon,
  UserGroupIcon,
  UserListIcon,
  UserLove01Icon,
  UserMultiple02Icon,
  UserSettings01Icon,
  WebhookIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { SchoolSettingsGroup } from "@/lib/settings/school";

/**
 * The icon of each group of settings, beside its name in the sidebar, which folds the
 * group's sections under it without icons. The school group's sections stand alone with
 * their own icons, so its icon names it only where a group is drawn whole.
 */
export const settingsGroupIcons: Record<
  SchoolSettingsGroup["key"],
  IconSvgElement
> = {
  academic: BookOpen01Icon,
  integrations: PlugSocketIcon,
  people: UserGroupIcon,
  school: School01Icon,
  security: Shield01Icon,
};

/**
 * The icon of each section, beside its name in the command palette and, for the
 * sections that stand alone, in the sidebar. A section added without one does not compile, and
 * no section draws the icon of another section, so each entry of the sidebar is told apart by
 * its icon alone.
 */
export const settingsSectionIcons: Record<
  SchoolSettingsGroup["sections"][number]["labelKey"],
  IconSvgElement
> = {
  audit: DocumentValidationIcon,
  billing: CreditCardIcon,
  classes: Presentation01Icon,
  clients: Plug01Icon,
  cohorts: UserMultiple02Icon,
  connections: ConnectIcon,
  grading: Target02Icon,
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
  webhooks: WebhookIcon,
};
