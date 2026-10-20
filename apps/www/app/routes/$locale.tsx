import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { textDirection } from "@repo/internationalization/src/direction";
import { localeTimeZone } from "@repo/internationalization/src/locale";
import { getRouteMessages } from "@repo/internationalization/src/messages";
import { readRequestNow } from "@repo/internationalization/src/translator";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { IntlProvider, useTranslations } from "use-intl";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * The locale of every public page. An unknown locale answers 404 before the
 * page loads. The loader reads only the namespaces this layout renders and the
 * request instant, so the first HTML carries exactly the strings it shows.
 */
export const Route = createFileRoute("/$locale")({
  component: LocaleLayout,
  loader: async ({ params }) => ({
    messages: await getRouteMessages(getLocaleOrThrow(params.locale), [
      "Common",
    ]),
    now: await readRequestNow(),
  }),
  params: {
    parse: (raw) => ({ locale: getLocaleOrThrow(raw.locale) }),
    stringify: (params) => ({ locale: params.locale }),
  },
});

function LocaleLayout() {
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
        <Notifications />
      </DesignSystemProvider>
    </IntlProvider>
  );
}

function Notifications() {
  const t = useTranslations("Common");

  return (
    <Toaster
      closeButtonAriaLabel={t("close-notification")}
      containerAriaLabel={t("notifications")}
    />
  );
}
