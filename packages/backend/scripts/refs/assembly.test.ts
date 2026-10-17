import { describe, expect, it } from "@effect/vitest";
import { readAssembly } from "@repo/backend/scripts/refs/assembly";
import { Effect } from "effect";

/** Wraps one `Spec.fromGroups` expression the way Confect's codegen writes a spec: asserted to `typeof spec`. */
const assembled = (
  imports: string,
  groups: string
) => `import { GroupSpec, Spec } from "@confect/core";
${imports}
const spec: Spec.Spec<{}> = ${groups} as typeof spec;
export default spec;
`;

const NINA_IMPORTS = `import nina_turns from "../nina/turns.spec";
import nina_memory from "../nina/memory.spec";
`;

describe("readAssembly", () => {
  it.effect(
    "reads each default import with the group path of its group objects",
    () =>
      Effect.gen(function* () {
        const source = assembled(
          `${NINA_IMPORTS}import auth_deletion from "../auth/deletion.spec";
import auth_deletion_recovery from "../auth/deletion/recovery.spec";
import storage from "../storage.spec";
`,
          `Spec.fromGroups({
  ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["turns"]: nina_turns,
    ["memory"]: nina_memory,
  }),
  ["auth"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["deletion"]: GroupSpec.addGroupsAt(auth_deletion, {
      ["recovery"]: auth_deletion_recovery,
    }),
  }),
  ["storage"]: storage,
})`
        );

        expect(yield* readAssembly(source)).toEqual([
          {
            localName: "nina_turns",
            nestedSegments: ["nina", "turns"],
            specifier: "../nina/turns.spec",
          },
          {
            localName: "nina_memory",
            nestedSegments: ["nina", "memory"],
            specifier: "../nina/memory.spec",
          },
          {
            localName: "auth_deletion",
            nestedSegments: ["auth", "deletion"],
            specifier: "../auth/deletion.spec",
          },
          {
            localName: "auth_deletion_recovery",
            nestedSegments: ["auth", "deletion", "recovery"],
            specifier: "../auth/deletion/recovery.spec",
          },
          {
            localName: "storage",
            nestedSegments: ["storage"],
            specifier: "../storage.spec",
          },
        ]);
      })
  );

  it.effect("reads a spec that is written without an assertion", () =>
    Effect.gen(function* () {
      const source = `import { GroupSpec, Spec } from "@confect/core";
import storage from "../storage.spec";
const spec = Spec.fromGroups({ ["storage"]: storage });
export default spec;
`;

      expect(yield* readAssembly(source)).toEqual([
        {
          localName: "storage",
          nestedSegments: ["storage"],
          specifier: "../storage.spec",
        },
      ]);
    })
  );

  it.effect("fails when a default import is never nested", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Spec.fromGroups({
  ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["turns"]: nina_turns,
  }),
})`
      );

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: expect.stringContaining(
          "../nina/memory.spec must be nested exactly once"
        ),
      });
    })
  );

  it.effect("fails when a default import is nested twice", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Spec.fromGroups({
  ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["turns"]: nina_turns,
    ["memory"]: nina_memory,
  }),
  ["other"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["turns"]: nina_turns,
  }),
})`
      );

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: expect.stringContaining(
          "../nina/turns.spec must be nested exactly once"
        ),
      });
    })
  );

  it.effect("fails when a nested leaf is not a default import", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Spec.fromGroups({
  ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["turns"]: nina_turns,
    ["memory"]: nina_memory,
    ["ghost"]: ghost,
  }),
})`
      );

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message:
          "Every nested leaf must be a default import of the assembled spec.",
      });
    })
  );

  it.effect("fails when the source declares no spec", () =>
    Effect.gen(function* () {
      const source = `import { GroupSpec, Spec } from "@confect/core";
${NINA_IMPORTS}`;

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: "The assembled spec must declare const spec.",
      });
    })
  );

  it.effect("fails when the spec does not start from Spec.fromGroups()", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Other.fromGroups({
  ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["turns"]: nina_turns,
    ["memory"]: nina_memory,
  }),
})`
      );

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: "The assembled spec must start from Spec.fromGroups().",
      });
    })
  );

  it.effect("fails when Spec.fromGroups takes no group object", () =>
    Effect.gen(function* () {
      const source = assembled(NINA_IMPORTS, "Spec.fromGroups()");

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: "Spec.fromGroups takes one object of groups.",
      });
    })
  );

  it.effect(
    "fails when Spec.fromGroups takes a value that is not an object",
    () =>
      Effect.gen(function* () {
        const source = assembled(NINA_IMPORTS, "Spec.fromGroups(groups)");

        expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
          _tag: "RefsSourceError",
          message: "Spec.fromGroups takes one object of groups.",
        });
      })
  );

  it.effect("fails on a group name that is not a string literal", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Spec.fromGroups({
  [name]: GroupSpec.addGroupsAt(GroupSpec.make(), {
    ["turns"]: nina_turns,
    ["memory"]: nina_memory,
  }),
})`
      );

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: "Each nested group needs a string literal name.",
      });
    })
  );

  it.effect(
    "fails on a group expression that is neither a leaf nor a group",
    () =>
      Effect.gen(function* () {
        const source = assembled(
          NINA_IMPORTS,
          `Spec.fromGroups({
  ["nina"]: GroupSpec.addGroupsAt(build("nina"), {
    ["turns"]: nina_turns,
    ["memory"]: nina_memory,
  }),
})`
        );

        expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
          _tag: "RefsSourceError",
          message: "Unexpected group expression under nina.",
        });
      })
  );

  it.effect(
    "fails on a group expression that is not a GroupSpec.addGroupsAt call",
    () =>
      Effect.gen(function* () {
        const source = assembled(
          NINA_IMPORTS,
          `Spec.fromGroups({
  ["nina"]: GroupSpec.make(),
})`
        );

        expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
          _tag: "RefsSourceError",
          message: "Unexpected group expression under nina.",
        });
      })
  );

  it.effect("fails on a group object that is not an object literal", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Spec.fromGroups({
  ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), nina_turns),
})`
      );

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: "Unexpected group expression under nina.",
      });
    })
  );
});
