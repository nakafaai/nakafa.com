import { monospace } from "@repo/design-system/lib/monospace";
import { localeTimeZone } from "@repo/internationalization/src/locale";
import { createFileRoute, getRouteApi, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { cn } from "cn";
import { Schema } from "effect";
import { IntlProvider } from "use-intl";
import { PageProviders } from "@/components/providers/page";
import { SharedProviders } from "@/components/providers/shared";
import { AppShell } from "@/components/sidebar/shell";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { SHELL_MESSAGE_NAMESPACES } from "@/lib/i18n/shell";
import { runServerEffect } from "@/lib/server/fn";
import { readStaticData } from "@/lib/static/data";

const ShellInput = Schema.Struct({ locale: Schema.String });

/**
 * The messages of the student shell and of the learn pages that the locale route
 * does not carry. The Common, State and Toast messages come from the locale route.
 * Pricing is here because a finished try-out set offers Pro, and the signed-in
 * screens read it from here too. ComingSoon is the body of a lesson, an article,
 * a curriculum page or a try-out catalog that has no content yet.
 */
const MAIN_NAMESPACES = [
  ...SHELL_MESSAGE_NAMESPACES,
  "ComingSoon",
  "Comments",
  "Player",
  "Posts",
  "Pricing",
  "Tryouts",
] as const;

/** The navigation of the shell, read on the server for every learn page. */
const readShellNavigation = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ShellInput))
  .handler(async ({ data }) => {
    const locale = getLocaleOrThrow(data.locale);
    const { readMarketingShell } = await import("@/lib/marketing/shell.server");
    return runServerEffect(readMarketingShell(locale));
  });

const localeRoute = getRouteApi("/$locale");

/**
 * The student shell that every learn page and signed-in screen shares. An
 * unknown locale stops before any page loads. The shell's messages load with the
 * layout, so no part of it renders a raw message key.
 */
export const Route = createFileRoute("/$locale/_main")({
  loader: async ({ params }) => {
    const [messages, shell] = await Promise.all([
      readStaticData(readRouteMessages, {
        locale: params.locale,
        namespaces: MAIN_NAMESPACES,
      }),
      readStaticData(readShellNavigation, { locale: params.locale }),
    ]);
    return { ...shell, messages };
  },
  component: MainLayout,
});

/**
 * Renders the student shell inside the page providers, which hold the one live
 * session of a learner and a visitor alike. Convex is not mounted for the group:
 * each leaf that reads it mounts its own island, so a visitor's lesson opens no
 * socket.
 */
function MainLayout() {
  const { locale } = Route.useParams();
  const { articleNavigation, messages, pageNavigation } = Route.useLoaderData();
  const localeData = localeRoute.useLoaderData();
  return (
    <IntlProvider
      locale={locale}
      messages={{ ...localeData.messages, ...messages }}
      now={localeData.now}
      timeZone={localeTimeZone(locale)}
    >
      <PageProviders pageNavigation={pageNavigation}>
        <SharedProviders>
          <AppShell articleNavigation={articleNavigation}>
            <div className={cn(monospace, "contents")}>
              <Outlet />
            </div>
          </AppShell>
        </SharedProviders>
      </PageProviders>
    </IntlProvider>
  );
}
