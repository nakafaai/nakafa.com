import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import {
  buildMode,
  prepareMode,
  startMode,
} from "@repo/backend/scripts/content/acceptance/build";
import { classTeacherMode } from "@repo/backend/scripts/content/acceptance/classes";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { importMode } from "@repo/backend/scripts/content/acceptance/import";
import { inviteMode } from "@repo/backend/scripts/content/acceptance/invite";
import { learnerMode } from "@repo/backend/scripts/content/acceptance/learner";
import { cleanMode } from "@repo/backend/scripts/content/acceptance/local";
import type { AcceptanceMode } from "@repo/backend/scripts/content/acceptance/mode";
import { ownerMode } from "@repo/backend/scripts/content/acceptance/owner";
import { withTerminal } from "@repo/backend/scripts/content/acceptance/process";
import { profileMode } from "@repo/backend/scripts/content/acceptance/profile";
import { schoolMode } from "@repo/backend/scripts/content/acceptance/school";
import { sittingMode } from "@repo/backend/scripts/content/acceptance/sitting";
import { teacherMode } from "@repo/backend/scripts/content/acceptance/teacher";
import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Effect,
  FileSystem,
  HashMap,
  Layer,
  Option,
} from "effect";

/**
 * Every mode of the command line, in the order that its usage names them. A
 * command joins the command line by adding its mode here.
 */
export const acceptanceModes: readonly AcceptanceMode[] = [
  prepareMode,
  buildMode,
  startMode,
  cleanMode,
  learnerMode,
  schoolMode,
  ownerMode,
  teacherMode,
  classTeacherMode,
  inviteMode,
  sittingMode,
  importMode,
  profileMode,
];

/** The usage line that names every mode with its arguments. */
const usage = (modes: readonly AcceptanceMode[]) =>
  `Usage: acceptance <${Arr.join(
    Arr.map(modes, (mode) => mode.usage),
    "|"
  )}>`;

/**
 * Runs the mode that the first argument names, with the arguments after it. A
 * missing or unknown mode refuses with the usage of every mode, and runs none.
 */
export const runAcceptanceCli = Effect.fn("contentAcceptance.cli")(function* (
  root: string,
  argv: readonly string[],
  modes: readonly AcceptanceMode[]
) {
  const byName = HashMap.fromIterable(
    Arr.map(modes, (mode): readonly [string, AcceptanceMode] => [
      mode.mode,
      mode,
    ])
  );
  const selected = Option.flatMap(Option.fromUndefinedOr(argv[2]), (name) =>
    HashMap.get(byName, name)
  );
  if (Option.isNone(selected)) {
    return yield* acceptanceRuntimeError(usage(modes));
  }
  return yield* selected.value.run(root, Arr.drop(argv, 3)).pipe(Effect.scoped);
});

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.realPath(`${import.meta.dirname}/../../../../..`);
  return yield* runAcceptanceCli(root, process.argv, acceptanceModes);
});

runMain(
  withTerminal(main).pipe(Effect.provide(Layer.merge(layer, FetchClient)))
);
