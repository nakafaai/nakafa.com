import { describe, expect, it } from "@effect/vitest";
import {
  focusNavigator,
  focusQuestion,
  isFocusInNavigator,
} from "@/components/player/navigator/focus";

/** A player of two questions, with the second one current in the sidebar. */
function mountPlayer() {
  document.body.innerHTML = `
    <article data-player-key="first" id="first" tabindex="-1"></article>
    <article data-player-key="second" id="second" tabindex="-1"></article>
    <aside data-player-sidebar="">
      <button id="cell-first" type="button"></button>
      <button aria-current="step" id="cell-second" type="button"></button>
    </aside>`;
}

describe("player focus", () => {
  it("moves focus to the current number of the sidebar", () => {
    mountPlayer();

    focusNavigator();

    expect(document.activeElement?.id).toBe("cell-second");
    expect(isFocusInNavigator()).toBe(true);
  });

  it("knows when focus is outside the sidebar", () => {
    mountPlayer();
    document.getElementById("first")?.focus();

    expect(isFocusInNavigator()).toBe(false);
  });

  it("moves focus back to a question", () => {
    mountPlayer();
    focusNavigator();

    focusQuestion("first");

    expect(document.activeElement?.id).toBe("first");
    expect(isFocusInNavigator()).toBe(false);
  });

  it("does nothing on a page without a sidebar", () => {
    document.body.innerHTML = "<button id='lone' type='button'></button>";
    document.getElementById("lone")?.focus();

    focusNavigator();

    expect(document.activeElement?.id).toBe("lone");
    expect(isFocusInNavigator()).toBe(false);
  });

  it("leaves focus alone without a question to return to", () => {
    mountPlayer();
    focusNavigator();

    focusQuestion(null);
    focusQuestion("missing");

    expect(isFocusInNavigator()).toBe(true);
  });
});
