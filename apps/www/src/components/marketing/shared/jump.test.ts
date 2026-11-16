import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { followHashJumps, markJump } from "@/components/marketing/shared/jump";

/** Places a long page's parts in the document, each a section with its own id. */
function placeParts(ids: readonly string[]) {
  document.body.innerHTML = Arr.join(
    Arr.map(ids, (id) => `<div><section id="${id}"></section></div>`),
    ""
  );
}

/** The ids of the parts that carry the jump mark. */
function markedIds() {
  return Array.from(
    document.querySelectorAll("[data-jump]"),
    (element) => element.id
  );
}

describe("hash jumps on a long page", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("marks the part a hash names, and moves the mark with the next jump", () => {
    placeParts(["forum", "reports", "faq"]);

    markJump(document, "reports");
    expect(markedIds()).toStrictEqual(["reports"]);

    markJump(document, "faq");
    expect(markedIds()).toStrictEqual(["faq"]);
  });

  it("clears the mark on a navigation without a hash or to an id the page lacks", () => {
    placeParts(["forum", "reports"]);

    markJump(document, "reports");
    markJump(document, "");
    expect(markedIds()).toStrictEqual([]);

    markJump(document, "reports");
    markJump(document, "pricing");
    expect(markedIds()).toStrictEqual([]);
  });

  it("reads an id that is no plain selector", () => {
    placeParts(["1:part"]);

    markJump(document, "1:part");
    expect(markedIds()).toStrictEqual(["1:part"]);
  });

  it("marks the target of each navigation the router resolves, until it stops following", async () => {
    placeParts(["forum", "reports"]);
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
      routeTree: createRootRoute(),
    });
    const stop = followHashJumps(router);

    await router.navigate({ href: "/#reports" });
    expect(markedIds()).toStrictEqual(["reports"]);

    stop();
    await router.navigate({ href: "/#forum" });
    expect(markedIds()).toStrictEqual(["reports"]);
  });
});
