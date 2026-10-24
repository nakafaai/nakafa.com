// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { messageInput, readNinaPage, retryInput } from "@/components/ai/turn";

const focus = {
  attemptId: Schema.decodeUnknownSync(Id("tryoutAttempts"))("attempt_1"),
  kind: "tryout-question",
  placementId: Schema.decodeUnknownSync(Id("tryoutAttemptPlacements"))(
    "placement_1"
  ),
} as const;

const LESSON = "/subjects/mathematics/functions/function-concept";
const HINT = "high-school~functions";

/** A router location as the page on screen reports it: the router's pathname and its search string. */
function visit(pathname: string, searchStr = "") {
  return { pathname, searchStr };
}

describe("ai/turn", () => {
  it("names the page without its locale prefix, and no context when the link carried none", () => {
    expect(readNinaPage(visit(`/id${LESSON}`))).toEqual({
      locale: "id",
      slug: LESSON,
    });
  });

  it("names the curriculum context that the link carried", () => {
    expect(readNinaPage(visit(`/en${LESSON}`, `?ctx=${HINT}`))).toEqual({
      locale: "en",
      materialContextHint: HINT,
      slug: LESSON,
    });
  });

  it("builds a message from the page, its files and its question focus", () => {
    expect(
      messageInput({
        focus,
        location: visit("/en/chat", `?ctx=${HINT}`),
        text: "Why?",
        uploadIds: [],
      })
    ).toEqual({
      kind: "message",
      page: { focus, locale: "en", materialContextHint: HINT, slug: "/chat" },
      prompt: { text: "Why?", uploadIds: [] },
    });
  });

  it("leaves the focus out of a message that has none", () => {
    expect(
      messageInput({
        focus: undefined,
        location: visit(`/id${LESSON}`),
        text: "Why?",
        uploadIds: [],
      })
    ).toEqual({
      kind: "message",
      page: { locale: "id", slug: LESSON },
      prompt: { text: "Why?", uploadIds: [] },
    });
  });

  it("sends a retry from a lesson page with the context that a new message from it sends", () => {
    const location = visit(`/en${LESSON}`, `?ctx=${HINT}`);

    const message = messageInput({
      focus: undefined,
      location,
      text: "Why?",
      uploadIds: [],
    });
    const retry = retryInput(2, location);

    expect(retry).toEqual({
      kind: "retry",
      order: 2,
      page: { locale: "en", materialContextHint: HINT, slug: LESSON },
    });
    expect(retry.page).toEqual(message.page);
  });

  it("sends a retry from a page without lesson context as the page only", () => {
    expect(retryInput(0, visit(`/id${LESSON}`))).toEqual({
      kind: "retry",
      order: 0,
      page: { locale: "id", slug: LESSON },
    });
  });
});
