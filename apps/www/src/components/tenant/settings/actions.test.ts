import { describe, expect, it } from "@effect/vitest";
import { entries, opensTo } from "@repo/backend/confect/access/catalog";
import { Array as Arr, Order, Struct } from "effect";
import {
  IntegrationAction,
  toggleAction,
} from "@/components/tenant/settings/actions";

describe("components/tenant/settings/actions", () => {
  it("offers exactly the actions the integration catalog opens to a client", () => {
    const catalogActions = Arr.dedupe(
      Arr.flatMap(entries, (entry) => Struct.keys(entry.actions))
    );
    expect(
      Arr.sort(
        Arr.filter(catalogActions, (action) => opensTo(action, "integration")),
        Order.String
      )
    ).toEqual(Arr.sort(IntegrationAction.literals, Order.String));
  });

  it("checks an action and keeps the others checked, in the order the list shows them", () => {
    expect(toggleAction(["person.view"], "cohort.view", true)).toEqual([
      "cohort.view",
      "person.view",
    ]);
  });

  it("unchecks an action and keeps the others checked", () => {
    expect(
      toggleAction(["cohort.view", "person.view"], "cohort.view", false)
    ).toEqual(["person.view"]);
  });

  it("keeps the last checked action checked", () => {
    expect(toggleAction(["person.view"], "person.view", false)).toEqual([
      "person.view",
    ]);
  });
});
