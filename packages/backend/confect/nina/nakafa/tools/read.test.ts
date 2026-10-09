import { afterEach, describe, expect, it } from "@effect/vitest";
import { getNakafaContent } from "@repo/backend/agent/content";
import { CapabilityArtifactSchema } from "@repo/backend/client/nina/capability";
import { read } from "@repo/backend/confect/nina/nakafa/tools/read";
import {
  recordProgress,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
import { readNakafaContentRefFixture } from "@repo/contents/test/fixture";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, MutableList, Option, Schema } from "effect";

vi.mock("@repo/backend/agent/content", () => ({ getNakafaContent: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const content = {
  ...readNakafaContentRefFixture("id", "articles/science/limits", "articles"),
  title: "Batas fungsi",
  text: "Materi lengkap.",
  description: "Pelajari limit.",
};
const input = {
  content_ref: NakafaAgentContentRefInputSchema.make(content.url),
};
// The plain codec keeps every key, so a leak in any field fails the check.
// The contract codec drops undeclared keys: it proves only the artifact shape.
const encodeContract = Schema.encodeSync(
  Schema.fromJsonString(Schema.Array(CapabilityArtifactSchema))
);

describe("Nina content evidence", () => {
  it("publishes a bounded preview while returning full verified content to the Agent", async () => {
    vi.mocked(getNakafaContent).mockReturnValue(Effect.succeedSome(content));
    const { artifacts, publish } = recordProgress();
    const result = await runSpecialist(() =>
      read({ input, publish, toolCallId: "read" })
    );
    expect(result).toContain(content.text);
    expect(MutableList.toArray(artifacts)).toMatchObject([
      { id: "read", data: { status: "loading", input } },
      {
        id: "read",
        data: {
          status: "done",
          result: { title: content.title, content_id: content.content_id },
        },
      },
    ]);
    expect(() => encodeContract(MutableList.toArray(artifacts))).not.toThrow();
    expect(encodeJsonText(MutableList.toArray(artifacts))).not.toContain(
      content.text
    );
  });
  it.each(["missing", "failed"] as const)(
    "publishes an honest %s result without inventing content",
    async (kind) => {
      vi.mocked(getNakafaContent).mockReturnValue(
        kind === "missing"
          ? Effect.succeedNone
          : Effect.fail(
              new NakafaAgentDataReadError({
                message: "Content verification failed.",
              })
            )
      );
      const { artifacts, publish } = recordProgress();
      const text = await runSpecialist(() =>
        read({ input, publish, toolCallId: "read" })
      );
      expect(text).toBe(
        kind === "missing"
          ? "Nakafa content was not found."
          : "Content verification failed."
      );
      expect(
        Option.getOrThrow(Arr.last(MutableList.toArray(artifacts)))
      ).toMatchObject({
        data: { status: "error", error: text },
      });
    }
  );
});
