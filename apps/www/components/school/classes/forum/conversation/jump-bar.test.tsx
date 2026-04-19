import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

/** Renders the jump bar once and returns the mounted DOM container. */
function renderJumpBar({
  showBack,
  showLatest,
}: {
  showBack: boolean;
  showLatest: boolean;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <JumpBar
        onBack={vi.fn()}
        onLatest={vi.fn()}
        showBack={showBack}
        showLatest={showLatest}
      />
    );
  });

  return { container, root };
}

describe("conversation/jump-bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when neither action is meaningful", () => {
    const { container, root } = renderJumpBar({
      showBack: false,
      showLatest: false,
    });

    expect(container.innerHTML).toBe("");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders only the back action when latest is already reached", () => {
    const { container, root } = renderJumpBar({
      showBack: true,
      showLatest: false,
    });

    expect(container.textContent).toContain("back");
    expect(container.querySelector('[aria-label="back-to-latest"]')).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders only the latest action when back is no longer needed", () => {
    const { container, root } = renderJumpBar({
      showBack: false,
      showLatest: true,
    });

    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(
      container.querySelector('[aria-label="back-to-latest"]')
    ).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders both actions when both are still meaningful", () => {
    const { container, root } = renderJumpBar({
      showBack: true,
      showLatest: true,
    });

    expect(container.textContent).toContain("back");
    expect(
      container.querySelector('[aria-label="back-to-latest"]')
    ).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
