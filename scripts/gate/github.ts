import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Option,
  Record as Rec,
  Result,
  Schema,
  String as Str,
} from "effect";
import { runText } from "#scripts/process";
import { REPOSITORY } from "#scripts/proof/client";

/** A gate that could not run, or whose verdict could not be read. */
export class GateError extends Schema.TaggedError<
  GateError,
  { readonly brand: unique symbol }
>()("GateError", { message: Schema.String }) {}

/** The summary status the gate workflow posts on a head; each part posts `gate/<part>`. */
export const GATE_CONTEXT = "gate";

/**
 * How long a waiting gate sleeps between two looks. A look is one GraphQL
 * point, so even dozens of waiters stay far inside the hourly limit that every
 * session of the account shares, and they spend nothing of the REST limit.
 */
export const POLL = Duration.seconds(90);

/** The points a waiter leaves to every other session: below this many, it sleeps until the limit resets. */
const RESERVE = 200;

/** The commit statuses of one head, as GraphQL reports the newest of each context. */
const QUERY =
  "query($owner:String!,$name:String!,$oid:GitObjectID!){repository(owner:$owner,name:$name){object(oid:$oid){... on Commit{status{contexts{context state description targetUrl createdAt}}}}}}";

const StatusContext = Schema.Struct({
  context: Schema.String,
  state: Schema.String,
  description: Schema.NullOr(Schema.String),
  targetUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});
type StatusContext = typeof StatusContext.Type;

const StatusJson = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.Struct({
      repository: Schema.Struct({
        object: Schema.NullOr(
          Schema.Struct({
            status: Schema.NullOr(
              Schema.Struct({ contexts: Schema.Array(StatusContext) })
            ),
          })
        ),
      }),
    }),
  })
);

const Count = Schema.NumberFromString.check(Schema.isInt());

/** One line break of an HTTP response, which GitHub ends with a carriage return. */
const LINE = /\r?\n/u;

/** The blank line between an HTTP response's headers and its body. */
const BLANK_LINE = /\r?\n\r?\n/u;

/** The headers of `gh api --include` output, by lower-case name. */
function headersOf(head: string) {
  return Rec.fromEntries(
    Arr.filterMap(Str.split(head, LINE), (line) => {
      const colon = line.indexOf(":");
      return colon <= 0
        ? Result.failVoid
        : Result.succeed([
            Str.toLowerCase(Str.trim(line.slice(0, colon))),
            Str.trim(line.slice(colon + 1)),
          ] as const);
    })
  );
}

/**
 * How long to wait before the next look, by GitHub's own clock: the poll
 * interval, or until the limit resets once fewer points than the reserve remain.
 */
export function waitAfter(
  headers: Readonly<Record<string, string>>,
  now: Option.Option<DateTime.Utc>
) {
  const count = (name: string) =>
    Option.flatMap(Rec.get(headers, name), Schema.decodeUnknownOption(Count));
  return Option.match(
    Option.all({
      now,
      remaining: count("x-ratelimit-remaining"),
      reset: count("x-ratelimit-reset"),
    }),
    {
      onNone: () => POLL,
      onSome: ({ now: at, remaining, reset }) =>
        remaining >= RESERVE
          ? POLL
          : Duration.max(
              POLL,
              Duration.seconds(reset + 5 - DateTime.toEpochMillis(at) / 1000)
            ),
    }
  );
}

/**
 * One look at a head's statuses: when GitHub answered, how long to wait before
 * the next look, and the statuses, or none when the answer could not be read.
 * A head GitHub does not know has no commit.
 */
const lookAt = Effect.fn("gate.lookAt")(function* (sha: string) {
  const output = yield* runText("gh", [
    "api",
    "graphql",
    "--include",
    "-f",
    `query=${QUERY}`,
    "-f",
    `owner=${REPOSITORY.slice(0, REPOSITORY.indexOf("/"))}`,
    "-f",
    `name=${REPOSITORY.slice(REPOSITORY.indexOf("/") + 1)}`,
    "-f",
    `oid=${sha}`,
  ]).pipe(
    Effect.mapError(
      () => new GateError({ message: "The GitHub CLI could not start." })
    )
  );
  const blank = output.stdout.search(BLANK_LINE);
  const head = blank < 0 ? output.stdout : output.stdout.slice(0, blank);
  const headers = headersOf(head);
  const at = Option.flatMap(Rec.get(headers, "date"), DateTime.make);
  return {
    at,
    wait: waitAfter(headers, at),
    commit: Option.map(
      Schema.decodeOption(StatusJson)(
        blank < 0 ? "" : output.stdout.slice(blank)
      ),
      (answer) =>
        Option.map(Option.fromNullishOr(answer.data.repository.object), (one) =>
          Option.match(Option.fromNullishOr(one.status), {
            onNone: (): readonly StatusContext[] => [],
            onSome: (status) => status.contexts,
          })
        )
    ),
    problem: Str.trim(output.stderr),
  };
});

/**
 * The moment, by GitHub's clock, from which a status on this head belongs to a
 * gate dispatched now. It fails for a head GitHub does not know, and waits out
 * the rate limit when GitHub refuses the look for it.
 */
export const startingMoment = Effect.fn("gate.startingMoment")(function* (
  sha: string
) {
  while (true) {
    const look = yield* lookAt(sha);
    if (Option.isSome(look.commit) && Option.isSome(look.at)) {
      if (Option.isNone(look.commit.value)) {
        return yield* new GateError({
          message: `GitHub has no commit ${sha}: push it first.`,
        });
      }
      return look.at.value;
    }
    if (!Duration.isGreaterThan(look.wait, POLL)) {
      return yield* new GateError({
        message: `GitHub could not read ${sha}: ${look.problem}`,
      });
    }
    yield* Effect.log(
      `GitHub's rate limit is spent; looking again in ${Duration.format(look.wait)}.`
    );
    yield* Effect.sleep(look.wait);
  }
});

/** The verdict of one gate: whether every part passed, its run, and each part's status. */
const Verdict = Schema.Struct({
  passed: Schema.Boolean,
  url: Schema.String,
  parts: Schema.Array(StatusContext),
});
export type Verdict = typeof Verdict.Type;

/** The verdict a finished gate posted on a head at or after `since`, if it has finished. */
export function verdictOf(
  contexts: readonly StatusContext[],
  since: DateTime.Utc
): Option.Option<Verdict> {
  const summary = Arr.findFirst(
    contexts,
    (status) =>
      status.context === GATE_CONTEXT &&
      status.state !== "PENDING" &&
      Option.exists(DateTime.make(status.createdAt), (created) =>
        DateTime.isGreaterThanOrEqualTo(created, since)
      )
  );
  return Option.map(summary, (status) => ({
    passed: status.state === "SUCCESS",
    url: status.targetUrl ?? "",
    parts: Arr.filter(contexts, (part) =>
      part.context.startsWith(`${GATE_CONTEXT}/`)
    ),
  }));
}

/**
 * Looks at a head until the gate dispatched at `since` posts its verdict,
 * sleeping between looks as `waitAfter` says. A look GitHub could not answer
 * is logged and tried again: the run keeps going whatever this waiter reads.
 */
export const awaitVerdict = Effect.fn("gate.awaitVerdict")(function* (
  sha: string,
  since: DateTime.Utc
) {
  while (true) {
    const look = yield* lookAt(sha);
    const verdict = Option.flatMap(Option.flatten(look.commit), (contexts) =>
      verdictOf(contexts, since)
    );
    if (Option.isSome(verdict)) {
      return verdict.value;
    }
    if (Option.isNone(look.commit)) {
      yield* Effect.logWarning(
        `GitHub could not answer this look: ${look.problem}`
      );
    }
    yield* Effect.sleep(look.wait);
  }
});
