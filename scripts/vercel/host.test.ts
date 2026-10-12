import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Order } from "effect";
import { initRepository } from "#scripts/effect/test.fixture";
import { makeNodeHost } from "#scripts/vercel/host";

describe("makeNodeHost", () => {
  it.effect(
    "reads the repository that contains the directory it is given",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const folder = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "vercel-host-test-",
        });
        const root = `${folder}/repository`;
        const first = yield* initRepository(root, {
          "apps/api/package.json": '{"name":"api"}',
          "apps/www/package.json": '{"name":"www"}',
        });

        // Vercel starts the step in the root directory of the project.
        const host = makeNodeHost(`${root}/apps/www`);

        assert.strictEqual(host.git(["rev-parse", "HEAD"]).trim(), first);
        assert.deepStrictEqual(Arr.sort(host.list("apps"), Order.String), [
          "api",
          "www",
        ]);
        assert.strictEqual(
          host.read("apps/www/package.json"),
          '{"name":"www"}'
        );
        assert.strictEqual(host.read("apps/www/missing.json"), undefined);
        assert.throws(() => host.git(["cat-file", "-e", "0".repeat(40)]));
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("fails outside a repository, so the step builds", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const folder = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "vercel-host-test-",
      });

      assert.throws(() => makeNodeHost(folder));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
