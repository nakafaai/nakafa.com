/**
 * The URL contract of a production deploy (`.github/workflows/deploy.yml`).
 * `record` runs before the deploy and writes the ledger of every address Nakafa
 * has published to `NAKAFA_URL_LEDGER`; `check` runs after it and fails unless
 * each of them still reaches a page or answers 410 Gone.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Config, Effect, Schema } from "effect";
import { checkLedger, recordLedger } from "@/scripts/urls/run";

const CommandSchema = Schema.Literals(["check", "record"]);

const main = Effect.gen(function* () {
  const command = yield* Schema.decodeUnknownEffect(CommandSchema)(
    process.argv[2]
  );
  const ledger = yield* Config.NonEmptyString("NAKAFA_URL_LEDGER");
  const input = { ledger, origin: SITE_ORIGIN };
  return yield* command === "record" ? recordLedger(input) : checkLedger(input);
});

NodeRuntime.runMain(main.pipe(Effect.provide(NodeServices.layer)));
