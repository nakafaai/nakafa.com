import { DesignSystemProvider } from "@repo/design-system";
import { buttonVariants } from "@repo/design-system/lib/button";
import { textDirection } from "@repo/internationalization/src/direction";
import { localeTimeZone } from "@repo/internationalization/src/locale";
import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { IntlProvider, useTranslations } from "use-intl";
import { AuthGoogle } from "@/components/auth/google";
import { AuthLegal } from "@/components/auth/legal";
import { SignInScreen } from "@/components/auth/screen";
import { EntryShellArtwork } from "@/components/entry/artwork";
import {
  EntryShell,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { authLegalLinks } from "@/lib/auth/legal";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { readMarketingShellFn } from "@/lib/marketing/shell.functions";
import { readNotFoundRouteLocale } from "@/lib/routing/not-found";
import { SCHOOL_ENTRY_ID } from "@/lib/routing/shell";
import { readStaticData } from "@/lib/static/data";

/** The namespaces of the parts that the sign-in draws. */
const ENTRY_NAMESPACES = [
  "Auth",
  "Common",
  "Legal",
  "SchoolEntry",
  "SchoolGuardians",
  "Toast",
] as const;

/**
 * The sign-in of a school host in one locale, as a visitor's first HTML paints it. The build prerenders this page and
 * moves its sign-in into a copy of the browser shell, which the Worker answers a visitor with (ADR 0038 D2), so no
 * browser ever routes to it. It draws what holds for every school, from the parts of `TenantEntry`, in the same places.
 */
export const Route = createFileRoute("/_entry/school/$locale")({
  loader: async ({ params }) => {
    const locale = readNotFoundRouteLocale(params.locale);
    const [messages, shell] = await Promise.all([
      readStaticData(readRouteMessages, {
        locale,
        namespaces: ENTRY_NAMESPACES,
      }),
      readStaticData(readMarketingShellFn, { locale }),
    ]);
    return {
      legal: Option.getOrNull(authLegalLinks(locale, shell.pageNavigation)),
      locale,
      messages,
    };
  },
  component: SchoolEntryPage,
});

/** Holds the sign-in above whatever the shell draws, so the page takes its place in one commit. */
function SchoolEntryPage() {
  const { legal, locale, messages } = Route.useLoaderData();
  return (
    <IntlProvider
      locale={locale}
      messages={messages}
      timeZone={localeTimeZone(locale)}
    >
      <DesignSystemProvider direction={textDirection(locale)}>
        <div
          className="bg-background fixed inset-0 z-50 overflow-y-auto"
          id={SCHOOL_ENTRY_ID}
        >
          <EntryShell>
            <EntryShellPanel>
              <EntryShellHeader>
                <div className="ms-auto">
                  <ThemePicker variant="ghost" />
                </div>
              </EntryShellHeader>
              {/* The school's mark and name are not known here, so their places stand empty at their size. */}
              <SignInScreen
                action={<SchoolEntryActions />}
                figure={<div className="size-24" />}
                legal={<AuthLegal links={legal} />}
              >
                <div className="h-8" />
              </SignInScreen>
            </EntryShellPanel>
            <EntryShellArtwork />
          </EntryShell>
        </div>
      </DesignSystemProvider>
    </IntlProvider>
  );
}

/** The ways in that `TenantEntryActions` draws. Its two links work before any script, and name their addresses from the school's root. */
function SchoolEntryActions() {
  const t = useTranslations("SchoolEntry");
  const tGuardian = useTranslations("SchoolGuardians");
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <AuthGoogle />
      <a
        className={buttonVariants({ variant: "outline" })}
        href="?sign-in=username"
      >
        {t("username-action")}
      </a>
      <a className={buttonVariants({ variant: "ghost" })} href="parents">
        {tGuardian("sign-in-action")}
      </a>
    </div>
  );
}
