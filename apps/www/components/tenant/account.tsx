"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@repo/design-system/components/ui/sidebar-menu";
import { toast } from "@repo/design-system/lib/toast/notify";
import { languages } from "@repo/internationalization/data/lang";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect } from "effect";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { startTransition } from "react";
import { signOutSchoolAccount } from "@/components/tenant/account.client";
import { changeSchoolLanguage } from "@/components/tenant/language.client";

/**
 * Signs out, then returns to the school address, which shows the sign-in
 * surface. A failed sign-out shows its message and keeps the page.
 */
function signOut() {
  Effect.runFork(
    Effect.gen(function* () {
      const destination = yield* signOutSchoolAccount();
      if (destination === "home") {
        window.location.assign("/");
      }
    })
  );
}

/**
 * Saves the language that the account menu chose, then shows it. The page
 * stays in its language until the server answers, so the change is not shown
 * before it is saved. A failed save keeps the page as it is and shows one
 * message, and the viewer chooses the language again from the same menu.
 */
function changeLanguage(
  language: string,
  router: ReturnType<typeof useRouter>
) {
  startTransition(async () => {
    const render = await Effect.runPromise(changeSchoolLanguage(language));
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
    router.refresh();
  });
}

/**
 * The account menu of a school. Its links open the pages of the Nakafa account
 * on the main site, where the same session signs the viewer in.
 */
export function TenantAccountMenu() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton size="lg">{t("Auth.account")}</SidebarMenuButton>
        }
      />
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuGroup>
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
          <DropdownMenuItem
            render={
              <a
                href={
                  new URL(`/${locale}/user/settings/memory`, SITE_ORIGIN).href
                }
              >
                {t("School.nina-memory")}
              </a>
            }
          />
          <DropdownMenuItem
            render={
              <a href={new URL(`/${locale}/user/settings`, SITE_ORIGIN).href}>
                {t("School.account-settings")}
              </a>
            }
          />
          <DropdownMenuItem
            render={
              <a href={new URL(`/${locale}`, SITE_ORIGIN).href}>
                {t("School.back-to-learning")}
              </a>
            }
          />
          <DropdownMenuItem onClick={signOut}>
            {t("Auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
