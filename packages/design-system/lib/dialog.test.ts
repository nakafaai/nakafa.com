import { afterEach, describe, expect, it } from "@effect/vitest";
import { pressMainAction } from "@repo/design-system/lib/dialog";

afterEach(() => {
  document.body.replaceChildren();
});

/** A dialog's panel and footer, with what its field and its main action hold. */
function dialog(field: string, main: string) {
  const panel = document.createElement("div");
  const footer = document.createElement("div");

  panel.innerHTML = field;
  footer.innerHTML = `<button></button>${main}`;
  document.body.append(panel, footer);

  return { footer, panel };
}

/** Sends an Enter from the panel's first child, and answers how often the main action was pressed. */
function pressEnter(
  { footer, panel }: { footer: HTMLElement | null; panel: HTMLElement },
  overrides: Partial<Parameters<typeof pressMainAction>[0]> = {}
) {
  let pressed = 0;
  let prevented = 0;
  footer?.lastElementChild?.addEventListener("click", () => {
    pressed += 1;
  });
  pressMainAction(
    {
      currentTarget: panel,
      defaultPrevented: false,
      nativeEvent: new KeyboardEvent("keydown", { key: "Enter" }),
      preventDefault: () => {
        prevented += 1;
      },
      target: panel.firstElementChild ?? panel,
      ...overrides,
    },
    footer
  );

  return { pressed, prevented };
}

describe("pressMainAction", () => {
  it("presses the footer's last button on an Enter in a line of text, and takes the Enter", () => {
    expect(
      pressEnter(dialog('<input type="text" />', "<button></button>"))
    ).toEqual({ pressed: 1, prevented: 1 });
  });

  it("leaves a main action that is disabled unpressed", () => {
    expect(
      pressEnter(dialog('<input type="text" />', "<button disabled></button>"))
        .pressed
    ).toBe(0);
  });

  it("presses nothing when the footer ends in a link, and keeps the Enter", () => {
    expect(
      pressEnter(dialog('<input type="text" />', "<a href='/'>Go</a>"))
    ).toEqual({ pressed: 0, prevented: 0 });
  });

  it("leaves every Enter to a field that takes its own", () => {
    for (const field of [
      "<textarea></textarea>",
      '<input type="search" />',
      '<input type="checkbox" />',
      '<input role="combobox" type="text" />',
    ]) {
      expect(pressEnter(dialog(field, "<button></button>")).pressed).toBe(0);
    }
  });

  it("leaves an Enter that a field handled, composed, or that came through a portal", () => {
    const main = "<button></button>";

    expect(
      pressEnter(dialog('<input type="text" />', main), {
        defaultPrevented: true,
      }).pressed
    ).toBe(0);
    expect(
      pressEnter(dialog('<input type="text" />', main), {
        nativeEvent: new KeyboardEvent("keydown", {
          isComposing: true,
          key: "Enter",
        }),
      }).pressed
    ).toBe(0);
    expect(
      pressEnter(dialog('<input type="text" />', main), {
        nativeEvent: new KeyboardEvent("keydown", { key: "a" }),
      }).pressed
    ).toBe(0);

    const parts = dialog('<input type="text" />', main);
    const outside = document.createElement("input");

    document.body.append(outside);
    expect(pressEnter(parts, { target: outside }).pressed).toBe(0);
  });

  it("does nothing without a footer", () => {
    expect(
      pressEnter({
        footer: null,
        panel: dialog('<input type="text" />', "").panel,
      })
    ).toEqual({ pressed: 0, prevented: 0 });
  });
});
