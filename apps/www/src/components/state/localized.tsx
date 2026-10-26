import { captureException } from "@repo/analytics/posthog/capture";
import type { Locale } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect } from "effect";
import { type ReactNode, useEffect, useState } from "react";
import { createStore, useStore } from "zustand";
import { ActionLink } from "@/components/state/action";
import { Broken } from "@/components/state/broken";
import { Missing } from "@/components/state/missing";
import { Stage } from "@/components/state/stage";
import { isStaleChunkError, reloadForStaleChunk } from "@/lib/chunks/stale";
import { readStandaloneMessages } from "@/lib/i18n/standalone";

/**
 * The not-found state of one locale, with its home and search links. It reads the
 * standalone dictionary, so it still speaks when the shell's messages are missing.
 * On a school host the home link is the main site's home, because the root of a
 * school that refused the visitor would answer not found again, and the search
 * link is left out, because a school has no search page.
 */
export function LocalizedNotFound({
  locale,
  school = false,
}: {
  readonly locale: Locale;
  readonly school?: boolean;
}) {
  const messages = readStandaloneMessages(locale);
  return (
    <Stage>
      <Missing
        description={messages.NotFound.description}
        title={messages.NotFound.title}
      >
        <ActionLink
          href={school ? new URL(`/${locale}`, SITE_ORIGIN).href : `/${locale}`}
          label={messages.State["home-button"]}
          variant="default"
        />
        {school ? null : (
          <ActionLink
            href={`/${locale}/search`}
            label={messages.NotFound["search-button"]}
            variant="ghost"
          />
        )}
      </Missing>
    </Stage>
  );
}

/**
 * The error component of a route. A chunk of an earlier deploy that a page,
 * loaded before the deploy, asked for is gone: the page reloads once at the same
 * address and loads the current chunks, and draws nothing meanwhile, so the
 * learner never sees an error for it. Every other failure, and a chunk that is
 * still missing after its reload, is reported and shows `children`.
 */
export function RouteFailure({
  children,
  error,
  source,
}: {
  readonly children: ReactNode;
  readonly error: unknown;
  readonly source: string;
}) {
  // Whether the page is reloading for a chunk of an earlier deploy. The reload
  // writes it, from the tab's storage, so it lives in a store of its own.
  const [reload] = useState(() =>
    createStore<boolean>()(() => isStaleChunkError(error))
  );
  const reloading = useStore(reload);

  useEffect(() => {
    if (!isStaleChunkError(error)) {
      return;
    }
    const reloaded = Effect.runSync(
      reloadForStaleChunk(error, window.sessionStorage, () =>
        window.location.reload()
      )
    );
    if (!reloaded) {
      reload.setState(false, true);
    }
  }, [error, reload]);

  if (reloading) {
    return null;
  }
  return (
    <>
      <ReportedFailure error={error} source={source} />
      {children}
    </>
  );
}

/** Reports one failure under its source; the failure page beside it draws it. */
function ReportedFailure({
  error,
  source,
}: {
  readonly error: unknown;
  readonly source: string;
}) {
  useReportedError(error, source);
  return null;
}

/** Reports the failure that a route's error component caught, once, under its source. */
function useReportedError(error: unknown, source: string) {
  useEffect(() => {
    captureException(error, { source });
  }, [error, source]);
}

/**
 * The error state of one locale, with a retry and a way home. It reads the
 * standalone dictionary; the error component that renders it reports the error
 * with `useReportedError`.
 */
export function LocalizedError({ locale }: { readonly locale: Locale }) {
  const messages = readStandaloneMessages(locale);
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
