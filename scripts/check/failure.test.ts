import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("FailurePolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

/** Lists the Effect-native findings of several modules as `file:line rule`. */
const fileFindings = Effect.fn("FailurePolicyTest.fileFindings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

describe("throw statements", () => {
  it.effect("reports each throw statement whatever its operand", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export function read(value: unknown) {
  if (value === undefined) {
    throw new Error("missing");
  }
  throw new TypeError("type");
}
export function rethrow() {
  try {
    run();
  } catch (error) {
    throw error;
  }
}
export function tagged() {
  throw new ParseFailure({ message: "bad" });
}
export function parenthesized() {
  throw (new RangeError("range"));
}
export function other(cause: unknown) {
  throw cause;
}
`),
        [
          "3 throw",
          "5 throw",
          "8 try-catch",
          "11 throw",
          "15 throw",
          "18 throw",
          "21 throw",
        ]
      );
    })
  );

  it.effect(
    "reports a throw in a plain module, a route, and a script, never in React, configuration, or tests",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* fileFindings([
            {
              file: "apps/www/components/guard.tsx",
              sourceText:
                'export function useCard() { if (!ready) throw new Error("outside provider"); return ready; }\n',
            },
            {
              file: "apps/www/app/[locale]/page.tsx",
              sourceText:
                'export default function Page() { throw new Error("no page"); }\n',
            },
            {
              file: "apps/www/app/api/route.ts",
              sourceText:
                'export function GET() { throw new Error("no route"); }\n',
            },
            {
              file: "apps/www/lib/read.ts",
              sourceText:
                'export const read = () => { throw new Error("read"); };\n',
            },
            {
              file: "apps/www/lib/client.ts",
              sourceText:
                '"use client";\nexport const read = () => { throw new Error("client"); };\n',
            },
            {
              file: "apps/www/lib/hook.ts",
              sourceText:
                'import { useState } from "react";\nexport const read = () => { throw new Error("hook"); };\n',
            },
            {
              file: "apps/www/next.config.ts",
              sourceText:
                'export const config = () => { throw new Error("config"); };\n',
            },
            {
              file: "scripts/tool.test.ts",
              sourceText:
                'export const test = () => { throw new Error("test"); };\n',
            },
            {
              file: "scripts/tool.ts",
              sourceText:
                'export const run = () => { throw new Error("fail"); };\n',
            },
          ]),
          [
            "apps/www/app/api/route.ts:1 throw",
            "apps/www/lib/read.ts:1 throw",
            "scripts/tool.ts:1 throw",
          ]
        );
      })
  );

  it.effect(
    "never reports Effect failures or text that only spells throw",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { Effect } from "effect";
export const failed = Effect.fail(new Error("x"));
export const defect = Effect.die(defectValue);
// throw new Error("comment")
export const message = "throw an error";
export const note = \`throw \${reason}\`;
`),
          []
        );
      })
  );

  it.effect(
    "exempts a Convex application error thrown in a vanilla Convex handler",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import { ConvexError, v } from "convex/values";
export const setUser = mutation({
  args: { authId: v.string() },
  handler: (ctx, args) => {
    if (!args.authId) {
      throw new ConvexError({ code: "MISSING" });
    }
    throw new Error("unexpected");
  },
});
`),
          ["9 throw"]
        );
      })
  );

  it.effect(
    "reports a Convex application error thrown outside a handler, from another module, or from a local class",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { ConvexError } from "convex/values";
export const fail = () => {
  throw new ConvexError("outside");
};
`),
          ["3 throw"]
        );
        assert.deepStrictEqual(
          yield* findings(`import { ConvexError } from "./errors";
export const setUser = mutation({
  handler: (ctx) => {
    throw new ConvexError("other module");
  },
});
`),
          ["4 throw"]
        );
        assert.deepStrictEqual(
          yield* findings(`class ConvexError {}
export const setUser = mutation({
  handler: (ctx) => {
    throw new ConvexError();
  },
});
`),
          ["4 throw"]
        );
      })
  );

  it.effect(
    "reports a Convex application error thrown from a call that is not a Convex builder",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { ConvexError } from "convex/values";
export const wrapped = wrap({
  handler: (ctx) => {
    throw new ConvexError("wrapped");
  },
});
`),
          ["4 throw"]
        );
      })
  );

  it.effect(
    "exempts a Convex application error in a handler, its method, a function it names, or wrapped options, but not in a callback it contains",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { action, internalMutation, query } from "@repo/backend/components/betterAuth/_generated/server";
import { ConvexError } from "convex/values";
export const search = query({
  handler: (ctx) => {
    ctx.run(() => {
      throw new ConvexError("nested");
    });
  },
});
export const method = action({
  handler(ctx) {
    throw new ConvexError("method");
  },
});
function handleBound(ctx) {
  throw new ConvexError("bound");
}
export const bound = internalMutation({ handler: handleBound });
export const kept = query(({ handler: (ctx) => { throw new ConvexError("kept"); } }) satisfies Options);
export const shared = query(sharedOptions);
`),
          ["6 throw"]
        );
      })
  );

  it.effect(
    "exempts a Convex application error under the local name of its named import",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import { ConvexError as Failure } from "convex/values";
export const setUser = mutation({
  handler: (ctx) => {
    throw new Failure("aliased");
  },
});
`),
          []
        );
      })
  );

  it.effect(
    "exempts the two Better Auth mutations that throw a ConvexError",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import { ConvexError, v } from "convex/values";
export const setUserId = mutation({
  args: { authId: v.string(), userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authId = ctx.db.normalizeId("user", args.authId);
    if (!authId) {
      throw new ConvexError({ code: "BETTER_AUTH_USER_ID_INVALID", message: "Better Auth user ID is invalid." });
    }
    await ctx.db.patch("user", authId, { userId: args.userId });
    return null;
  },
});
export const updateUserName = mutation({
  args: { authId: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authId = ctx.db.normalizeId("user", args.authId);
    if (!authId) {
      throw new ConvexError({ code: "BETTER_AUTH_USER_ID_INVALID", message: "Better Auth user ID is invalid." });
    }
    await ctx.db.patch("user", authId, { name: args.name });
    return null;
  },
});
`),
          []
        );
      })
  );

  it.effect(
    "exempts a Convex application error under an aliased builder import",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { mutation as m } from "@repo/backend/components/betterAuth/_generated/server";
import { ConvexError } from "convex/values";
export const setUser = m({
  handler: (ctx) => {
    throw new ConvexError("aliased builder");
  },
});
`),
          []
        );
      })
  );

  it.effect(
    "reports a Convex application error in a handler of a builder that another module exports",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { internalMutation } from "@repo/backend/confect/functions";
import { ConvexError } from "convex/values";
export const setUser = internalMutation({
  handler: (ctx) => {
    throw new ConvexError("confect");
  },
});
`),
          ["5 throw"]
        );
      })
  );

  it.effect(
    "reports a Convex application error in a handler of a function named like a builder",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { ConvexError } from "convex/values";
function mutation(options) {
  return options;
}
export const setUser = mutation({
  handler: (ctx) => {
    throw new ConvexError("local");
  },
});
`),
          ["7 throw"]
        );
      })
  );

  it.effect(
    "reports a Convex application error from a builder that the module does not import",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { ConvexError } from "convex/values";
export const setUser = mutation({
  handler: (ctx) => {
    throw new ConvexError("unimported builder");
  },
});
`),
          ["4 throw"]
        );
      })
  );

  it.effect(
    "reports a Convex application error in a handler whose builder a local binding shadows",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import { ConvexError } from "convex/values";
export function wrapped() {
  const mutation = (options) => options;
  return mutation({
    handler: (ctx) => {
      throw new ConvexError("shadowed builder");
    },
  });
}
`),
          ["7 throw"]
        );
      })
  );

  it.effect(
    "reports a Convex application error in a generator that a handler returns",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
export const setUser = mutation({
  handler: () =>
    Effect.gen(function* () {
      throw new ConvexError("generator");
    }),
});
`),
          ["7 throw"]
        );
      })
  );

  it.effect(
    "reports a Convex application error whose ConvexError a local class shadows in the handler",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
import { ConvexError } from "convex/values";
export const setUser = mutation({
  handler: (ctx) => {
    class ConvexError {}
    throw new ConvexError("shadowed");
  },
});
`),
          ["6 throw"]
        );
      })
  );

  it.effect("reports a plain Error thrown in a Convex handler", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { mutation } from "@repo/backend/components/betterAuth/_generated/server";
export const setUser = mutation({
  handler: (ctx) => {
    throw new Error("plain");
  },
});
`),
        ["4 throw"]
      );
    })
  );

  it.effect(
    "reports a Convex application error that a namespace or side-effect import binds",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import "convex/values";
import * as values from "convex/values";
export const setUser = mutation({
  handler: (ctx) => {
    throw new values.ConvexError("namespace");
  },
});
`),
          ["5 throw"]
        );
      })
  );

  it.effect(
    "reads the handler only from an options object of a builder call",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { ConvexError } from "convex/values";
export const bare = mutation();
export const named = mutation(options, () => {
  throw new ConvexError("argument");
});
`),
          ["4 throw"]
        );
      })
  );
});
