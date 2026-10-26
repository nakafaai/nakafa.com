import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import { textDirection } from "@repo/internationalization/src/direction";
import { localeTimeZone } from "@repo/internationalization/src/locale";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Effect } from "effect";
import type { ReactElement } from "react";
import { IntlProvider, useTranslations } from "use-intl";
import { readSchoolRoot } from "@/lib/tenant/root";

/**
 * Every school document is private: it is never cached, it is not indexed, and
 * its page depends on the visitor's cookie and language.
 */
const SCHOOL_HEADERS = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex",
  vary: "Accept-Language, Cookie",
};

/**
 * The providers of every school page: the school messages of the visitor's locale
 * with the browser's instant and the locale time zone, the design system and the
 * toaster. A school renders only in the browser (ADR 0038 D2): the server sends the
 * root document with these headers, and the browser negotiates the locale once here,
 * so the school layout and its boundaries below read the same messages.
 */
export const Route = createFileRoute("/school")({
  ssr: false,
  loader: () => Effect.runPromise(readSchoolRoot()),
  headers: () => SCHOOL_HEADERS,
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
