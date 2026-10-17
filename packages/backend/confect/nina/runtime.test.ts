import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { answerRunFor } from "@repo/backend/confect/nina/runtime";
import type { ModelMessage } from "ai";

/** A learner message that holds one file part of the given media type. */
const withFile = (mediaType: string): ModelMessage => ({
  role: "user",
  content: [{ type: "file", data: new Uint8Array([1]), mediaType }],
});

describe("answerRunFor", () => {
  it("runs a text-only message in the default runtime", () => {
    const message: ModelMessage = {
      role: "user",
      content: [{ type: "text", text: "Explain a limit." }],
    };

    expect(answerRunFor(message)).toBe(refs.internal.nina.response.run);
  });

  it("runs a message whose content is one string in the default runtime", () => {
    const message: ModelMessage = { role: "user", content: "Explain a limit." };

    expect(answerRunFor(message)).toBe(refs.internal.nina.response.run);
  });

  it("runs a message with an image in the default runtime", () => {
    const message: ModelMessage = {
      role: "user",
      content: [
        { type: "text", text: "Explain this diagram." },
        { type: "image", image: new Uint8Array([1]), mediaType: "image/png" },
      ],
    };

    expect(answerRunFor(message)).toBe(refs.internal.nina.response.run);
  });

  it("runs a file part that holds an image in the default runtime", () => {
    expect(answerRunFor(withFile("image/png"))).toBe(
      refs.internal.nina.response.run
    );
  });

  it("runs a PDF in the Node runtime", () => {
    expect(answerRunFor(withFile("application/pdf"))).toBe(
      refs.internal.nina.documents.run
    );
  });

  it("runs a text file in the Node runtime", () => {
    expect(answerRunFor(withFile("text/plain"))).toBe(
      refs.internal.nina.documents.run
    );
  });

  it("runs a message with an image and a PDF in the Node runtime", () => {
    const message: ModelMessage = {
      role: "user",
      content: [
        { type: "image", image: new Uint8Array([1]), mediaType: "image/png" },
        {
          type: "file",
          data: new Uint8Array([1]),
          mediaType: "application/pdf",
        },
      ],
    };

    expect(answerRunFor(message)).toBe(refs.internal.nina.documents.run);
  });
});
