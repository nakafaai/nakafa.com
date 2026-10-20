import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { textDirection } from "@repo/internationalization/src/direction";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { IntlProvider, useTranslations } from "use-intl";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * The locale of every public page. An unknown locale answers 404 before the
 * page loads, and the messages of the locale load with the route, so the
 * first HTML already holds every translated string.
 */
export const Route = createFileRoute("/$locale")({
  component: LocaleLayout,
  loader: ({ params }) => loadLocaleMessages(getLocaleOrThrow(params.locale)),
  params: {
    parse: (raw) => ({ locale: getLocaleOrThrow(raw.locale) }),
    stringify: (params) => ({ locale: params.locale }),
  },
});

function LocaleLayout() {
  const { locale } = Route.useParams();
  const messages = Route.useLoaderData();

  return (
    <IntlProvider locale={locale} messages={messages}>
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
