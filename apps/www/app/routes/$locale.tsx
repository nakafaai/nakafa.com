import { captureException } from "@repo/analytics/posthog/browser";
import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { TailwindIndicator } from "@repo/design-system/components/ui/tailwind-indicator";
import { textDirection } from "@repo/internationalization/src/direction";
import { decodeLocale } from "@repo/internationalization/src/locale";
import {
  createFileRoute,
  type ErrorComponentProps,
  notFound,
  Outlet,
  useParams,
} from "@tanstack/react-router";
import { Option } from "effect";
import { useEffect } from "react";
import { IntlProvider, useTranslations } from "use-intl";
import { ActionLink } from "@/components/state/action";
import { Broken } from "@/components/state/broken";
import { Missing } from "@/components/state/missing";
import { Stage } from "@/components/state/stage";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { readStandaloneMessages } from "@/lib/i18n/standalone";

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
  loader: ({ params }) =>
    readRouteMessages({
      data: { locale: params.locale, namespaces: SHELL_NAMESPACES },
    }),
  component: LocaleRoot,
  errorComponent: LocaleError,
  notFoundComponent: LocaleNotFound,
});

/** The providers of every locale page: the messages of the shell, the design system and the toaster. */
function LocaleRoot() {
  const { locale } = Route.useParams();
  const messages = Route.useLoaderData();
  return (
    <IntlProvider locale={locale} messages={messages}>
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
 * locale of the address, from the standalone dictionary, because the shell's
 * messages may be the failure itself.
 */
function LocaleError({ error }: ErrorComponentProps) {
  const { locale } = useParams({ from: "/$locale" });
  const messages = readStandaloneMessages(locale);
  useEffect(() => {
    captureException(error, { source: "start-locale-error" });
  }, [error]);
  return (
    <Stage>
      <Broken
        description={messages.Error.description}
        home={messages.State["home-button"]}
        homeHref={`/${locale}`}
        retry={messages.Error.retry}
        title={messages.Error.title}
      />
    </Stage>
  );
}

/** Shows the not-found page of a locale, with the links of the locale. */
function LocaleNotFound() {
  const { locale } = useParams({ from: "/$locale" });
  const messages = readStandaloneMessages(locale);
  return (
    <Stage>
      <Missing
        description={messages.NotFound.description}
        title={messages.NotFound.title}
      >
        <ActionLink
          href={`/${locale}`}
          label={messages.State["home-button"]}
          variant="default"
        />
        <ActionLink
          href={`/${locale}/search`}
          label={messages.NotFound["search-button"]}
          variant="ghost"
        />
      </Missing>
    </Stage>
  );
}
