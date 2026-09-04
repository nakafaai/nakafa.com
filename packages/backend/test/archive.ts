import { createHash } from "node:crypto";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";

declare const Convex: {
  readonly asyncSyscall: (operation: string, input: string) => Promise<string>;
};

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Seeds official hex and MIME metadata around convex-test's legacy fake. */
export function storeArchiveFixture(
  target: RuntimeTest,
  value: string,
  contentType: string
) {
  return target.run(async () => {
    const source = await Convex.asyncSyscall(
      "1.0/insert",
      JSON.stringify({
        table: "_storage",
        value: {
          contentType,
          sha256: createHash("sha256").update(value).digest("hex"),
          size: Buffer.byteLength(value),
        },
      })
    );
    const result = JSON.parse(source) as { readonly _id: Id<"_storage"> };
    return result._id;
  });
}
