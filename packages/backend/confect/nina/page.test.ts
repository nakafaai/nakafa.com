import { afterEach, describe, expect, it } from "@effect/vitest";
import { getNakafaContent } from "@repo/backend/agent/content";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import { readPageContext } from "@repo/backend/confect/nina/page";
import { runSpecialist } from "@repo/backend/test/nina/specialist";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/agent/fixture";
import { Effect } from "effect";

vi.mock("@repo/backend/agent/content", () => ({ getNakafaContent: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

const route = "material/lesson/mathematics/example-topic/example-section";
const url = `https://nakafa.com/id/${route}`;

describe("Nina current page context", () => {
  it("places the signed page within the page budget", async () => {
    vi.mocked(getNakafaContent).mockReturnValue(
      Effect.succeedSome({
        ...readNakafaContentRefFixture("id", route, "material"),
        text: `Pengantar.\n\n## Definisi\n\n${"Fungsi memetakan domain. ".repeat(3000)}`,
        title: "Fungsi",
      })
    );
    const block = await runSpecialist(() => readPageContext(url));
    expect(block).toContain("# Current Page");
    expect(block).toContain("- Title: Fungsi");
    expect(block).toContain("Pengantar.");
    expect(countTextTokens(block)).toBeLessThanOrEqual(NINA_BUDGET.page + 60);
  });

  it.each(["missing", "failed"] as const)(
    "states the limitation instead of failing when the page is %s",
    async (kind) => {
      vi.mocked(getNakafaContent).mockReturnValue(
        kind === "missing"
          ? Effect.succeedNone
          : Effect.fail(
              NakafaAgentDataReadError.make({
                cause: "fixture",
                message: "Unable to read signed Nakafa public content.",
              })
            )
      );
      expect(await runSpecialist(() => readPageContext(url))).toContain(
        "The signed current page could not be read for this turn."
      );
    }
  );
});
