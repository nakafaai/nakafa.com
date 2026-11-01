import { PlusSignIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect } from "effect";
import { type ReactNode, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useAuthSession } from "@/components/auth/session";
import { SchoolMark } from "@/components/tenant/mark";
import {
  type KnownSchool,
  loadKnownSchoolsText,
  readKnownSchools,
} from "@/lib/identity/schools";
import { schoolOrigin } from "@/lib/routing/school/host";

/** One school of the account menu: its mark and its name, as a link to the school's own address. */
export function SidebarSchoolMenuItem({ tenant }: { tenant: KnownSchool }) {
  return (
    <DropdownMenuItem
      render={(props) => (
        <a {...props} href={schoolOrigin(tenant.slug).href}>
          <SchoolMark logo={tenant.logo} mascot={tenant.mascot} />
          <span className="truncate">{tenant.name}</span>
        </a>
      )}
    />
  );
}

/** Reads the schools the browser kept, as their stored text. */
function readKeptText() {
  return Effect.runSync(loadKnownSchoolsText());
}

/**
 * The schools the browser kept for this session, as the menu last drew them.
 * Storage answers at once, so these rows stand in the menu's first frame, on the
 * phone sheet too, which mounts its own menu each time it opens.
 */
export function SidebarKnownSchoolItems() {
  const sessionId = useAuthSession((session) => session.sessionId);
  const [text] = useState(readKeptText);

  return (
    <>
      {Arr.map(readKnownSchools(text, sessionId), (tenant) => (
        <SidebarSchoolMenuItem key={tenant.slug} tenant={tenant} />
      ))}
    </>
  );
}

/**
 * The item that opens a new school: the questionnaire on the main site, named
 * by its full address, because the menu also shows on a school's own host.
 */
function SidebarStartSchoolMenuItem() {
  const t = useTranslations("Common");
  const locale = useLocale();

  return (
    <DropdownMenuItem
      render={(props) => (
        <a {...props} href={new URL(`/${locale}/school/new`, SITE_ORIGIN).href}>
          <HugeIcons icon={PlusSignIcon} />
          {t("open-school")}
        </a>
      )}
    />
  );
}

/**
 * The account's group of schools in its menu, under the heading "Your schools":
 * the caller's rows of schools, then the item that opens a new one when the
 * account may open a school (a school login account may not). The heading and that
 * item need no data, so the group stands from the menu's first frame. It takes no
 * room while it holds no item, so an account with neither a school nor the right
 * to open one sees no empty heading.
 */
export function SidebarSchools({
  canOpenSchool,
  children,
}: {
  canOpenSchool: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Common");

  return (
    <div className="contents not-has-[[role=menuitem]]:hidden">
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("your-schools")}</DropdownMenuLabel>
        {children}
        {canOpenSchool ? <SidebarStartSchoolMenuItem /> : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </div>
  );
}
