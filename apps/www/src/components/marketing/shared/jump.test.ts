import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { Array as Arr } from "effect";
import {
  followHashJumps,
  LOADED_JUMP_SCRIPT,
  layOutDownTo,
} from "@/components/marketing/shared/jump";

/**
 * Places a long page: a first part outside any box, then each later part in a box
 * of its own, with the id of the part and of a heading inside it.
 */
function placeParts(ids: readonly string[]) {
  document.body.innerHTML = `<section id="hero"></section>${Arr.join(
    Arr.map(
      ids,
      (id) =>
        `<div class="later-section" data-part="${id}"><section id="${id}"><h2 id="${id}-title"></h2></section></div>`
    ),
    ""
  )}`;
}

/** The parts whose boxes lay out. */
function laidOutParts() {
  return Array.from(
    document.querySelectorAll("[data-laid-out]"),
    (box) => box.getAttribute("data-part") ?? ""
  );
}

describe("hash jumps on a long page", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
  });

  /** Runs the loaded-address script on a page opened at `#id`. */
  function layOutLoaded(id: string) {
    window.history.replaceState(null, "", `/#${encodeURIComponent(id)}`);
    new Function(LOADED_JUMP_SCRIPT)();
  }

  describe.each([
    {
      layOut: (id: string) => layOutDownTo(document, id),
      name: "a navigation",
    },
    { layOut: layOutLoaded, name: "a loaded address" },
  ])("by $name", ({ layOut }) => {
    it("lays out every box down to the target's own, and moves with the next jump", () => {
      placeParts(["forum", "reports", "faq"]);

      layOut("reports");
      expect(laidOutParts()).toStrictEqual(["forum", "reports"]);

      layOut("forum");
      expect(laidOutParts()).toStrictEqual(["forum"]);
    });

    it("reaches a target deep inside a box", () => {
      placeParts(["forum", "reports", "faq"]);

      layOut("faq-title");
      expect(laidOutParts()).toStrictEqual(["forum", "reports", "faq"]);
    });

    it("lets every box skip for a target above them, no hash, or an id the page lacks", () => {
      placeParts(["forum", "reports"]);

      layOut("hero");
      expect(laidOutParts()).toStrictEqual([]);

      layOut("reports");
      layOut("");
      expect(laidOutParts()).toStrictEqual([]);

      layOut("reports");
      layOut("pricing");
      expect(laidOutParts()).toStrictEqual([]);
    });

    it("reads an id that is no plain selector", () => {
      placeParts(["1:part"]);

      layOut("1:part");
      expect(laidOutParts()).toStrictEqual(["1:part"]);
    });
  });

  it("decodes a loaded address, and reads one that does not decode as written", () => {
    placeParts(["forum", "b\u00fccher", "%E0%A4%A"]);

    window.history.replaceState(null, "", "/#b%C3%BCcher");
    new Function(LOADED_JUMP_SCRIPT)();
    expect(laidOutParts()).toStrictEqual(["forum", "b\u00fccher"]);

    window.history.replaceState(null, "", "/#%E0%A4%A");
    new Function(LOADED_JUMP_SCRIPT)();
    expect(laidOutParts()).toStrictEqual(["forum", "b\u00fccher", "%E0%A4%A"]);
  });

  it("lays out down to the target of each navigation the router resolves, until it stops following", async () => {
    placeParts(["forum", "reports"]);
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
      routeTree: createRootRoute(),
    });
    const stop = followHashJumps(router);

    await router.navigate({ href: "/#reports" });
    expect(laidOutParts()).toStrictEqual(["forum", "reports"]);

    stop();
    await router.navigate({ href: "/#forum" });
    expect(laidOutParts()).toStrictEqual(["forum", "reports"]);
  });
});
