import { FunctionSpec, GroupSpec } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { asLeafGroup, holdsVisibility } from "@repo/backend/scripts/refs/leaf";
import { Effect, Schema } from "effect";

const publicQuery = (name: string) =>
  FunctionSpec.publicQuery({ name, returns: () => Schema.String });
const internalMutation = (name: string) =>
  FunctionSpec.internalMutation({ name, returns: () => Schema.Boolean });

const publicOnly = GroupSpec.make().addFunction(publicQuery("list"));
const internalOnly = GroupSpec.make().addFunction(internalMutation("sweep"));
const mixed = GroupSpec.make()
  .addFunction(publicQuery("get"))
  .addFunction(internalMutation("claim"));

describe("asLeafGroup", () => {
  it.effect("returns the group that a leaf module default-exports", () =>
    Effect.gen(function* () {
      expect(
        yield* asLeafGroup("access/grants.spec", { default: publicOnly })
      ).toBe(publicOnly);
    })
  );

  it.effect("fails when a leaf module exports no group spec", () =>
    Effect.gen(function* () {
      expect(
        yield* asLeafGroup("access/grants.spec", {}).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "RefsLoadError",
        message: "access/grants.spec does not default-export a GroupSpec.",
      });
      expect(
        yield* asLeafGroup("access/grants.spec", { default: "text" }).pipe(
          Effect.flip
        )
      ).toMatchObject({ _tag: "RefsLoadError" });
    })
  );
});

describe("holdsVisibility", () => {
  it("counts a leaf with a function of the visibility", () => {
    expect(holdsVisibility(publicOnly, "public")).toBe(true);
    expect(holdsVisibility(internalOnly, "internal")).toBe(true);
  });

  it("does not count a leaf whose functions all have the other visibility", () => {
    expect(holdsVisibility(internalOnly, "public")).toBe(false);
    expect(holdsVisibility(publicOnly, "internal")).toBe(false);
  });

  it("counts a mixed leaf for both visibilities, which the generator writes whole", () => {
    expect(holdsVisibility(mixed, "public")).toBe(true);
    expect(holdsVisibility(mixed, "internal")).toBe(true);
  });

  it("counts a leaf whose function of the visibility sits in a nested group", () => {
    const nested = GroupSpec.addGroupsAt(GroupSpec.make(), {
      inner: publicOnly,
    });
    expect(holdsVisibility(nested, "public")).toBe(true);
    expect(holdsVisibility(nested, "internal")).toBe(false);
  });
});
