"use client";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { toast } from "@repo/design-system/lib/toast/notify";
import { languages } from "@repo/internationalization/data/lang";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect } from "effect";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { startTransition } from "react";
import { SidebarThemeSubmenu } from "@/components/sidebar/menu/preference";
import { changeSchoolLanguage } from "@/components/tenant/language.client";
import { profileHref } from "@/lib/profile/href";

/**
 * Saves the language that the account menu chose, then shows it. The page stays
 * in its language until the server answers, so the change is not shown before it
 * is saved. No transition waits for the answer: a saved language refreshes the
 * route in a transition that starts at once. A failed save keeps the page as it
 * is and shows one message, and the viewer chooses the language again from the
 * same menu.
 */
function changeLanguage(
  language: string,
  router: ReturnType<typeof useRouter>
) {
  Effect.runFork(
    Effect.gen(function* () {
      const render = yield* changeSchoolLanguage(language);
      if (render === "failed") {
        toast.error(
          {
            description: "school-language-error.description",
            title: "school-language-error.title",
          },
          { position: "bottom-center" }
        );
        return;
      }
      if (render === "reload") {
        window.location.reload();
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    })
  );
}

/**
 * The items of the school's account menu, between the account and sign-out. The
 * links open the pages of the Nakafa account on the main site, where the same
 * session signs the viewer in. The profile link is listed only for an account
 * with a username, as the Nakafa account menu lists it.
 */
export function TenantAccountItems({
  canManage,
  username,
}: {
  canManage: boolean;
  username: string | undefined;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  return (
    <>
      <DropdownMenuGroup>
        {canManage ? (
          <DropdownMenuItem
            render={
              <Link href="/settings/profile">
                {t("SchoolSettings.manage-settings")}
              </Link>
            }
          />
        ) : null}
        {username === undefined ? null : (
          <DropdownMenuItem
            render={
              <a
                href={
                  new URL(`/${locale}${profileHref(username)}`, SITE_ORIGIN)
                    .href
                }
              >
                {t("Auth.profile")}
              </a>
            }
          />
        )}
        <DropdownMenuItem
          render={
            <a href={new URL(`/${locale}/user/settings`, SITE_ORIGIN).href}>
              {t("School.account-settings")}
            </a>
          }
        />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <SidebarThemeSubmenu />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t("School.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuGroup>
              {Arr.map(languages, (language) => (
                <DropdownMenuItem
                  key={language.value}
                  onClick={() => changeLanguage(language.value, router)}
                >
                  {language.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem
          render={
            <a href={new URL(`/${locale}`, SITE_ORIGIN).href}>
              {t("School.back-to-learning")}
            </a>
          }
        />
      </DropdownMenuGroup>
    </>
  );
}
