import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadTryoutAnswerContent,
  loadTryoutQuestionContent,
} from "@/components/tryout/content/load";
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

function Content() {
  return createElement("p", null, "Content");
}

describe("tryout content loaders", () => {
  beforeEach(() => {
    vi.mocked(applyContentRuntimeCache).mockReset();
    vi.mocked(importContentModuleOrNull).mockReset();
  });

  it("loads question modules without importing answer content", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue({
      default: Content,
    });

    const content = await loadTryoutQuestionContent({
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

  it("fails the question collection when one module is missing", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue(null);

    await expect(
      loadTryoutQuestionContent({ locale: "id", questions: [source] })
    ).resolves.toBeNull();
  });

  it("loads only answer modules through the authorized loader", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue({
      default: Content,
    });

    const content = await loadTryoutAnswerContent({
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

  it("fails the answer collection when one module is missing", async () => {
    vi.mocked(importContentModuleOrNull).mockResolvedValue(null);

    await expect(
      loadTryoutAnswerContent({ locale: "id", questions: [source] })
    ).resolves.toBeNull();
  });
});
