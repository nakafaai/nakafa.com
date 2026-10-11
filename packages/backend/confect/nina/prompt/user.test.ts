import { describe, expect, it } from "@effect/vitest";
import {
  getLatestUserText,
  withTurnContext,
} from "@repo/backend/confect/nina/prompt/user";
import type { ModelMessage } from "ai";

const context = "# Runtime Context\n\n- url: https://nakafa.com/en/home";

describe("the runtime facts of a turn in a user message", () => {
  it("come first, in the same message as the learner's text and attachments", () => {
    const photo = { type: "image" as const, image: "photo" };
    const message = withTurnContext(
      {
        role: "user",
        content: [{ type: "text", text: "What is this?" }, photo],
      },
      context
    );

    expect(message).toEqual({
      role: "user",
      content: [
        {
          type: "text",
          text: context,
          providerOptions: { nina: { turnContext: true } },
        },
        { type: "text", text: "What is this?" },
        photo,
      ],
    });
  });

  it("wrap a plain text message into parts", () => {
    expect(
      withTurnContext({ role: "user", content: "What is a limit?" }, context)
    ).toMatchObject({
      content: [{ text: context }, { type: "text", text: "What is a limit?" }],
    });
  });

  it("are not the learner's words", () => {
    const message = withTurnContext(
      { role: "user", content: "Read https://example.com/limits" },
      context
    );
    const messages: ModelMessage[] = [
      { role: "user", content: "An earlier question" },
      message,
    ];

    expect(getLatestUserText(messages)).toBe("Read https://example.com/limits");
  });

  it("do not hide text a learner wrote that looks like them", () => {
    expect(
      getLatestUserText([
        {
          role: "user",
          content: [
            { type: "text", text: context },
            { type: "text", text: "Hello" },
          ],
        },
      ])
    ).toBe(`${context} Hello`);
  });

  it("leave a conversation without a learner message without text", () => {
    expect(
      getLatestUserText([{ role: "assistant", content: "Hello" }])
    ).toBeUndefined();
  });
});
