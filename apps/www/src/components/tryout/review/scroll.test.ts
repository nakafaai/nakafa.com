import { afterEach, describe, expect, it } from "@effect/vitest";
import { scrollExplanationIntoView } from "@/components/tryout/review/scroll";

function stubMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced }))
  );
}

function stubAnimationFrame() {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
}

describe("scrollExplanationIntoView", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("scrolls smoothly when motion is allowed and uses auto when reduced motion is preferred", () => {
    stubAnimationFrame();
    const panel = document.createElement("div");
    const section = document.createElement("section");
    section.id = "question-1-explanation";
    const scrollIntoView = vi.fn();
    section.scrollIntoView = scrollIntoView;
    panel.append(section);
    document.body.append(panel);

    stubMedia(false);
    scrollExplanationIntoView("question-1-explanation");
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "smooth",
      block: "start",
    });

    stubMedia(true);
    scrollExplanationIntoView("question-1-explanation");
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "auto",
      block: "start",
    });
  });

  it("does nothing when the explanation element is absent", () => {
    stubAnimationFrame();
    stubMedia(false);

    expect(() =>
      scrollExplanationIntoView("question-99-explanation")
    ).not.toThrow();
  });

  it("waits for panel height animations and skips scrolling if the panel closed mid-animation", async () => {
    stubAnimationFrame();
    stubMedia(false);

    const panel = document.createElement("div");
    panel.setAttribute("data-open", "");
    const section = document.createElement("section");
    section.id = "question-2-explanation";
    const scrollIntoView = vi.fn();
    section.scrollIntoView = scrollIntoView;
    panel.append(section);
    document.body.append(panel);

    const finished = Promise.resolve();
    Reflect.set(panel, "getAnimations", () => [{ finished }]);

    scrollExplanationIntoView("question-2-explanation");
    expect(scrollIntoView).not.toHaveBeenCalled();

    await finished;
    await Promise.resolve();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    // If the panel closes before its animation settles, skip scrolling.
    scrollIntoView.mockClear();
    panel.removeAttribute("data-open");
    scrollExplanationIntoView("question-2-explanation");
    await finished;
    await Promise.resolve();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
