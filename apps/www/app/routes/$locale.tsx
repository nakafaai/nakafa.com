import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { TailwindIndicator } from "@repo/design-system/components/ui/tailwind-indicator";
import { textDirection } from "@repo/internationalization/src/direction";
import {
  DEFAULT_LOCALE,
  decodeLocale,
  localeTimeZone,
} from "@repo/internationalization/src/locale";
import { readRequestNow } from "@repo/internationalization/src/translator";
import {
  createFileRoute,
  type ErrorComponentProps,
  notFound,
  Outlet,
  useParams,
} from "@tanstack/react-router";
import { Option } from "effect";
import { IntlProvider, useTranslations } from "use-intl";
import {
  LocalizedError,
  LocalizedNotFound,
} from "@/components/state/localized";
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
  loader: async ({ params }) => ({
    messages: await readRouteMessages({
      data: { locale: params.locale, namespaces: SHELL_NAMESPACES },
    }),
    now: await readRequestNow(),
  }),
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
 * Shows the not-found page of a locale, with the links of the locale. The parse
 * refuses a first segment that is not a locale and keeps it raw, so this page
 * falls back to the default locale for that segment.
 */
function LocaleNotFound() {
  const { locale } = useParams({ from: "/$locale" });
  return (
    <LocalizedNotFound
      locale={Option.getOrElse(decodeLocale(locale), () => DEFAULT_LOCALE)}
    />
  );
}
