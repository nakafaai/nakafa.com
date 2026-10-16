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
import { languages } from "@repo/internationalization/data/lang";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect, Result } from "effect";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { startTransition } from "react";
import { changeSchoolLanguage } from "@/components/tenant/language.client";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";

/** Signs out, then returns to the school address, which shows the sign-in surface. */
const signOut = Effect.gen(function* () {
  const result = yield* Effect.result(signOutAccountBrowserIdentity());
  if (Result.isSuccess(result)) {
    window.location.assign("/");
  }
});

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
                    onClick={() => {
                      startTransition(async () => {
                        const render = await Effect.runPromise(
                          changeSchoolLanguage(language.value)
                        );
                        if (render === "reload") {
                          window.location.reload();
                          return;
                        }
                        router.refresh();
                      });
                    }}
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
          <DropdownMenuItem onClick={() => Effect.runFork(signOut)}>
            {t("Auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
