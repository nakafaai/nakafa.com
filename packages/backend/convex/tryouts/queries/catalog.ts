import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import {
  loadTryoutCatalog,
  loadTryoutSnapshotCatalog,
} from "@repo/backend/convex/contentRelease/tryout/catalog";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  readFilesystemDestinationPaths,
  readFilesystemSection,
  readFilesystemSet,
} from "@repo/backend/convex/tryouts/catalog/filesystem/content";
import {
  readFilesystemCountry,
  readFilesystemExam,
  readFilesystemHub,
  readFilesystemTrack,
} from "@repo/backend/convex/tryouts/catalog/filesystem/discovery";
import {
  readPublishedSection,
  readPublishedSet,
} from "@repo/backend/convex/tryouts/catalog/hierarchy";
import {
  readTryoutMetadata,
  tryoutMetadataArgsValidator,
  tryoutMetadataReturnValidator,
} from "@repo/backend/convex/tryouts/catalog/metadata";
import {
  readPublishedCountryPage,
  readPublishedExamPage,
  readPublishedHubPage,
  readPublishedSectionPage,
  readPublishedSetPage,
  readPublishedTrackPage,
} from "@repo/backend/convex/tryouts/catalog/published";
import { readTryoutRoute } from "@repo/backend/convex/tryouts/catalog/route";
import {
  publicTryoutCountryValidator,
  publicTryoutCountryWithExamCountValidator,
  publicTryoutExamValidator,
  publicTryoutQuestionContentValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import {
  matchesAttemptIdentity,
  readAttemptSetIdentity,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { v } from "convex/values";
import { Effect } from "effect";

const sectionPageFields = {
  exam: publicTryoutExamValidator,
  questions: v.array(publicTryoutQuestionContentValidator),
  section: publicTryoutSectionValidator,
  set: publicTryoutSetValidator,
  track: publicTryoutTrackValidator,
};
const sectionPageValidator = v.union(v.null(), v.object(sectionPageFields));
const attemptSectionPageValidator = v.union(
  v.null(),
  v.object({
    activeSectionPublicPath: v.union(v.string(), v.null()),
    activeSetPublicPath: v.union(v.string(), v.null()),
    attemptId: v.id("tryoutAttempts"),
    page: v.object(sectionPageFields),
  })
);
type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Checks one exact public route against its active signed try-out owner. */
export const getRoute = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.object({
    exists: v.boolean(),
    managed: v.boolean(),
  }),
  handler: (ctx, args) => runConvexProgram(readTryoutRoute(ctx, args)),
});

/** Reads exact SEO copy and localized paths from signed try-out ownership. */
export const getMetadata = query({
  args: tryoutMetadataArgsValidator,
  returns: tryoutMetadataReturnValidator,
  handler: (ctx, args) => runConvexProgram(readTryoutMetadata(ctx, args)),
});

/** Reads the localized country-first try-out hub page model. */
export const getHubPage = query({
  args: {
    locale: localeValidator,
  },
  returns: v.object({
    countries: v.array(publicTryoutCountryWithExamCountValidator),
  }),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(readPublishedHubPage(catalog));
    }
    return await runConvexProgram(readFilesystemHub(ctx, args.locale));
  },
});

/** Reads one active country page with its active exam family rows. */
export const getCountryPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exams: v.array(publicTryoutExamValidator),
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedCountryPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemCountry(ctx, args));
  },
});

/** Reads one active exam page with its active track rows. */
export const getExamPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exam: publicTryoutExamValidator,
      tracks: v.array(publicTryoutTrackValidator),
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedExamPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemExam(ctx, args));
  },
});

/** Reads one active track page shell for paginated set discovery. */
export const getTrackPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exam: publicTryoutExamValidator,
      track: publicTryoutTrackValidator,
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedTrackPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemTrack(ctx, args));
  },
});

/** Reads one try-out set and its ordered sections. */
export const getSetPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      exam: publicTryoutExamValidator,
      entryQuestions: v.array(publicTryoutQuestionContentValidator),
      entrySection: v.union(publicTryoutSectionValidator, v.null()),
      set: publicTryoutSetValidator,
      sections: v.array(publicTryoutSectionValidator),
      track: publicTryoutTrackValidator,
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedSetPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemSet(ctx, args));
  },
});

/** Reads public metadata for one try-out section. */
export const getSectionPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: sectionPageValidator,
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedSectionPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemSection(ctx, args));
  },
});

/** Reads one owned section from the user's frozen attempt snapshot. */
export const getAttemptSectionPage = query({
  args: {
    attemptId: v.optional(v.string()),
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: attemptSectionPageValidator,
  handler: (ctx, args) => runConvexProgram(readAttemptSectionPage(ctx, args)),
});

/** Resolves one frozen route without replacing it from the active catalog. */
const readAttemptSectionPage = Effect.fn(
  "tryouts.catalog.readAttemptSectionPage"
)(function* (
  ctx: QueryCtx,
  args: {
    readonly attemptId?: string;
    readonly locale: "en" | "id";
    readonly publicPath: string;
  }
) {
  const auth = yield* Effect.promise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }
  const separator = args.publicPath.lastIndexOf("/");
  if (separator <= 0) {
    return null;
  }
  const setPublicPath = args.publicPath.slice(0, separator);
  let attempt: Doc<"tryoutAttempts"> | null = null;
  if (args.attemptId) {
    const attemptId = ctx.db.normalizeId("tryoutAttempts", args.attemptId);
    if (!attemptId) {
      return null;
    }
    attempt = yield* Effect.promise(() => ctx.db.get(attemptId));
  } else {
    attempt = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex(
          "by_userId_and_locale_and_setPublicPath_and_startedAt",
          (index) =>
            index
              .eq("userId", auth.appUser._id)
              .eq("locale", args.locale)
              .eq("setPublicPath", setPublicPath)
        )
        .order("desc")
        .first()
    );
  }
  if (!(attempt && attempt.userId === auth.appUser._id)) {
    return null;
  }
  const attemptIdentity = yield* readAttemptSetIdentity(ctx, attempt);
  if (attemptIdentity?.locale !== args.locale) {
    return null;
  }
  if (!args.attemptId && attempt.status !== "in-progress") {
    return null;
  }
  const sectionSnapshot = attempt.sectionSnapshots.find(
    (section) => section.publicPath === args.publicPath
  );
  if (!sectionSnapshot) {
    return null;
  }
  const page = attempt.tryoutSnapshotId
    ? yield* readSignedAttemptSectionPage(
        ctx,
        args.locale,
        args.publicPath,
        attempt.tryoutSnapshotId
      )
    : yield* readFilesystemAttemptSectionPage(
        ctx,
        { ...args, setPublicPath },
        attempt,
        attemptIdentity,
        sectionSnapshot
      );
  if (!page) {
    return null;
  }
  const activeCatalog = yield* loadTryoutCatalog(ctx, args.locale);
  if (!args.attemptId) {
    const activePage = activeCatalog.managed
      ? yield* readPublishedSectionPage(activeCatalog, args.publicPath)
      : yield* readFilesystemSection(ctx, args);
    if (activePage) {
      const activeSetIdentity = {
        countryKey: activePage.set.countryKey,
        examKey: activePage.set.examKey,
        locale: args.locale,
        setKey: activePage.set.setKey,
        trackKey: activePage.set.trackKey,
      };
      if (
        !matchesAttemptIdentity(attemptIdentity, activeSetIdentity) ||
        activePage.section.sectionKey !== sectionSnapshot.sectionKey
      ) {
        return null;
      }
    }
  }
  const activeIdentity = {
    countryKey: page.set.countryKey,
    examKey: page.set.examKey,
    locale: args.locale,
    sectionKey: page.section.sectionKey,
    setKey: page.set.setKey,
    trackKey: page.set.trackKey,
  };
  if (!activeCatalog.managed) {
    const activePaths = yield* readFilesystemDestinationPaths(
      ctx,
      activeIdentity
    );
    return {
      ...activePaths,
      attemptId: attempt._id,
      page,
    };
  }

  const activeSet = yield* readPublishedSet(activeCatalog, activeIdentity);
  const activeSection = yield* readPublishedSection(
    activeCatalog,
    activeIdentity
  );
  return {
    activeSectionPublicPath: activeSection?.publicPath ?? null,
    activeSetPublicPath: activeSet?.publicPath ?? null,
    attemptId: attempt._id,
    page,
  };
});

/** Reads one route from the immutable signed catalog retained by an attempt. */
const readSignedAttemptSectionPage = Effect.fn(
  "tryouts.catalog.readSignedAttemptSectionPage"
)(function* (
  ctx: QueryCtx,
  locale: "en" | "id",
  publicPath: string,
  snapshotId: string
) {
  const catalog = yield* loadTryoutSnapshotCatalog(ctx, locale, snapshotId);
  return yield* readPublishedSectionPage(catalog, publicPath);
});

/** Reads a local attempt route only while its exact source rows remain intact. */
const readFilesystemAttemptSectionPage = Effect.fn(
  "tryouts.catalog.readFilesystemAttemptSectionPage"
)(function* (
  ctx: QueryCtx,
  args: {
    readonly locale: "en" | "id";
    readonly publicPath: string;
    readonly setPublicPath: string;
  },
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity,
  snapshot: TryoutSectionSnapshot
) {
  const tryoutSetId = attempt.tryoutSetId;
  const tryoutSectionId = snapshot.tryoutSectionId;
  const questionSetId = snapshot.questionSetId;
  if (!(tryoutSetId && tryoutSectionId && questionSetId)) {
    return null;
  }

  const [set, section] = yield* Effect.all(
    [
      Effect.promise(() => ctx.db.get(tryoutSetId)),
      Effect.promise(() => ctx.db.get(tryoutSectionId)),
    ],
    { concurrency: "unbounded" }
  );
  if (
    !(
      set &&
      section &&
      set.countryKey === identity.countryKey &&
      set.examKey === identity.examKey &&
      set.locale === args.locale &&
      set.publicPath === args.setPublicPath &&
      set.setKey === identity.setKey &&
      set.trackKey === identity.trackKey &&
      section.countryKey === identity.countryKey &&
      section.examKey === identity.examKey &&
      section.locale === args.locale &&
      section.order === snapshot.sectionOrder &&
      section.publicPath === args.publicPath &&
      section.questionCount === snapshot.questionCount &&
      section.questionSetId === questionSetId &&
      section.questionSourcePath === snapshot.questionSourcePath &&
      section.sectionKey === snapshot.sectionKey &&
      section.setKey === identity.setKey &&
      section.sourceRevision === snapshot.sourceRevision &&
      section.timeLimitSeconds === snapshot.timeLimitSeconds &&
      section.trackKey === identity.trackKey &&
      section.tryoutSetId === tryoutSetId
    )
  ) {
    return null;
  }

  return yield* readFilesystemSection(ctx, args);
});
