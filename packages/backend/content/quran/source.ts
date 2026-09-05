import type { PublicationRow } from "@repo/backend/content/publication/source";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Context, type Effect, type Option } from "effect";

type QuranRow = PublicationRow<"quranRows">;

/** Exact immutable rows and bounded canonical Quran ranges. */
export class QuranSource extends Context.Service<
  QuranSource,
  {
    readonly row: (
      snapshotId: string,
      identity: string
    ) => Effect.Effect<Option.Option<QuranRow>, ReleaseError>;
    readonly metadata: (
      snapshotId: string,
      kind: QuranRow["kind"],
      limit: number
    ) => Effect.Effect<readonly QuranRow[], ReleaseError>;
    readonly chunks: (
      snapshotId: string,
      surahNumber: number,
      firstVerse: number,
      lastVerse: number,
      limit: number
    ) => Effect.Effect<readonly QuranRow[], ReleaseError>;
    readonly search: (
      snapshotId: string,
      appLocale: PublicationRow<"quranSearch">["appLocale"],
      assetId: string
    ) => Effect.Effect<readonly PublicationRow<"quranSearch">[], ReleaseError>;
  }
>()("content/QuranSource") {}
