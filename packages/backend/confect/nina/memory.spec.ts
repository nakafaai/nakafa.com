import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  onboardingFocusValidator,
  onboardingRegionValidator,
} from "@repo/backend/confect/onboarding/schema";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutScoreStatusValidator } from "@repo/backend/confect/tryouts/score";
import { Schema } from "effect";

/** Facts one learner's memory keeps; the least recently saved leave first. */
export const MEMORY_FACTS = 30;

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const FactKey = Count;

/** One remembered fact, phrased as a short statement about the learner. */
export const NinaMemoryText = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(160)
);

/** One fact and the conversation it came from, which it leaves with. */
export const NinaMemoryFact = Schema.Struct({
  chatId: Id("chats"),
  key: FactKey,
  savedAt: Schema.Finite,
  text: NinaMemoryText,
});

/** Provider tokens one curation call spent. */
export const NinaMemoryCall = Schema.Struct({ input: Count, output: Count });

/**
 * A learner's opted-in memory. It exists only while memory is on, keeps facts
 * ordered from least to most recently saved, and accumulates the provider
 * usage of its upkeep, which is not part of any turn's answer.
 */
export const NinaMemory = Schema.Struct({
  facts: Schema.mutable(Schema.Array(NinaMemoryFact)).check(
    Schema.isMaxLength(MEMORY_FACTS)
  ),
  next: FactKey,
  updatedAt: Schema.Finite,
  usage: Schema.Struct({ ...NinaMemoryCall.fields, calls: Count }),
  userId: Id("users"),
});

/** The facts a learner sees and manages in settings, newest first. */
export const NinaMemoryView = Schema.Struct({
  facts: Schema.mutable(
    Schema.Array(
      NinaMemoryFact.mapFields((fields) => ({
        key: fields.key,
        savedAt: fields.savedAt,
        text: fields.text,
      }))
    )
  ),
});

/**
 * Changes one curation call proposes: new facts, rewrites of stale facts by
 * key, and keys of facts the learner contradicted or withdrew.
 */
export const NinaMemoryChanges = Schema.Struct({
  forget: Schema.mutable(Schema.Array(FactKey)).check(Schema.isMaxLength(5)),
  remember: Schema.mutable(Schema.Array(NinaMemoryText)).check(
    Schema.isMaxLength(3)
  ),
  update: Schema.mutable(
    Schema.Array(Schema.Struct({ key: FactKey, text: NinaMemoryText }))
  ).check(Schema.isMaxLength(3)),
});

/** Correct answers in one section of the latest finished try-out. */
const NinaProfileSection = Schema.Struct({
  correct: Schema.Finite,
  key: tryoutRouteKeyValidator,
  total: Schema.Finite,
});

/** Account facts Nina reads for a turn; derived on read, never stored. */
export const NinaLearnerProfile = Schema.Struct({
  focus: Schema.optionalKey(onboardingFocusValidator),
  region: Schema.optionalKey(onboardingRegionValidator),
  tryout: Schema.optionalKey(
    Schema.Struct({
      correct: Schema.Finite,
      exam: tryoutRouteKeyValidator,
      finishedAt: Schema.Finite,
      score: Schema.Finite,
      sections: Schema.mutable(Schema.Array(NinaProfileSection)),
      set: tryoutRouteKeyValidator,
      status: tryoutScoreStatusValidator,
      total: Schema.Finite,
    })
  ),
  tryoutCountry: Schema.optionalKey(tryoutRouteKeyValidator),
});

/**
 * The memory document and revision a curation read. Turning memory off and on
 * creates a new document, and every write moves the revision.
 */
export const NinaMemoryRevision = Schema.Struct({
  id: Id("ninaMemories"),
  revision: Schema.Finite,
});

/** What instructions and curation know about one learner. */
export const NinaLearner = Schema.Struct({
  memory: Schema.NullOr(
    Schema.Struct({
      ...NinaMemoryRevision.fields,
      facts: Schema.mutable(
        Schema.Array(
          NinaMemoryFact.mapFields((fields) => ({
            key: fields.key,
            text: fields.text,
          }))
        )
      ),
    })
  ),
  profile: NinaLearnerProfile,
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      returns: () => Schema.NullOr(NinaMemoryView),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "enable",
      returns: () => NinaMemoryView,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "disable",
      returns: () => Schema.Null,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "forget",
      args: () => ({ key: FactKey }),
      returns: () => Schema.NullOr(NinaMemoryView),
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "read",
      args: () => ({ userId: Id("users") }),
      returns: () => NinaLearner,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "apply",
      args: () => ({
        changes: NinaMemoryChanges,
        chatId: Id("chats"),
        memory: NinaMemoryRevision,
        usage: NinaMemoryCall,
        userId: Id("users"),
      }),
      returns: () => Schema.Null,
    })
  );
