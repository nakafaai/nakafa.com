import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import {
  invoiceMode,
  payAcceptanceInvoice,
  seedAcceptanceXendit,
  xenditMode,
} from "@repo/backend/scripts/content/acceptance/xendit";
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

/** The function each Convex CLI call runs, and the event type it records when it records one. */
const Called = Schema.fromJsonString(
  Schema.Struct({ type: Schema.optional(Schema.String) })
);

/** The session a school invoice's hosted payment records, as the Convex CLI receives it. */
const SessionArgs = Schema.fromJsonString(
  Schema.Struct({
    accountId: Schema.String,
    expiresAt: Schema.Finite,
    invoiceId: Schema.String,
    sessionId: Schema.String,
    url: Schema.String,
  })
);

/**
 * Records every command the seed runs, answering the prepare step with an
 * account and the event inbox with an event, as the local backend does.
 */
const recordCommands = Effect.fn("acceptance.xendit.test.record")(function* (
  root: string
) {
  const fs = yield* FileSystem.FileSystem;
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      yield* fs.writeFileString(
        spec.stdoutPath,
        '{"accountId":"account_1","eventId":"event_1"}'
      );
    })
  );
  return specs;
});

/** The function path and the event type of each recorded Convex CLI call. */
const callsOf = (specs: MutableList.MutableList<CommandSpec>) =>
  Effect.forEach(MutableList.toArray(specs), (spec) =>
    Schema.decodeEffect(Called)(
      Option.getOrElse(Arr.last(spec.args), () => "{}")
    ).pipe(Effect.map(({ type }) => [spec.args[2], type ?? null] as const))
  );

describe("acceptance xendit", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "opens the checkout through its own steps and applies the webhook of a paid pass or of a plan's first month",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-xendit-test-",
        });
        const pass = yield* recordCommands(root);
        yield* seedAcceptanceXendit(root, "user_1", "pass", 1000);
        expect(yield* callsOf(pass)).toEqual([
          ["billing/xendit/checkout:prepare", null],
          ["billing/xendit/checkout:admit", null],
          ["billing/events:record", "payment_session.completed"],
          ["billing/events:apply", null],
        ]);
        const plan = yield* recordCommands(root);
        yield* xenditMode.run(root, ["user_1", "plan"]);
        expect(yield* callsOf(plan)).toEqual([
          ["billing/xendit/checkout:prepare", null],
          ["billing/xendit/checkout:admit", null],
          ["billing/events:record", "payment_session.completed"],
          ["billing/events:apply", null],
        ]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "seeds nothing without a local runtime, or for a purchase it does not know",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-xendit-test-",
        });
        mocks.read.mockReturnValue(Effect.void);
        const exit = yield* Effect.exit(
          seedAcceptanceXendit(root, "user_1", "pass", 1000)
        );
        expect(Exit.isFailure(exit)).toBe(true);
        expect(
          yield* xenditMode.run(root, ["user_1", "gift"]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: "Usage: acceptance xendit <user-id> <pass|plan>",
        });
        expect(mocks.command).not.toHaveBeenCalled();
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "opens a school invoice's hosted payment as the session Xendit answers with, then applies the webhook of its payment",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-xendit-test-",
        });
        mocks.read.mockReturnValue(
          Effect.succeed({ backend: `${root}/backend` })
        );
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(
              spec.stdoutPath,
              spec.args[2] === "billingInvoices"
                ? '[{"_id":"invoice_2","accountId":"account_1","dueAt":2000,"number":"NKF-2026-000002"},{"_id":"invoice_1","accountId":"account_1","dueAt":2000,"number":"NKF-2026-000001"}]'
                : '{"eventId":"event_1"}'
            );
          })
        );

        yield* payAcceptanceInvoice(root, "NKF-2026-000001", "open", 1000);
        yield* invoiceMode.run(root, ["NKF-2026-000001", "paid"]);

        const [read, record, event, apply] = MutableList.toArray(specs);
        expect(read?.args.slice(1, 3)).toEqual(["data", "billingInvoices"]);
        expect(record?.args[2]).toBe("billing/xendit/invoice:record");
        expect(
          yield* Schema.decodeEffect(SessionArgs)(
            Option.getOrThrow(Arr.last(record?.args ?? []))
          )
        ).toEqual({
          accountId: "account_1",
          expiresAt: 2000,
          invoiceId: "invoice_1",
          sessionId: "ps_acceptance_NKF-2026-000001",
          url: "https://checkout-staging.xendit.co/sessions/ps_acceptance_NKF-2026-000001",
        });
        expect(event?.args[2]).toBe("billing/events:record");
        expect(Option.getOrThrow(Arr.last(event?.args ?? []))).toContain(
          "ps_acceptance_NKF-2026-000001"
        );
        expect(apply?.args[2]).toBe("billing/events:apply");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "pays nothing without a local runtime, for an invoice the runtime does not hold, or for a step it does not know",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-xendit-test-",
        });
        mocks.read.mockReturnValue(Effect.void);
        expect(
          Exit.isFailure(
            yield* Effect.exit(
              payAcceptanceInvoice(root, "NKF-2026-000001", "paid", 1000)
            )
          )
        ).toBe(true);
        expect(
          yield* invoiceMode
            .run(root, ["NKF-2026-000001", "refund"])
            .pipe(Effect.flip)
        ).toMatchObject({
          message: "Usage: acceptance invoice <invoice-number> <open|paid>",
        });
        expect(mocks.command).not.toHaveBeenCalled();

        mocks.read.mockReturnValue(
          Effect.succeed({ backend: `${root}/backend` })
        );
        mocks.command.mockImplementation((spec: CommandSpec) =>
          fs.writeFileString(spec.stdoutPath, "")
        );
        expect(
          yield* payAcceptanceInvoice(
            root,
            "NKF-2026-000009",
            "open",
            1000
          ).pipe(Effect.flip)
        ).toMatchObject({
          message: "The local runtime holds no invoice NKF-2026-000009.",
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
