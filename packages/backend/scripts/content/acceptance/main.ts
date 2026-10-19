import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import {
  prepareAcceptance,
  runAcceptance,
} from "@repo/backend/scripts/content/acceptance/build";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { importAcceptanceRows } from "@repo/backend/scripts/content/acceptance/import";
import { createAcceptanceInvite } from "@repo/backend/scripts/content/acceptance/invite";
import { createAcceptanceLearner } from "@repo/backend/scripts/content/acceptance/learner";
import { cleanLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { createAcceptanceOwner } from "@repo/backend/scripts/content/acceptance/owner";
import { withTerminal } from "@repo/backend/scripts/content/acceptance/process";
import { updateAcceptanceProfile } from "@repo/backend/scripts/content/acceptance/profile";
import { createAcceptanceSchool } from "@repo/backend/scripts/content/acceptance/school";
import { createAcceptanceSitting } from "@repo/backend/scripts/content/acceptance/sitting";
import {
  createAcceptanceClassTeacher,
  createAcceptanceTeacher,
} from "@repo/backend/scripts/content/acceptance/teacher";
import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, FileSystem, Layer } from "effect";

/** The commands that manage the local acceptance runtime, which take no school. */
const RUNTIME_MODES = ["prepare", "build", "start", "clean"] as const;
type RuntimeMode = (typeof RUNTIME_MODES)[number];

const isRuntimeMode = (mode: string | undefined): mode is RuntimeMode =>
  Arr.some(RUNTIME_MODES, (candidate) => candidate === mode);

/** Runs one command that manages the local acceptance runtime. */
const runtimeCommand = Effect.fn("contentAcceptance.runtimeCommand")(function* (
  root: string,
  mode: RuntimeMode
) {
  if (mode === "prepare") {
    return yield* prepareAcceptance(root);
  }
  if (mode === "clean") {
    return yield* cleanLocalRuntime(root);
  }
  return yield* runAcceptance(root, mode, Arr.drop(process.argv, 3));
});

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.realPath(`${import.meta.dirname}/../../../../..`);
  const mode = process.argv[2];
  if (isRuntimeMode(mode)) {
    return yield* runtimeCommand(root, mode);
  }
  const first = process.argv[3];
  const second = process.argv[4];
  const third = process.argv[5];
  if (mode === "learner" && first !== undefined) {
    return yield* createAcceptanceLearner(root, first);
  }
  if (mode === "school" && first !== undefined) {
    return yield* createAcceptanceSchool(root, first);
  }
  if (mode === "owner" && first !== undefined && second !== undefined) {
    return yield* createAcceptanceOwner(root, first, second);
  }
  if (
    mode === "invite" &&
    first !== undefined &&
    second !== undefined &&
    third !== undefined
  ) {
    return yield* createAcceptanceInvite(root, first, second, third);
  }
  if (mode === "teacher" && first !== undefined && second !== undefined) {
    return yield* createAcceptanceTeacher(root, first, second);
  }
  if (mode === "class-teacher" && first !== undefined && second !== undefined) {
    return yield* createAcceptanceClassTeacher(root, first, second);
  }
  if (
    mode === "sitting" &&
    first !== undefined &&
    second !== undefined &&
    third !== undefined
  ) {
    return yield* createAcceptanceSitting(root, first, second, third);
  }
  if (mode === "import" && first !== undefined && second !== undefined) {
    return yield* importAcceptanceRows(root, first, second);
  }
  if (mode === "profile" && first !== undefined && second !== undefined) {
    return yield* updateAcceptanceProfile(root, first, second);
  }
  return yield* acceptanceRuntimeError(
    "Usage: acceptance <prepare|build|start|clean|learner <cookie-file>|school <school-file>|owner <school-slug> <cookie-file>|teacher <school-slug> <cookie-file>|class-teacher <school-slug> <cookie-file>|invite <school-slug> <learner-address> <cookie-file>|sitting <school-slug> <learner-email> <sitting-file>|import <table> <rows-file>|profile <auth-user-id> <profile-json-file>>"
  );
});

runMain(
  withTerminal(main).pipe(Effect.provide(Layer.merge(layer, FetchClient)))
);
