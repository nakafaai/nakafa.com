import { monospace } from "@repo/design-system/lib/monospace";
import {
  LocaleSchema,
  localeTimeZone,
} from "@repo/internationalization/src/locale";
import {
  createFileRoute,
  getRouteApi,
  notFound,
  Outlet,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { cn } from "cn";
import { Schema } from "effect";
import { IntlProvider } from "use-intl";
import { AppShell } from "@/components/sidebar/shell";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { SHELL_MESSAGE_NAMESPACES } from "@/lib/i18n/shell";

const ShellInput = Schema.Struct({ locale: Schema.String });

/** The article navigation of the shell, read on the server for every learn page. */
const readShellNavigation = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ShellInput))
  .handler(async ({ data }) => {
    const { getShellArticleNavigation } = await import(
      "@/lib/content/article/navigation"
    );
    return getShellArticleNavigation(getLocaleOrThrow(data.locale));
  });

const localeRoute = getRouteApi("/$locale");

/**
 * The student shell that every learn page shares, as the (main) layout of the
 * reference app. An unknown locale stops before any page loads. The shell's
 * messages load with the layout, so no part of it renders a raw message key.
 */
export const Route = createFileRoute("/$locale/_main")({
  beforeLoad: ({ params }) => {
    if (!Schema.is(LocaleSchema)(params.locale)) {
      throw notFound();
    }
  },
  loader: async ({ params }) => {
    const [articleNavigation, messages] = await Promise.all([
      readShellNavigation({ data: { locale: params.locale } }),
      readRouteMessages({
        data: { locale: params.locale, namespaces: SHELL_MESSAGE_NAMESPACES },
      }),
    ]);
    return { articleNavigation, messages };
  },
  component: MainLayout,
});

function MainLayout() {
  const { locale } = Route.useParams();
  const { articleNavigation, messages } = Route.useLoaderData();
  const localeData = localeRoute.useLoaderData();
  return (
    <IntlProvider
      locale={locale}
      messages={{ ...localeData.messages, ...messages }}
      now={localeData.now}
      timeZone={localeTimeZone(locale)}
    >
      <AppShell articleNavigation={articleNavigation}>
        <div className={cn(monospace, "contents")}>
          <Outlet />
        </div>
      </AppShell>
    </IntlProvider>
  );
}
