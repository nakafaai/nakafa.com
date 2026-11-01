import { DesignSystemProvider } from "@repo/design-system";
import { Toaster } from "@repo/design-system/components/ui/sonner";
import {
  PRESS_ATTRIBUTE,
  PRESSED_ATTRIBUTE,
} from "@repo/design-system/hooks/use-press";
import { textDirection } from "@repo/internationalization/src/direction";
import { localeTimeZone } from "@repo/internationalization/src/locale";
import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { type ReactElement, useLayoutEffect } from "react";
import { IntlProvider, useTranslations } from "use-intl";
import { SchoolPending } from "@/components/tenant/pending";
import { SCHOOL_ENTRY_ID } from "@/lib/routing/shell";
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
 * so the school layout and its boundaries below read the same messages. The router
 * runs every beforeLoad before any loader, so the read starts in beforeLoad, beside
 * the school layout's frame read, and the loader answers it. The pending frame is what
 * the first HTML paints; it stands for the first load alone, so a navigation inside a
 * school never swaps the page for it.
 */
export const Route = createFileRoute("/school")({
  ssr: false,
  beforeLoad: () => ({ root: Effect.runPromise(readSchoolRoot()) }),
  loader: ({ context }) => context.root,
  headers: () => SCHOOL_HEADERS,
  pendingComponent: SchoolPending,
  pendingMinMs: 0,
  pendingMs: Number.POSITIVE_INFINITY,
  component: SchoolRoot,
});

/**
 * Removes the sign-in that a visitor's first HTML painted, once the router has drawn the page, so a member's
 * page, a refusal or a failure takes its place as the real sign-in does. A press on its Google button
 * passes to the real one, which replays it (`useEarlyPress`).
 */
function useEntryRelease() {
  const settled = useRouterState({
    select: (state) => state.status === "idle",
  });
  useLayoutEffect(() => {
    const entry = document.querySelector(`#${SCHOOL_ENTRY_ID}`);
    if (!settled || entry === null) {
      return;
    }
    const pressed = entry.querySelector(`[${PRESSED_ATTRIBUTE}]`) !== null;
    entry.remove();
    if (pressed) {
      document
        .querySelector(`[${PRESS_ATTRIBUTE}]`)
        ?.setAttribute(PRESSED_ATTRIBUTE, "");
    }
  }, [settled]);
}

function SchoolRoot(): ReactElement {
  const { locale, messages, now } = Route.useLoaderData();
  useEntryRelease();
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
