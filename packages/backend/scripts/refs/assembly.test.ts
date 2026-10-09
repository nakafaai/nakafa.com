import { describe, expect, it } from "@effect/vitest";
import { readAssembly } from "@repo/backend/scripts/refs/assembly";
import { Effect } from "effect";

/** Wraps one `Spec.make()` chain in the imports that the assembled spec declares. */
const assembled = (
  imports: string,
  chain: string
) => `import { GroupSpec, Spec } from "@confect/core";
${imports}
const spec: Spec.Spec<{}> = ${chain};
export default spec;
`;

const NINA_IMPORTS = `import nina_turns from "../nina/turns.spec";
import nina_memory from "../nina/memory.spec";
`;

describe("readAssembly", () => {
  it.effect(
    "reads each default import with the group path of its addAt and addGroupAt calls",
    () =>
      Effect.gen(function* () {
        const source = assembled(
          `${NINA_IMPORTS}import auth_deletion from "../auth/deletion.spec";
import auth_deletion_recovery from "../auth/deletion/recovery.spec";
import storage from "../storage.spec";
`,
          `Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("turns", nina_turns).addGroupAt("memory", nina_memory)).addAt("auth", GroupSpec.makeAt("auth").addGroupAt("deletion", auth_deletion.addGroupAt("recovery", auth_deletion_recovery))).addAt("storage", storage)`
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

  it.effect("fails when a default import is never nested", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("turns", nina_turns))`
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
        `Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("turns", nina_turns).addGroupAt("memory", nina_memory)).addAt("other", GroupSpec.makeAt("other").addGroupAt("turns", nina_turns))`
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
        `Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("turns", nina_turns).addGroupAt("memory", nina_memory).addGroupAt("ghost", ghost))`
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

  it.effect("fails when the chain does not start from Spec.make()", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Other.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("turns", nina_turns).addGroupAt("memory", nina_memory))`
      );

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: "The assembled spec must start from Spec.make().",
      });
    })
  );

  it.effect("fails on a group name that is not a string literal", () =>
    Effect.gen(function* () {
      const source = assembled(
        NINA_IMPORTS,
        `Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt(name, nina_turns).addGroupAt("memory", nina_memory))`
      );

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: "Each nested group needs a string literal name.",
      });
    })
  );

  it.effect("fails on an addAt call with one argument", () =>
    Effect.gen(function* () {
      const source = assembled(NINA_IMPORTS, `Spec.make().addAt("nina")`);

      expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
        _tag: "RefsSourceError",
        message: "addAt takes a name and a group.",
      });
    })
  );

  it.effect(
    "fails on a group expression that is neither a leaf nor a group",
    () =>
      Effect.gen(function* () {
        const source = assembled(
          NINA_IMPORTS,
          `Spec.make().addAt("nina", build("nina").addGroupAt("turns", nina_turns).addGroupAt("memory", nina_memory))`
        );

        expect(yield* readAssembly(source).pipe(Effect.flip)).toMatchObject({
          _tag: "RefsSourceError",
          message: "Unexpected group expression under nina.",
        });
      })
  );
});
