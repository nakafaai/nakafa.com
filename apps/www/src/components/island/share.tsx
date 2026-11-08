import { useMutation } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/capture";
import island from "@repo/backend/confect/_generated/refs/island";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option, Result } from "effect";
import { useTranslations } from "use-intl";
import { useSnapshot } from "@/components/island/clip";
import { useIsland } from "@/lib/island/context";
import { shareIslandChange } from "@/lib/island/edit";
import { visitHref } from "@/lib/island/visit";
import { useCurrentLocale } from "@/lib/routing/link";

/** The module that sends a file to R2, loaded only when a snapshot is stored. */
const loadPut = () => import("@/lib/files/put");

/** Awaits one mutation answer, and fails with the typed error that the answer holds. */
const awaited = <A, E>(call: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise(call).pipe(Effect.flatMap(Effect.fromResult));

/**
 * Stores a drawn snapshot as the island's: reserves its bytes, sends it
 * straight to R2 at the reserved address, then keeps it, which replaces the
 * last. Nothing drawn stores nothing.
 */
function storeSnapshot<File, ReserveError, KeepError>(
  drawn: Effect.Effect<Option.Option<Blob>>,
  reserve: (
    byteSize: number
  ) => Promise<
    Result.Result<
      { readonly address: string; readonly fileId: File },
      ReserveError
    >
  >,
  keep: (fileId: File) => Promise<Result.Result<null, KeepError>>
) {
  return Effect.gen(function* () {
    const picture = yield* drawn;
    if (Option.isNone(picture)) {
      return;
    }
    const reserved = yield* awaited(() => reserve(picture.value.size));
    const { putFile } = yield* Effect.tryPromise(loadPut);
    yield* putFile(reserved.address, picture.value);
    yield* awaited(() => keep(reserved.fileId));
  });
}

/**
 * Shares the owner's island (ADR 0042, D20): a private island opens to anyone
 * with the link at once, through the optimistic change, and the link goes to
 * the phone's share sheet, or to the clipboard where there is none. Meanwhile
 * the island as it looks now becomes its snapshot, the picture the link shows
 * wherever it is posted; a snapshot that fails leaves the one it had.
 */
export function useShareIsland() {
  const t = useTranslations("Island");
  const { owner } = useIsland();
  const snapshot = useSnapshot();
  const locale = useCurrentLocale();
  const share = useMutation(island.mutations.share).withOptimisticUpdate(
    shareIslandChange
  );
  const reserve = useMutation(island.mutations.reserveSnapshot);
  const keep = useMutation(island.mutations.keepSnapshot);
  return () => {
    if (Option.isNone(owner) || Option.isNone(owner.value.username)) {
      return;
    }
    Effect.runFork(
      storeSnapshot(
        snapshot(),
        (byteSize) => reserve({ byteSize }),
        (fileId) => keep({ fileId })
      ).pipe(
        Effect.catch((error) =>
          Effect.sync(() =>
            captureException(error, { source: "island-snapshot" })
          )
        )
      )
    );
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
