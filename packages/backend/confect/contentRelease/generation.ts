import { CompiledContentPayloadSchema } from "@nakafa/aksara-contracts/content";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Effect, Schema } from "effect";

/** Compiled-body format of the current contract, read from the installed contract. */
export const CURRENT_CONTENT_GENERATION =
  CompiledContentPayloadSchema.fields.format.literal;

/** The content generation that an active release was published under. */
export const contentGenerationValidator = Schema.Literal(
  CURRENT_CONTENT_GENERATION
);

/**
 * Refuses a release that builds on an active release whose content generation
 * is not recorded. The active release is the base of a candidate and the catalog
 * that a recovery restores. With no active release at all, there is no base.
 */
export const requireCurrentBase = Effect.fn(
  "contentRelease.requireCurrentBase"
)(function* (
  releaseId: string,
  state: Pick<
    Docs["contentState"],
    "activeContentGeneration" | "activeReleaseId"
  >
) {
  if (
    state.activeReleaseId === undefined ||
    state.activeContentGeneration === CURRENT_CONTENT_GENERATION
  ) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_STATE",
    `Content release ${releaseId} builds on an active release whose content generation is not recorded.`
  );
});
