import type { EndReason } from "@repo/backend/confect/assessment/gate/end";
import {
  AttemptClosed,
  AttemptRefused,
  Expired,
  Locked,
  Missing,
  OtherDevice,
  SectionClosed,
  Stale,
} from "@repo/backend/confect/assessment/gate/refusal";
import {
  type Rule,
  rules,
  type Version,
} from "@repo/backend/confect/assessment/gate/rules";
import type {
  Answerable,
  Candidate,
  DeviceId,
  Store,
} from "@repo/backend/confect/assessment/gate/store";
import { evaluate } from "@repo/backend/confect/response/evaluation";
import type { Selection } from "@repo/backend/confect/response/model";
import { Clock, Effect, Number as Num, Option } from "effect";

/** Refuses one write with the first admission rule it failed. */
function refuse(reason: AttemptRefused["reason"]) {
  return Effect.fail(new AttemptRefused({ reason }));
}

/** Whether a write's version is not newer than the stored answer's, which a newer write already replaced. */
function isStale(incoming: Version, stored: Option.Option<Version>) {
  return Option.exists(stored, (current) => incoming <= current);
}

/**
 * Builds the gate over the store of one kind of attempt. Every learner write to
 * a running attempt is a policy over `admit`: it loads its target through the
 * store, passes the rules in one order, and only then writes through the store.
 */
export function make<
  Placement,
  Section,
  Answering extends Answerable,
  Live,
  E,
  EA,
  EF,
  R,
>(store: Store<Placement, Section, Answering, Live, E, EA, EF, R>) {
  /**
   * The engine: loads the target, then checks every rule in order and returns
   * the checked live context with the server time it was checked at. The
   * order is owner, attempt open, lock, device, the attempt deadline for an
   * `attempt` rule, then the section stage (open, the store's checks), and
   * the live deadline for a `live` rule. The first failing rule is the
   * refusal, and nothing is written after one.
   */
  const admit = Effect.fn("assessment.gate.admit")(function* <L>(
    rule: Rule,
    owner: string,
    device: Option.Option<DeviceId>,
    load: Effect.Effect<Option.Option<Candidate<L, E, R>>, E, R>
  ) {
    const now = yield* Clock.currentTimeMillis;
    const target = Option.filter(
      yield* load,
      (candidate) => candidate.owner === owner
    );
    if (Option.isNone(target)) {
      return yield* refuse(new Missing());
    }
    const { attempt, section } = target.value;
    if (!attempt.open) {
      return yield* refuse(new AttemptClosed());
    }
    if (rule.lock === "refuse" && attempt.locked) {
      return yield* refuse(new Locked());
    }
    if (
      Option.exists(attempt.device, (bound) => !Option.contains(device, bound))
    ) {
      return yield* refuse(new OtherDevice());
    }
    if (rule.deadline === "attempt" && now >= attempt.deadline) {
      return yield* refuse(new Expired({ deadline: attempt.deadline }));
    }
    const open = yield* section;
    if (Option.isNone(open)) {
      return yield* refuse(new SectionClosed());
    }
    yield* open.value.verify;
    const deadline = Num.min(attempt.deadline, open.value.deadline);
    if (rule.deadline === "live" && now >= deadline) {
      return yield* refuse(new Expired({ deadline }));
    }
    return {
      deadline: { attempt: attempt.deadline, section: open.value.deadline },
      live: open.value.live,
      now,
    };
  });

  /**
   * Saves one answer: admitted by `rules.answer`, refused as stale unless its
   * version is newer than the stored one, the selection evaluated against the
   * frozen response (none clears the answer), and written with its version.
   */
  const answer = Effect.fn("assessment.gate.answer")(function* (input: {
    readonly owner: string;
    readonly device: Option.Option<DeviceId>;
    readonly placement: Placement;
    readonly selection: Option.Option<Selection>;
    readonly version: Version;
  }) {
    const { live, now } = yield* admit(
      rules.answer,
      input.owner,
      input.device,
      store.placement(input.placement)
    );
    if (isStale(input.version, live.version)) {
      return yield* new Stale();
    }
    const evaluated = yield* Effect.transposeOption(
      Option.map(input.selection, (selection) =>
        Effect.fromResult(evaluate(live.response, selection))
      )
    );
    yield* store.answer(live, evaluated, now, input.version);
  });

  /**
   * Finishes one section: admitted by `rules.finish`, and ended as
   * `time-expired` once its own deadline passed, otherwise as `submitted`.
   */
  const finish = Effect.fn("assessment.gate.finish")(function* (input: {
    readonly owner: string;
    readonly device: Option.Option<DeviceId>;
    readonly section: Section;
  }) {
    const { deadline, live, now } = yield* admit(
      rules.finish,
      input.owner,
      input.device,
      store.section(input.section)
    );
    const reason: EndReason =
      now >= deadline.section ? "time-expired" : "submitted";
    yield* store.finish(live, reason, now);
  });

  return { admit, answer, finish };
}
