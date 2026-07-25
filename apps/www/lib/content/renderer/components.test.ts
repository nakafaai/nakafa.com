// @vitest-environment node

import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import { describe, expect, it, vi } from "vitest";
import { getRendererComponents } from "@/lib/content/renderer/components";

vi.mock("server-only", () => ({}));
vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("next-intl", () => ({
  /** Keeps registry selection independent from navigation runtime behavior. */
  useTranslations: () => () => "",
}));

describe("renderer components", () => {
  it("selects one complete physical registry for every contract domain", () => {
    for (const rendererDomain of RENDERER_DOMAINS) {
      expect(getRendererComponents(rendererDomain)).toMatchObject(
        mdxComponents
      );
    }
  });
});
