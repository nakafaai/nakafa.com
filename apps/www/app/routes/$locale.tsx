import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { TailwindIndicator } from "@repo/design-system/components/ui/tailwind-indicator";
import { textDirection } from "@repo/internationalization/src/direction";
import {
  decodeLocale,
  localeTimeZone,
} from "@repo/internationalization/src/locale";
import { readRequestNow } from "@repo/internationalization/src/translator";
import {
  makeEducationalOrganizationNode,
  makeWebsiteNode,
  type WebsiteInput,
} from "@repo/seo/json-ld/node";
import {
  createFileRoute,
  type ErrorComponentProps,
  notFound,
  Outlet,
  useParams,
} from "@tanstack/react-router";
import { Option } from "effect";
import { createTranslator, IntlProvider, useTranslations } from "use-intl";
import { AppNotFound } from "@/components/state/app";
import { LocalizedError } from "@/components/state/localized";
import { readRouteMessages } from "@/lib/i18n/messages.fn";

/** The messages that every locale page renders, under every route group. */
const SHELL_NAMESPACES = ["Common", "State", "Toast"] as const;

/**
 * The locale of every public URL. An unknown locale is not a route, so the
 * parse throws the router's not-found, which answers 404 before the stream.
 */
export const Route = createFileRoute("/$locale")({
  params: {
    parse: ({ locale }) => {
      const decoded = decodeLocale(locale);
      if (Option.isNone(decoded)) {
        throw notFound();
      }
      return { locale: decoded.value };
    },
    stringify: ({ locale }) => ({ locale }),
  },
  loader: async ({ params }) => {
    const [messages, metadata, now] = await Promise.all([
      readRouteMessages({
        data: { locale: params.locale, namespaces: SHELL_NAMESPACES },
      }),
      readRouteMessages({
        data: { locale: params.locale, namespaces: ["Metadata"] },
      }),
      readRequestNow(),
    ]);
    const t = createTranslator({
      locale: params.locale,
      messages: metadata,
      namespace: "Metadata",
    });
    return {
      messages,
      now,
      organization: {
        alternateName: t("title"),
        description: t("description"),
      },
    };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : toLocaleHead({ ...loaderData.organization, locale: params.locale }),
  component: LocaleRoot,
  errorComponent: LocaleError,
  notFoundComponent: LocaleNotFound,
});

/**
 * The providers of every locale page: the messages of the shell with the request
 * instant and the locale time zone, the design system and the toaster.
 */
function LocaleRoot() {
  const { locale } = Route.useParams();
  const { messages, now } = Route.useLoaderData();
  return (
    <IntlProvider
      locale={locale}
      messages={messages}
      now={now}
      timeZone={localeTimeZone(locale)}
    >
      <p className="sr-only">
        For AI agents: use <a href="/llms.txt">/llms.txt</a> for the Nakafa
        content index.
      </p>
      <DesignSystemProvider direction={textDirection(locale)}>
        <div className="isolate">
          <Outlet />
        </div>
        <ShellToaster />
      </DesignSystemProvider>
      <TailwindIndicator />
    </IntlProvider>
  );
}

/** The toaster names its close and region labels in the shell's messages. */
function ShellToaster() {
  const t = useTranslations("Common");
  return (
    <Toaster
      closeButtonAriaLabel={t("close-notification")}
      containerAriaLabel={t("notifications")}
    />
  );
}

/**
 * Shows a locale page that failed. It keeps the page's frame and speaks the
 * locale of the address, because the shell's messages may be the failure itself.
 */
function LocaleError({ error }: ErrorComponentProps) {
  const { locale } = useParams({ from: "/$locale" });
  return (
    <LocalizedError error={error} locale={locale} source="start-locale-error" />
  );
}

/**
 * The head of a locale page: the title and description that a page without its
 * own names, and the site's educational organization and website as JSON-LD
 * scripts. The router serializes each script, so it is named in the meta.
 */
function toLocaleHead({
  alternateName,
  description,
  locale,
}: typeof WebsiteInput.Type) {
  return {
    meta: [
      { title: alternateName },
      { content: description, name: "description" },
      {
        "script:ld+json": makeEducationalOrganizationNode({
          alternateName,
          description,
        }),
      },
      {
        "script:ld+json": makeWebsiteNode({
          alternateName,
          description,
          locale,
        }),
      },
    ],
  };
}

/** Shows the not-found page of a locale inside the app, so its links keep the app loaded. */
function LocaleNotFound() {
  const { locale } = useParams({ from: "/$locale" });
  return <AppNotFound locale={locale} />;
}
