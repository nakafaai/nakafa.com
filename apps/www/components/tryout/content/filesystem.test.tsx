import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadFilesystemAnswers,
  loadFilesystemQuestions,
} from "@/components/tryout/content/filesystem";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { importContentModuleOrNull } from "@/lib/content/module";

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: vi.fn(),
}));
vi.mock("@/lib/content/module", () => ({
  importContentModuleOrNull: vi.fn(),
}));

const source = {
  contentHash: "question-hash",
  questionOrder: 1,
  sourcePath: "question-bank/tryout/example/question-1",
  sourceRevision: "2026",
};

/** Technical MDX component returned by the mocked filesystem loader. */
function Content() {
  return createElement("p", null, "Content");
}

describe("tryout filesystem content", () => {
  beforeEach(() => {
    vi.mocked(applyContentRuntimeCache).mockReset();
    vi.mocked(importContentModuleOrNull).mockReset();
  });

  it("loads questions without importing answer content", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue({
      default: Content,
    });

    const content = await loadFilesystemQuestions({
      locale: "id",
      questions: [source],
    });

    expect(content).toHaveLength(1);
    expect(importContentModuleOrNull).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: `${source.sourcePath}/question` })
    );
    expect(importContentModuleOrNull).not.toHaveBeenCalledWith(
      expect.objectContaining({ filePath: `${source.sourcePath}/answer` })
    );
  });

  it("rejects a question collection with one missing module", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue(null);

    await expect(
      loadFilesystemQuestions({ locale: "id", questions: [source] })
    ).resolves.toBeNull();
  });

  it("loads answers only through the authorized answer capability", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue({
      default: Content,
    });

    const content = await loadFilesystemAnswers({
      locale: "id",
      questions: [source],
    });

    expect(content).toHaveLength(1);
    expect(importContentModuleOrNull).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: `${source.sourcePath}/answer` })
    );
    expect(importContentModuleOrNull).not.toHaveBeenCalledWith(
      expect.objectContaining({ filePath: `${source.sourcePath}/question` })
    );
  });

  it("rejects an answer collection with one missing module", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue(null);

    await expect(
      loadFilesystemAnswers({ locale: "id", questions: [source] })
    ).resolves.toBeNull();
  });
});
