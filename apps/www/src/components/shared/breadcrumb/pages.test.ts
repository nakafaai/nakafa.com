import { describe, expect, it } from "@effect/vitest";
import { Leaf01Icon } from "@hugeicons/core-free-icons";
import { Option } from "effect";
import {
  crumbSiblings,
  siblingCrumb,
} from "@/components/shared/breadcrumb/pages";
import type { LinkTarget } from "@/lib/routing/link";
import { CURRICULA_TARGET, HOME_TARGET } from "@/lib/routing/target";

/** One page a crumb may offer, the crumb's own when `current`. */
function page(
  label: string,
  current: boolean,
  target: LinkTarget = HOME_TARGET
) {
  return { current, icon: Leaf01Icon, label, target };
}

describe("siblingCrumb", () => {
  it("opens the crumb's siblings when its place holds two pages or more", () => {
    const siblings = crumbSiblings({
      label: "Grade",
      options: [page("Class 10", false), page("Class 11", true)],
    });

    expect(siblingCrumb(siblings)).toEqual(
      Option.some({ label: "Class 11", siblings })
    );
  });

  it("links to the crumb's own page when it stands alone", () => {
    expect(
      siblingCrumb(
        crumbSiblings({
          label: "Grade",
          options: [page("Class 11", true, CURRICULA_TARGET)],
        })
      )
    ).toEqual(Option.some({ label: "Class 11", target: CURRICULA_TARGET }));
  });

  it("leaves out a crumb whose own page is not among its options", () => {
    expect(
      siblingCrumb(
        crumbSiblings({ label: "Grade", options: [page("Class 10", false)] })
      )
    ).toEqual(Option.none());
  });
});
