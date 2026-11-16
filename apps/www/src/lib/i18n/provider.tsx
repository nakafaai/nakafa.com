import { Effect } from "effect";
import type { ComponentProps } from "react";
import { IntlProvider } from "use-intl";
import { clientEnv } from "@/env.public";
import { reportMessage } from "@/lib/i18n/failure";

/**
 * Whether a message that cannot render stops the render: in development and tests, and in the acceptance builds that
 * set `VITE_STRICT_MESSAGES`, which every proof serves. A production build leaves it unset.
 */
const strict = import.meta.env.DEV || clientEnv.VITE_STRICT_MESSAGES === "true";

/**
 * The one provider of a route's messages. use-intl calls `onError` while it renders a message it cannot resolve, and
 * the report runs at that callback: in a strict build its failure stops the render, so a missing message fails the
 * prerender and every proof that reaches it. In production the message renders as nothing, never as its key path.
 */
export function MessagesProvider(
  props: Omit<
    ComponentProps<typeof IntlProvider>,
    "getMessageFallback" | "onError"
  >
) {
  return (
    <IntlProvider
      {...props}
      getMessageFallback={() => ""}
      onError={(error) => Effect.runSync(reportMessage(strict, error))}
    />
  );
}
