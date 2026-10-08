import { FunctionSpec, GroupSpec } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { asLeafGroup, isPublicLeaf } from "@repo/backend/scripts/refs/leaf";
import { Effect, Schema } from "effect";

const publicQuery = (name: string) =>
  FunctionSpec.publicQuery({ name, returns: () => Schema.String });
const internalMutation = (name: string) =>
  FunctionSpec.internalMutation({ name, returns: () => Schema.Boolean });

const publicOnly = GroupSpec.makeAt("access").addFunction(publicQuery("list"));
const internalOnly = GroupSpec.makeAt("storage").addFunction(
  internalMutation("sweep")
);
const mixed = GroupSpec.makeAt("auth")
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

describe("isPublicLeaf", () => {
  it("counts a leaf with a public function", () => {
    expect(isPublicLeaf(publicOnly)).toBe(true);
  });

  it("does not count a leaf whose functions are all internal", () => {
    expect(isPublicLeaf(internalOnly)).toBe(false);
  });

  it("counts a mixed leaf, which the generator writes whole", () => {
    expect(isPublicLeaf(mixed)).toBe(true);
  });

  it("counts a leaf whose public function sits in a nested group", () => {
    expect(
      isPublicLeaf(GroupSpec.makeAt("outer").addGroupAt("inner", publicOnly))
    ).toBe(true);
  });

  it("does not count a leaf whose nested group has only internal functions", () => {
    expect(
      isPublicLeaf(GroupSpec.makeAt("outer").addGroupAt("inner", internalOnly))
    ).toBe(false);
  });
});
