import { describe, expect, it } from "@effect/vitest";
import {
  ConfigProvider,
  Effect,
  FileSystem,
  Layer,
  MutableHashMap,
  Option,
  Path,
  PlatformError,
} from "effect";
import { readSession, removeSession, storeSession } from "#cli/credentials";

/** An in-memory file system that keeps written files and the mode each file was given. */
const memoryFiles = () => {
  const files = MutableHashMap.empty<string, string>();
  const modes = MutableHashMap.empty<string, number>();
  const layer = FileSystem.layerNoop({
    chmod: (path, mode) =>
      Effect.sync(() => {
        MutableHashMap.set(modes, path, mode);
      }),
    makeDirectory: () => Effect.void,
    readFileString: (path) =>
      Option.match(MutableHashMap.get(files, path), {
        onNone: () =>
          Effect.fail(
            PlatformError.systemError({
              _tag: "NotFound",
              method: "readFileString",
              module: "FileSystem",
              pathOrDescriptor: path,
            })
          ),
        onSome: Effect.succeed,
      }),
    remove: (path) =>
      Effect.sync(() => {
        MutableHashMap.remove(files, path);
      }),
    writeFileString: (path, data) =>
      Effect.sync(() => {
        MutableHashMap.set(files, path, data);
      }),
  });
  return { files, layer, modes };
};

/** The environment of one run: the home directory, and a configuration directory when given. */
const environment = (values: Record<string, string>) =>
  ConfigProvider.layer(ConfigProvider.fromUnknown(values));

const session = { expiresAt: 2000, host: "harapan.nakafa.com", token: "token" };

describe("CLI school credentials", () => {
  it.effect(
    "stores the sign-in under ~/.config for its owner only, reads it back, and removes it",
    () => {
      const memory = memoryFiles();
      return Effect.gen(function* () {
        const file = yield* storeSession(session);
        expect(file).toBe("/home/sari/.config/nakafa/school.json");
        expect(MutableHashMap.get(memory.modes, file)).toEqual(
          Option.some(0o600)
        );
        expect(yield* readSession(1000)).toEqual(session);
        expect(yield* Effect.flip(readSession(2000))).toMatchObject({
          code: "SIGN_IN_EXPIRED",
        });
        yield* removeSession();
        expect(yield* Effect.flip(readSession(1000))).toMatchObject({
          code: "NOT_SIGNED_IN",
        });
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            memory.layer,
            Path.layer,
            environment({ HOME: "/home/sari" })
          )
        )
      );
    }
  );

  it.effect(
    "keeps the sign-in in XDG_CONFIG_HOME when it is set, and refuses an unreadable one",
    () => {
      const memory = memoryFiles();
      return Effect.gen(function* () {
        const file = yield* storeSession(session);
        expect(file).toBe("/xdg/nakafa/school.json");
        MutableHashMap.set(memory.files, file, "not json");
        expect(yield* Effect.flip(readSession(1000))).toMatchObject({
          code: "NOT_SIGNED_IN",
          message: "The stored sign-in is unreadable. Sign in again.",
        });
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            memory.layer,
            Path.layer,
            environment({ HOME: "/home/sari", XDG_CONFIG_HOME: "/xdg" })
          )
        )
      );
    }
  );

  it.effect("refuses a sign-in it cannot write or remove", () =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(storeSession(session))).toMatchObject({
        code: "CREDENTIALS_UNWRITABLE",
      });
      expect(yield* Effect.flip(removeSession())).toMatchObject({
        code: "CREDENTIALS_UNWRITABLE",
      });
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          FileSystem.layerNoop({}),
          Path.layer,
          environment({ HOME: "/home/sari" })
        )
      )
    )
  );
});
