/**
 * Keeps the deploy's read store to the entries this deploy's build used, and
 * tells the next step whether to save it (`keepShelfEntries` owns the rule). A
 * deploy runs it after `alchemy deploy`, whether or not the deploy succeeded.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem, Path } from "effect";
import { keepShelfEntries } from "@/lib/content/store/shelf";

const keep = Effect.gen(function* () {
  const directory = yield* Config.NonEmptyString(
    "NAKAFA_BUILD_STORE_DIRECTORY"
  );
  const status = yield* Config.NonEmptyString("JOB_STATUS");
  const output = yield* Config.NonEmptyString("GITHUB_OUTPUT");
  const fs = yield* FileSystem.FileSystem;
  const mark = (yield* Path.Path).join(directory, ".restored");
  if (!(yield* fs.exists(mark))) {
    return yield* Effect.log("The deploy restored no read store.");
  }
  const kept = yield* keepShelfEntries({
    directory,
    finished: status === "success",
    mark,
  });
  if (!kept.changed) {
    return yield* Effect.log(
      "The deploy built nothing, so the read store keeps every entry it restored."
    );
  }
  yield* Effect.log(
    `The read store keeps the ${kept.used} entries this build used and drops ${kept.dropped}.`
  );
  yield* fs.writeFileString(output, "changed=true\n", { flag: "a" });
});

NodeRuntime.runMain(keep.pipe(Effect.provide(NodeServices.layer)));
