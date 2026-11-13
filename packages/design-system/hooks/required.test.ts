import { assert, describe, it } from "@effect/vitest";
import {
  OutsideProvider,
  useRequired,
} from "@repo/design-system/hooks/required";
import { Result } from "effect";
import { createContext, createElement } from "react";
import { renderToString } from "react-dom/server";

const NullContext = createContext<string | null>(null);
const UndefinedContext = createContext<string | undefined>(undefined);

/** Renders the value that the part `Reader` reads from `NullContext`. */
function Reader() {
  return useRequired(NullContext, "Reader");
}

/** Renders the value that the part `Missing` reads from `UndefinedContext`. */
function Missing() {
  return useRequired(UndefinedContext, "Missing");
}

/** Renders an element, or keeps what its render threw. */
function render(element: Parameters<typeof renderToString>[0]) {
  return Result.try({
    catch: (error) => error,
    try: () => renderToString(element),
  });
}

/** What rendering an element threw, or nothing when it rendered. */
function thrownBy(element: Parameters<typeof renderToString>[0]) {
  return Result.match(render(element), {
    onFailure: (error) => error,
    onSuccess: () => undefined,
  });
}

describe("useRequired", () => {
  it("reads the value of the nearest provider", () => {
    assert.deepStrictEqual(
      render(
        createElement(NullContext, { value: "inside" }, createElement(Reader))
      ),
      Result.succeed("inside")
    );
  });

  it("throws OutsideProvider with the part's name outside a provider", () => {
    const outside = thrownBy(createElement(Reader));
    const missing = thrownBy(createElement(Missing));

    assert.instanceOf(outside, OutsideProvider);
    assert.strictEqual(
      outside.message,
      "Reader renders outside the provider of its context."
    );
    assert.instanceOf(missing, OutsideProvider);
    assert.strictEqual(missing.part, "Missing");
  });
});
