import { useMutation } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/capture";
import island from "@repo/backend/confect/_generated/refs/island";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option, Result } from "effect";
import { useTranslations } from "use-intl";
import { useIsland } from "@/lib/island/context";
import { shareIslandChange } from "@/lib/island/edit";
import { visitHref } from "@/lib/island/visit";
import { useCurrentLocale } from "@/lib/routing/link";

/**
 * Shares the owner's island (ADR 0042, D20): a private island opens to anyone
 * with the link at once, through the optimistic change, and the link goes to
 * the phone's share sheet, or to the clipboard where there is none.
 */
export function useShareIsland() {
  const t = useTranslations("Island");
  const { owner } = useIsland();
  const locale = useCurrentLocale();
  const share = useMutation(island.mutations.share).withOptimisticUpdate(
    shareIslandChange
  );
  return () => {
    if (Option.isNone(owner) || Option.isNone(owner.value.username)) {
      return;
    }
    const href = visitHref(locale, owner.value.username.value);
    if (owner.value.visibility === "private") {
      Effect.runFork(
        Effect.tryPromise(() => share({ visibility: "link" })).pipe(
          Effect.flatMap((result) =>
            Effect.sync(() =>
              Result.match(result, {
                onFailure: (error) =>
                  captureException(error, { source: "island-share" }),
                onSuccess: () => undefined,
              })
            )
          ),
          Effect.catchTag("UnknownError", () => Effect.void)
        )
      );
    }
    const sheet = "share" in navigator;
    Effect.runFork(
      (sheet
        ? Effect.tryPromise(() =>
            navigator.share({ title: t("share-title"), url: href })
          )
        : Effect.tryPromise(() => navigator.clipboard.writeText(href)).pipe(
            Effect.tap(() =>
              Effect.sync(() =>
                toast.success({ title: "island-link-copied.title" })
              )
            )
          )
      ).pipe(Effect.catchTag("UnknownError", () => Effect.void))
    );
  };
}
