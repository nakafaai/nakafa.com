import { CONTENT_RUNTIME_TABLES } from "@repo/backend/scripts/content-runtime/tables";
import { Effect } from "effect";

const writeTables = Effect.sync(() => {
  process.stdout.write(`${CONTENT_RUNTIME_TABLES.join("\n")}\n`);
});

Effect.runPromise(writeTables);
