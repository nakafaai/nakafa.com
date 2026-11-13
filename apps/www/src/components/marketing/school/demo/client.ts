import { ExamView } from "@repo/backend/confect/exams/exam";
import {
  ConvexReactClient,
  type MutationOptions,
  type Watch,
  type WatchQueryOptions,
} from "convex/react";
import {
  type ArgsAndOptions,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReference_future,
  type FunctionReturnType,
  getFunctionName,
  type OptionalRestArgs,
} from "convex/server";
import { Data, MutableHashMap, MutableHashSet, Option, Schema } from "effect";
import type { DemoBackend } from "@/components/marketing/school/demo/backend";

/**
 * The address the demo client names. Its connection is never opened: every read and change the editor makes, and
 * every read of the connection, is answered here, so the address only satisfies the client's constructor.
 */
const DEMO_ADDRESS = "https://demo.nakafa.invalid";

/**
 * The demo's connection, as the School's screens read it: open, with nothing in flight, since the demo's server
 * answers every call in the page. The client answers it from memory, because reading the base client's connection
 * opens its socket.
 */
const DEMO_CONNECTION: ReturnType<ConvexReactClient["connectionState"]> = {
  connectionCount: 1,
  connectionRetries: 0,
  hasEverConnected: true,
  hasInflightRequests: false,
  inflightActions: 0,
  inflightMutations: 0,
  isWebSocketConnected: true,
  timeOfOldestInflightRequest: null,
};

/** A read's key: its function's name and its arguments as JSON text. */
const ArgsText = Schema.fromJsonString(Schema.Unknown);

/** The exam as the wire carries it, which an optimistic update writes back. */
const EncodedExam = Schema.toEncoded(ExamView);

/**
 * A value the demo answers. Convex types the answer of a function it does not know as `any`, so the demo's
 * answers, which the editor's Confect hooks decode with each function's own schema, take that type.
 */
type Answer = FunctionReturnType<FunctionReference<"query">>;

/** A function of any kind, as the client's methods take it. */
type AnyReference =
  | FunctionReference<"action" | "mutation" | "query">
  | FunctionReference_future<"action" | "mutation" | "query">;

/** A change the demo does not hold, such as scheduling the exam, which the editor reports as it reports a failed save. */
export class DemoUnavailable extends Data.TaggedError("DemoUnavailable")<{
  readonly call: string;
}> {}

/**
 * The Convex client of the School landing's editor. It is the real client's class, so every hook of the editor reads
 * and writes through it as it does in a school, but each read is answered by the demo backend and each change runs the
 * editor's own optimistic update on the demo's exam before the backend answers it. A change of the exam reaches
 * every watch at once, as a server's transition would.
 */
export class DemoConvexClient extends ConvexReactClient {
  readonly #backend: DemoBackend;
  readonly #listeners = MutableHashSet.empty<() => void>();
  readonly #answers = MutableHashMap.empty<string, Option.Option<Answer>>();
  readonly #connection = DEMO_CONNECTION;

  constructor(backend: DemoBackend) {
    super(DEMO_ADDRESS, { logger: false });
    this.#backend = backend;
  }

  /** The demo's answer to a read, the same value until something changes, so React reads a stable result. */
  #read(reference: AnyReference, args: unknown) {
    const name = getFunctionName(reference);
    const key = `${name}:${Schema.encodeSync(ArgsText)(args ?? {})}`;
    return MutableHashMap.get(this.#answers, key).pipe(
      Option.getOrElse(() => {
        const answer = Option.map(
          this.#backend.query(name, args ?? {}),
          (value): Answer => value
        );
        MutableHashMap.set(this.#answers, key, answer);
        return answer;
      })
    );
  }

  /**
   * Runs a change on the demo's backend and tells every watch to read again. A
   * call the demo does not hold, such as any action, fails as one the demo
   * cannot answer.
   */
  #call(reference: AnyReference, args: unknown): Promise<Answer> {
    const name = getFunctionName(reference);
    return Option.match(this.#backend.mutate(name, args), {
      onNone: () => Promise.reject(new DemoUnavailable({ call: name })),
      onSome: (value) => {
        this.#changed();
        return Promise.resolve(value);
      },
    });
  }

  /** Drops every kept answer and tells every watch to read again. */
  #changed() {
    MutableHashMap.clear(this.#answers);
    for (const listener of this.#listeners) {
      listener();
    }
  }

  override watchQuery<
    Query extends
      | FunctionReference<"query">
      | FunctionReference_future<"query">,
  >(
    query: Query,
    ...argsAndOptions: ArgsAndOptions<Query, WatchQueryOptions>
  ): Watch<FunctionReturnType<Query>> {
    const [args] = argsAndOptions;
    return {
      journal: () => undefined,
      localQueryResult: () => Option.getOrUndefined(this.#read(query, args)),
      onUpdate: (callback) => {
        MutableHashSet.add(this.#listeners, callback);
        return () => {
          MutableHashSet.remove(this.#listeners, callback);
        };
      },
    };
  }

  override query<
    Query extends
      | FunctionReference<"query">
      | FunctionReference_future<"query">,
  >(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ): Promise<FunctionReturnType<Query>> {
    const [read] = args;
    return Option.match(this.#read(query, read), {
      onNone: () =>
        Promise.reject(new DemoUnavailable({ call: getFunctionName(query) })),
      onSome: (answer) => Promise.resolve(answer),
    });
  }

  override mutation<
    Mutation extends
      | FunctionReference<"mutation">
      | FunctionReference_future<"mutation">,
  >(
    mutation: Mutation,
    ...argsAndOptions: ArgsAndOptions<
      Mutation,
      MutationOptions<FunctionArgs<Mutation>>
    >
  ): Promise<FunctionReturnType<Mutation>> {
    const [args, options] = argsAndOptions;
    const sent = args ?? {};
    const backend = this.#backend;
    const read = (reference: AnyReference, value: unknown) =>
      Option.getOrUndefined(this.#read(reference, value));
    options?.optimisticUpdate?.(
      {
        getAllQueries: (query) =>
          getFunctionName(query) === backend.examQuery
            ? [{ args: backend.examArgs, value: backend.exam() }]
            : [],
        getQuery: (query, ...queryArgs) => read(query, queryArgs[0]),
        setQuery: (query, _args, value) => {
          if (getFunctionName(query) !== backend.examQuery) {
            return;
          }
          Option.map(
            Schema.decodeUnknownOption(EncodedExam)(value),
            backend.replaceExam
          );
        },
      },
      sent
    );
    this.#changed();
    return this.#call(mutation, sent);
  }

  override action<
    Action extends
      | FunctionReference<"action">
      | FunctionReference_future<"action">,
  >(
    action: Action,
    ...args: OptionalRestArgs<Action>
  ): Promise<FunctionReturnType<Action>> {
    const [sent] = args;
    return this.#call(action, sent ?? {});
  }

  /** The demo's connection, open and idle, read without the socket that the base client would open for it. */
  override connectionState() {
    return this.#connection;
  }

  /** Tells `callback` the demo's connection once. It never changes, so there is nothing to unsubscribe from. */
  override subscribeToConnectionState(
    callback: (state: ReturnType<ConvexReactClient["connectionState"]>) => void
  ) {
    callback(this.#connection);
    return () => undefined;
  }
}
