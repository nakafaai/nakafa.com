import {
  ArrowTurnBackwardIcon,
  SchoolIcon,
  Settings01Icon,
  TranslateIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { toast } from "@repo/design-system/lib/toast/notify";
import { languages } from "@repo/internationalization/data/lang";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { useRouter } from "@tanstack/react-router";
import { Array as Arr, Effect } from "effect";
import { startTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ActiveBadge } from "@/components/shared/active";
import { CountryFlagIcon } from "@/components/shared/flag";
import {
  CommunityMenuItem,
  LearnMoreSubmenu,
  SiteAboutMenuItem,
} from "@/components/sidebar/menu/learn";
import { SidebarThemeSubmenu } from "@/components/sidebar/menu/preference";
import { useTenant } from "@/components/tenant/context";
import { changeSchoolLanguage } from "@/components/tenant/locale";
import { profileHref } from "@/lib/profile/href";
import { Link } from "@/lib/routing/link";

/**
 * Changes the language that the account menu chose at once, and saves it. The page shows the new language
 * before the server answers, and a save that fails returns the page to its language and says so, so the
 * viewer can choose again from the same menu.
 */
function changeLanguage(
  language: string,
  router: ReturnType<typeof useRouter>
) {
  Effect.runFork(
    Effect.gen(function* () {
      const outcome = yield* changeSchoolLanguage(language, () => {
        startTransition(() => {
          router.invalidate();
        });
      });
      if (outcome === "rolledBack") {
        toast.error(
          {
            description: "school-language-error.description",
            title: "school-language-error.title",
          },
          { position: "bottom-center" }
        );
      }
    })
  );
}

/**
 * The items of the school's account menu, between the account and sign-out, in at
 * most three groups with the icons of the Nakafa account menu: the person, the
 * school, then the preferences, Learn more and the way back to Nakafa. The
 * person's links open the pages of the Nakafa account on the main site, where the
 * same session signs the viewer in. The profile link is listed only for an account
 * with a username, as the Nakafa account menu lists it.
 */
export function TenantAccountItems({
  username,
}: {
  username: string | undefined;
}) {
  const { canManage, slug } = useTenant();
  const t = useTranslations();
  const locale = useLocale();

  return (
    <>
      <DropdownMenuGroup>
        {username === undefined ? null : (
          <DropdownMenuItem
            render={
              <a
                href={
                  new URL(`/${locale}${profileHref(username)}`, SITE_ORIGIN)
                    .href
                }
              >
                <HugeIcons icon={UserIcon} />
                {t("Auth.profile")}
              </a>
            }
          />
        )}
        <DropdownMenuItem
          render={
            <a href={new URL(`/${locale}/user/settings`, SITE_ORIGIN).href}>
              <HugeIcons icon={Settings01Icon} />
              {t("School.account-settings")}
            </a>
          }
        />
      </DropdownMenuGroup>
      {canManage ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link params={{ slug }} to="/school/$slug/settings/profile">
                  <HugeIcons icon={SchoolIcon} />
                  {t("SchoolSettings.manage-settings")}
                </Link>
              }
            />
          </DropdownMenuGroup>
        </>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <TenantLanguageSubmenu />
        <SidebarThemeSubmenu />
        <LearnMoreSubmenu>
          <SiteAboutMenuItem />
          <CommunityMenuItem />
        </LearnMoreSubmenu>
        <DropdownMenuItem
          render={
            <a href={new URL(`/${locale}`, SITE_ORIGIN).href}>
              <HugeIcons icon={ArrowTurnBackwardIcon} />
              {t("School.back-to-learning")}
            </a>
          }
        />
      </DropdownMenuGroup>
    </>
  );
}

/**
 * The language submenu of the school's account menu, drawn like the Nakafa one:
 * the language icon, each language's flag, and a mark on the language in use. A
 * choice is saved for the school's pages before it shows (`changeLanguage`).
 */
function TenantLanguageSubmenu() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const side = useSidebar((sidebar) => (sidebar.isMobile ? "top" : "right"));

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        <HugeIcons icon={TranslateIcon} />
        <span className="truncate">{t("language")}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-max max-w-[calc(100vw-2rem)]"
        side={side}
      >
        <DropdownMenuGroup>
          {Arr.map(languages, (language) => (
            <DropdownMenuItem
              className="cursor-pointer"
              key={language.value}
              onClick={() => changeLanguage(language.value, router)}
            >
              <CountryFlagIcon countryCode={language.countryCode} />
              <span className="truncate">{language.label}</span>
              <ActiveBadge isActive={locale === language.value} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
