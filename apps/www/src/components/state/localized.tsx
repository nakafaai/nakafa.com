import { captureException } from "@repo/analytics/posthog/capture";
import type { Locale } from "@repo/internationalization/src/locale";
import { useEffect } from "react";
import { ActionLink } from "@/components/state/action";
import { Broken } from "@/components/state/broken";
import { Missing } from "@/components/state/missing";
import { Stage } from "@/components/state/stage";
import { readStandaloneMessages } from "@/lib/i18n/standalone";

/**
 * The not-found state of one locale, with its home and search links. It reads the
 * standalone dictionary, so it still speaks when the shell's messages are missing.
 * A page that stands on a host without the app's routes names the origin of the
 * app, so its links reach the app.
 */
export function LocalizedNotFound({
  locale,
  origin = "",
}: {
  readonly locale: Locale;
  readonly origin?: string;
}) {
  const messages = readStandaloneMessages(locale);
  return (
    <Stage>
      <Missing
        description={messages.NotFound.description}
        title={messages.NotFound.title}
      >
        <ActionLink
          href={`${origin}/${locale}`}
          label={messages.State["home-button"]}
          variant="default"
        />
        <ActionLink
          href={`${origin}/${locale}/search`}
          label={messages.NotFound["search-button"]}
          variant="ghost"
        />
      </Missing>
    </Stage>
  );
}

/**
 * The error state of one locale, with a retry and a way home. It reports the
 * error once under its source, and reads the standalone dictionary.
 */
export function LocalizedError({
  error,
  locale,
  source,
}: {
  readonly error: unknown;
  readonly locale: Locale;
  readonly source: string;
}) {
  const messages = readStandaloneMessages(locale);
  useEffect(() => {
    captureException(error, { source });
  }, [error, source]);
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
