import { cn } from "cn";
import { Array as Arr, Effect, Option } from "effect";
import type { KeyValueStore } from "effect/persistence";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";
import { keptStorage } from "@/components/player/storage";
import { useLiveSession } from "@/components/providers/live";
import {
  KEPT_NAME_SCRIPT,
  keepActionName,
  keepAttemptLabel,
  readKeptAttempt,
  readKeptName,
  type TryoutActionNameKey,
  TryoutActionNameSchema,
} from "@/components/tryout/set/kept";
import { hasSignedInHint } from "@/lib/auth/hint";

/**
 * The name on a try-out action. The button hugs the one name it shows. No first paint knows a
 * learner's attempt, and a static page paints the same HTML for everyone, so a name that is `pending`
 * reads as it is for a visitor, and under a signed-in hint (`globals.css`) it shows what this browser
 * last read for the page, or keeps the room of `name` with nothing in it on a first visit, until the
 * learner read answers: a running attempt never reads Start. A session that could not be read answers
 * nothing, so the name then shows. Restart is the one name that folds to its icon in a narrow header:
 * it stands beside the attempt picker, and the set's title needs the room.
 */
export function TryoutActionName({
  name,
  pending = false,
}: {
  readonly name: TryoutActionNameKey;
  /** The learner read that decides this name has not answered yet. */
  readonly pending?: boolean;
}) {
  const t = useTranslations("Tryouts");
  const failed = useLiveSession((state) => state.hasError);
  return (
    <span
      className="@max-md/header:contents"
      data-learner-read={pending && !failed ? "pending" : undefined}
      data-slot="tryout-action-name"
    >
      {pending ? (
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only.
          dangerouslySetInnerHTML={{ __html: KEPT_NAME_SCRIPT }}
          suppressHydrationWarning
        />
      ) : null}
      {Arr.map(TryoutActionNameSchema.literals, (key) => (
        <span
          className={cn(
            key !== name && "hidden",
            key === "restart-cta" && "@max-md/header:sr-only"
          )}
          data-name={key}
          key={key}
        >
          {t(key)}
        </span>
      ))}
    </span>
  );
}

/** Keeps the name a page's read answered with, once it has answered. */
export function useKeepActionName(
  address: string,
  name: TryoutActionNameKey | null
) {
  useEffect(() => {
    if (name !== null) {
      Effect.runFork(keepActionName(address, name));
    }
  }, [address, name]);
}

/** Keeps the label a page's picker shows, once its attempts have answered. */
export function useKeepAttemptLabel(
  address: string,
  label: string | undefined
) {
  useEffect(() => {
    if (label !== undefined) {
      Effect.runFork(keepAttemptLabel(address, label));
    }
  }, [address, label]);
}

/** What a browser kept does not change under a page, so nothing ever says it did. */
function subscribeToNothing() {
  return () => undefined;
}

/** Reads what this browser kept. Storage the page cannot read keeps nothing. */
function readKept(
  read: Effect.Effect<
    Option.Option<string>,
    KeyValueStore.KeyValueStoreError,
    KeyValueStore.KeyValueStore
  >
) {
  return Effect.runSync(
    read.pipe(
      Effect.provide(keptStorage),
      Effect.map(Option.getOrUndefined),
      Effect.orElseSucceed(() => undefined)
    )
  );
}

/**
 * The name this browser kept for the page it is on. An inline script names a hard load's first paint,
 * but React draws a learner's page and a navigation's, where no inline script runs.
 */
export function useKeptPageName() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => readKept(readKeptName(window.location.pathname)),
    () => undefined
  );
}

/** The picker label this browser kept for the page it is on, for a signed-in reader only. */
export function useKeptPageAttempt() {
  return useSyncExternalStore(
    subscribeToNothing,
    () =>
      hasSignedInHint(document.cookie)
        ? readKept(
            readKeptAttempt(window.location.pathname, window.location.search)
          )
        : undefined,
    () => undefined
  );
}
