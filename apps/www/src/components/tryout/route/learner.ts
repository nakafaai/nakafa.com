import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { TryoutSectionContent } from "@repo/backend/confect/tryouts/runtime/spec";
import { Effect, Option } from "effect";
import type { PlayerMode } from "@/components/player/mode";
import { decodeTryoutBodies } from "@/components/tryout/content/body";
import { selectTryoutSectionReturnPath } from "@/components/tryout/route/owner";

/**
 * A learner's try-out page renders in the browser: the Worker serves the page every visitor sees, and
 * the page reads the learner's own attempt from Convex once the session is known. These are the pure
 * parts of that read: the request a URL asks for, and what the answer projects into for the page.
 */

type SetRequest = Ref.Args<
  typeof tryouts.queries.attemptPage.getSet
>["request"];
type SectionRequest = Ref.Args<
  typeof tryouts.queries.attemptPage.getSection
>["request"];

/** The keys that name one set in the catalog, as a set or section page carries them. */
type SetKeys = Pick<
  Extract<SetRequest, { readonly kind: "current" }>,
  "countryKey" | "examKey" | "setKey" | "trackKey"
>;

/**
 * The set request of a learner's URL: the attempt the URL names, or else the learner's current attempt
 * on the set.
 */
export function setAttemptRequest(input: {
  readonly attemptId: string | undefined;
  readonly keys: SetKeys;
  readonly locale: SetRequest["locale"];
  readonly publicPath: string;
}): SetRequest {
  return input.attemptId === undefined
    ? {
        countryKey: input.keys.countryKey,
        examKey: input.keys.examKey,
        kind: "current",
        locale: input.locale,
        setKey: input.keys.setKey,
        trackKey: input.keys.trackKey,
      }
    : {
        attemptId: input.attemptId,
        kind: "retained",
        locale: input.locale,
        publicPath: input.publicPath,
      };
}

/**
 * The section request of a learner's URL: the attempt the URL names, or else the learner's current
 * attempt through the section.
 */
export function sectionAttemptRequest(input: {
  readonly attemptId: string | undefined;
  readonly keys: SetKeys;
  readonly locale: SectionRequest["locale"];
  readonly publicPath: string;
  readonly sectionKey: string;
}): SectionRequest {
  return input.attemptId === undefined
    ? {
        countryKey: input.keys.countryKey,
        examKey: input.keys.examKey,
        kind: "current",
        locale: input.locale,
        sectionKey: input.sectionKey,
        setKey: input.keys.setKey,
        trackKey: input.keys.trackKey,
      }
    : {
        attemptId: input.attemptId,
        kind: "retained",
        locale: input.locale,
        publicPath: input.publicPath,
      };
}

/** The decoded bodies of a page read, or none when it carries none. */
export const decodeAttemptBodies = Effect.fn("www.tryout.learner.bodies")(
  function* (content: TryoutSectionContent) {
    return content.length === 0 ? null : yield* decodeTryoutBodies(content);
  }
);

/**
 * What a learner's set page shows from its page read, its bodies aside: the attempt bound to the page
 * with its state, view, and section routes; the page of a running attempt in place of the catalog's;
 * and the set to start again.
 */
export function projectSetAttempt<
  Page,
  Answer extends {
    readonly attemptId: string;
    readonly initialState: unknown;
    readonly kind: "current" | "retained";
    readonly page: { readonly sections: readonly unknown[] };
    readonly restartTarget: unknown;
  },
>(input: {
  readonly answer: Answer;
  readonly catalogPage: Page;
  readonly mode: PlayerMode;
}): {
  readonly binding: {
    readonly attemptId: Answer["attemptId"];
    readonly initialState: Answer["initialState"];
    readonly mode: PlayerMode;
    readonly sectionRoutes: Answer["page"]["sections"];
  };
  readonly page: Answer["page"] | Page;
  readonly restartTarget: Answer["restartTarget"];
} {
  const { answer } = input;
  return {
    binding: {
      attemptId: answer.attemptId,
      initialState: answer.initialState,
      mode: input.mode,
      sectionRoutes: answer.page.sections,
    },
    page: answer.kind === "retained" ? answer.page : input.catalogPage,
    restartTarget: answer.restartTarget,
  };
}

/**
 * What a learner's section page shows from its page read, its bodies aside: the attempt bound to the
 * page with its state, view, and the start link of the section it is on; its page; and the set page to
 * return to.
 */
export function projectSectionAttempt<
  Answer extends {
    readonly activeSectionPublicPath: string | null;
    readonly activeSetPublicPath: string | null;
    readonly attemptId: string;
    readonly initialState: unknown;
    readonly kind: "retained";
    readonly page: unknown;
  },
>(input: {
  readonly answer: Answer;
  readonly mode: PlayerMode;
  readonly setPath: string;
}): {
  readonly binding: {
    readonly attemptId: Answer["attemptId"];
    readonly initialState: Answer["initialState"];
    readonly mode: PlayerMode;
    readonly startPath: string | null;
  };
  readonly page: Answer["page"];
  readonly setPath: string;
} {
  const { answer } = input;
  return {
    binding: {
      attemptId: answer.attemptId,
      initialState: answer.initialState,
      mode: input.mode,
      startPath: answer.activeSectionPublicPath ?? null,
    },
    page: answer.page,
    setPath: selectTryoutSectionReturnPath({
      attemptPage: Option.some(answer),
      publicPath: input.setPath,
    }),
  };
}
