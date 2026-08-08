import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import {
  loadAttemptSections,
  readAttemptResume,
} from "@repo/backend/convex/tryouts/runtime/attempt/sections";
import {
  readLatestAttemptByPath,
  readOwnedAttemptById,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import {
  loadSectionRuntime,
  readCurrentSection,
} from "@repo/backend/convex/tryouts/runtime/section/questions";
import { Effect } from "effect";

interface SectionStateArgs {
  readonly attemptId?: string;
  readonly locale: "en" | "id";
  readonly publicPath: string;
}

/** Resolves one owned section through its exact localized public path. */
const readCurrentUserSectionSelection = Effect.fn(
  "tryouts.runtime.readCurrentUserSectionSelection"
)(function* (ctx: QueryCtx, args: SectionStateArgs) {
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
    attempt = yield* readOwnedAttemptById(ctx, attemptId, auth.appUser._id);
  } else {
    attempt = yield* readLatestAttemptByPath(
      ctx,
      { locale: args.locale, publicPath: setPublicPath },
      auth.appUser._id
    );
    if (attempt?.status !== "in-progress") {
      return null;
    }
  }
  if (!attempt || attempt.locale !== args.locale) {
    return null;
  }

  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.publicPath === args.publicPath
  );
  if (!snapshot) {
    return null;
  }
  return { attempt, sectionKey: snapshot.sectionKey };
});

/** Reads one reactive attempt and its selected section runtime. */
export const readSectionState = Effect.fn("tryouts.runtime.readSectionState")(
  function* (ctx: QueryCtx, args: SectionStateArgs) {
    const selected = yield* readCurrentUserSectionSelection(ctx, args);
    if (!selected) {
      return null;
    }
    const { attempt, sectionKey } = selected;
    const sections = yield* loadAttemptSections(ctx, attempt);
    const section =
      sections.find((candidate) => candidate.sectionKey === sectionKey) ?? null;
    const resume = readAttemptResume(attempt, sections);
    const runtime = section
      ? yield* loadSectionRuntime(ctx, attempt, section)
      : null;
    const currentSection = section ? yield* readCurrentSection(section) : null;

    return {
      attempt: {
        attemptId: attempt._id,
        expiresAt: attempt.expiresAt,
        resumeSectionKey: resume.resumeSectionKey,
        resumeSectionPublicPath: resume.resumeSectionPublicPath,
        section: currentSection,
        status: attempt.status,
      },
      runtime,
    };
  }
);
