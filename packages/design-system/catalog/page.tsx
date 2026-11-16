import { ThemeProvider } from "@repo/design-system/providers/theme";
import messages from "@repo/internationalization/dictionaries/en.json";
import { Array as Arr, Option } from "effect";
import type { ComponentType, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

/**
 * The context every Nakafa component may read: the English copy of the product, its locale and the visitor's theme.
 * A design that renders Nakafa components outside a card preview wraps them in `Root` once, at its top.
 */
export function Root({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <IntlProvider locale="en" messages={messages} timeZone="Asia/Jakarta">
        {children}
      </IntlProvider>
    </ThemeProvider>
  );
}

/**
 * Previews sit in cards on the design system page. An overlay that opens on load would move focus into its card and
 * scroll the page there, so focus and scrolling into view wait for the first interaction inside the preview.
 */
function holdFocus() {
  const focus = HTMLElement.prototype.focus;
  const scrollIntoView = Element.prototype.scrollIntoView;
  const state = { interacted: false };
  const release = () => {
    state.interacted = true;
  };
  addEventListener("pointerdown", release, { capture: true, once: true });
  addEventListener("keydown", release, { capture: true, once: true });
  HTMLElement.prototype.focus = function hold(options) {
    if (state.interacted) {
      focus.call(this, options);
    }
  };
  Element.prototype.scrollIntoView = function hold(options) {
    if (state.interacted) {
      scrollIntoView.call(this, options);
    }
  };
}

/** Mounts the live example of the card the preview document names, inside the product's context. */
export function catalog(
  cards: readonly { card: { name: string }; Preview: ComponentType }[]
) {
  return (name: string) => {
    const element = document.querySelector("#root");
    const entry = Arr.findFirst(cards, (item) => item.card.name === name);
    if (element === null || Option.isNone(entry)) {
      return;
    }
    const { Preview } = entry.value;
    holdFocus();
    createRoot(element).render(
      <Root>
        <Preview />
      </Root>
    );
  };
}
