import { afterEach, describe, expect, it } from "@effect/vitest";
import { MutableRef, Option } from "effect";
import { act, createElement, useRef, useState } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { useEarlyTyping } from "@/components/shared/typed";

/** The draft as the field's last render left it. */
const draft = MutableRef.make("");

/** A field drawn on the server and held by a draft, as a composer holds its words. */
function Field({ saved }: { saved: string }) {
  const [text, setText] = useState(saved);
  const field = useRef<HTMLTextAreaElement>(null);
  useEarlyTyping(field, text, setText);
  MutableRef.set(draft, text);
  return createElement("textarea", {
    name: "text",
    onChange: (event: { target: { value: string } }) =>
      setText(event.target.value),
    ref: field,
    value: text,
  });
}

let root: Option.Option<Root> = Option.none();

afterEach(() => {
  Option.map(root, (hydrated) => act(() => hydrated.unmount()));
  root = Option.none();
  document.body.replaceChildren();
});

/**
 * Draws the field's server HTML, types `typed` into it before React takes the page
 * over, then hydrates it. Answers the field.
 */
function typeThenHydrate(saved: string, typed: string) {
  const page = document.createElement("div");
  page.innerHTML = renderToString(createElement(Field, { saved }));
  document.body.append(page);
  const field = Option.getOrThrow(
    Option.fromNullishOr(page.querySelector("textarea"))
  );
  field.value = typed;
  act(() => {
    root = Option.some(hydrateRoot(page, createElement(Field, { saved })));
  });
  return field;
}

describe("useEarlyTyping", () => {
  it("gives the draft the words typed before React took the page over", () => {
    const field = typeThenHydrate("", "Hari ini belajar trigonometri.");

    expect(MutableRef.get(draft)).toBe("Hari ini belajar trigonometri.");
    expect(field.value).toBe("Hari ini belajar trigonometri.");
  });

  it("keeps a draft that already holds words of its own", () => {
    typeThenHydrate("Draf yang tersimpan.", "Draf yang tersimpan. Lagi");

    expect(MutableRef.get(draft)).toBe("Draf yang tersimpan.");
  });

  it("leaves an empty draft empty when nothing was typed", () => {
    const field = typeThenHydrate("", "");

    expect(MutableRef.get(draft)).toBe("");
    expect(field.value).toBe("");
  });
});
