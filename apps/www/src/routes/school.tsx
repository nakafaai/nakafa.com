import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { textDirection } from "@repo/internationalization/src/direction";
import { localeTimeZone } from "@repo/internationalization/src/locale";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { IntlProvider, useTranslations } from "use-intl";
import { readSchoolRootFn } from "@/lib/tenant/root.functions";

/**
 * The providers of every school page: the school messages of the request's locale
 * with the request instant and the locale time zone, the design system and the
 * toaster. A school address names no locale, so the server negotiates it once here,
 * and the school layout and its boundaries below read the same messages.
 */
export const Route = createFileRoute("/school")({
  loader: () => readSchoolRootFn(),
  component: SchoolRoot,
});

function SchoolRoot(): ReactElement {
  const { locale, messages, now } = Route.useLoaderData();
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
        <SchoolToaster />
      </DesignSystemProvider>
    </IntlProvider>
  );
}

/** The toaster names its close and region labels in the school's messages. */
function SchoolToaster(): ReactElement {
  const t = useTranslations("Common");
  return (
    <Toaster
      closeButtonAriaLabel={t("close-notification")}
      containerAriaLabel={t("notifications")}
    />
  );
}
