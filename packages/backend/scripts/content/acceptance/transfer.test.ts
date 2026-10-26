import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import {
  recordAcceptanceTransfer,
  transferMode,
} from "@repo/backend/scripts/content/acceptance/transfer";
import {
  Array as Arr,
  Effect,
  Exit,
  FileSystem,
  MutableList,
  Option,
  Schema,
} from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn(), read: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));
vi.mock(
  "@repo/backend/scripts/content/acceptance/local",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/local")
    >()),
    readLocalRuntime: mocks.read,
  })
);

type CommandSpec = Parameters<typeof runAcceptanceCommand>[0];

/** The arguments of the operator command, as the Convex CLI receives them. */
const TransferArgs = Schema.fromJsonString(
  Schema.Struct({
    number: Schema.String,
    paidAt: Schema.Finite,
    reference: Schema.String,
  })
);

/** Records every command the transfer runs, answering each with nothing printed. */
const recordCommands = Effect.fn("acceptance.transfer.test.record")(function* (
  root: string
) {
  const fs = yield* FileSystem.FileSystem;
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      yield* fs.writeFileString(spec.stdoutPath, "null");
    })
  );
  return specs;
});

describe("acceptance transfer", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "records the transfer through the operator command, for the invoice and reference the mode names",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-transfer-test-",
        });
        const specs = yield* recordCommands(root);

        yield* recordAcceptanceTransfer(
          root,
          "NKF-2026-000001",
          "BCA-0001",
          1000
        );
        yield* transferMode.run(root, ["NKF-2026-000002", "BCA-0002", "x"]);

        const [first, second] = MutableList.toArray(specs);
        expect(Arr.take(Arr.drop(first?.args ?? [], 1), 2)).toEqual([
          "run",
          "billing/contracts:recordInvoiceTransfer",
        ]);
        expect(
          yield* Schema.decodeEffect(TransferArgs)(
            Option.getOrThrow(Arr.last(first?.args ?? []))
          )
        ).toEqual({
          number: "NKF-2026-000001",
          paidAt: 1000,
          reference: "BCA-0001",
        });
        expect(
          yield* Schema.decodeEffect(TransferArgs)(
            Option.getOrThrow(Arr.last(second?.args ?? []))
          )
        ).toMatchObject({ number: "NKF-2026-000002", reference: "BCA-0002" });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "records nothing without a local runtime, or without the bank reference",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-transfer-test-",
        });
        mocks.read.mockReturnValue(Effect.void);
        const exit = yield* Effect.exit(
          recordAcceptanceTransfer(root, "NKF-2026-000001", "BCA-0001", 1000)
        );
        expect(Exit.isFailure(exit)).toBe(true);
        expect(
          yield* transferMode.run(root, ["NKF-2026-000001"]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message:
            "Usage: acceptance transfer <invoice-number> <bank-reference>",
        });
        expect(mocks.command).not.toHaveBeenCalled();
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
