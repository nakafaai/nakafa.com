import { standingOf } from "@repo/backend/confect/assessment/gate/device";
import {
  AttemptClosed,
  AttemptRefused,
  DeviceRetired,
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
  AttemptState,
  Binding,
  Candidate,
  DeviceId,
  Store,
} from "@repo/backend/confect/assessment/gate/store";
import { Clock, Effect, Number as Num, Option } from "effect";

/** Refuses one write with the first admission rule it failed. */
function refuse(reason: AttemptRefused["reason"]) {
  return Effect.fail(new AttemptRefused({ reason }));
}

/** Whether an attempt in this state accepts writes before its deadline. */
const isOpen = (state: AttemptState) =>
  state === "inProgress" || state === "locked";

/** Whether a write's version is not newer than the question's latest admitted write, which a newer write already took the place of. */
function isStale(incoming: Version, latest: Option.Option<Version>) {
  return Option.exists(latest, (current) => incoming <= current);
}

/**
 * Refuses a device that may not write to the attempt. A free attempt admits any
 * device; a bound or unbound one admits only its own bound device, and a retired
 * device is refused as retired before any other check.
 */
const admitDevice = Effect.fn("assessment.gate.device")(function* (
  binding: Binding,
  device: Option.Option<DeviceId>
) {
  if (binding.kind === "free") {
    return;
  }
  if (Option.isNone(device)) {
    return yield* refuse(new OtherDevice());
  }
  const standing = standingOf(binding, device.value);
  if (standing === "retired") {
    return yield* refuse(new DeviceRetired());
  }
  if (standing !== "bound") {
    return yield* refuse(new OtherDevice());
  }
});

/**
 * Builds the gate over the store of one kind of attempt. Every learner write to an
 * attempt is a policy over `admit`: it loads its target through the store, passes
 * the rules in one order, and only then writes through the store. There is one guard
 * sequence, and every write of every kind of attempt runs through it.
 */
export function make<
  Placement,
  Section,
  Answering extends Answerable,
  Live,
  Value,
  E,
  R,
>(store: Store<Placement, Section, Answering, Live, Value, E, R>) {
  /**
   * The engine: loads the target, then checks every rule in order and returns the
   * checked live context with the server time it was checked at. The order is owner,
   * attempt open, lock, device, the attempt deadline for an `attempt` rule, then the
   * section stage (open, the store's checks of the rows that identify it), the live
   * deadline for a `live` rule, and last the rest of the rows the write needs, which
   * the store loads and checks only now. The first failing rule is the refusal, and
   * nothing is written after one. The live deadline is the earlier of the attempt's
   * and the section's, so a section that added minutes never cuts a student off.
   */
  const admit = Effect.fn("assessment.gate.admit")(function* <L, LE, LR>(
    rule: Rule,
    owner: string,
    device: Option.Option<DeviceId>,
    load: Effect.Effect<Option.Option<Candidate<L, LE, LR>>, LE, LR>
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
    if (!isOpen(attempt.state)) {
      return yield* refuse(new AttemptClosed());
    }
    // A locked attempt past its deadline takes no more writes as a closed one does (ADR 0013),
    // so the lock refuses only before the deadline and the deadline rules refuse the rest.
    if (
      rule.lock === "refuse" &&
      attempt.state === "locked" &&
      now < attempt.deadline
    ) {
      return yield* refuse(new Locked());
    }
    yield* admitDevice(attempt.binding, device);
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
      live: yield* open.value.live,
      now,
    };
  });

  /** Whether the target is the owner's and already submitted, so a finish changes nothing. */
  const submitted = Effect.fn("assessment.gate.submitted")(function* <
    L,
    LE,
    LR,
  >(
    owner: string,
    load: Effect.Effect<Option.Option<Candidate<L, LE, LR>>, LE, LR>
  ) {
    const target = Option.filter(
      yield* load,
      (candidate) => candidate.owner === owner
    );
    return Option.exists(
      target,
      ({ attempt }) => attempt.state === "submitted"
    );
  });

  /**
   * Saves one answer: admitted by `rules.answer`, refused as stale unless its version
   * is newer than the question's latest admitted write, and then written with the
   * value that `value` makes of the admitted live context.
   */
  const answer = Effect.fn("assessment.gate.answer")(function* <VE, VR>(input: {
    readonly owner: string;
    readonly device: Option.Option<DeviceId>;
    readonly placement: Placement;
    readonly value: (live: Answering) => Effect.Effect<Value, VE, VR>;
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
    const value = yield* input.value(live);
    yield* store.answer(live, value, now, input.version);
  });

  /**
   * Finishes one section. A section that is already submitted either changes nothing and
   * succeeds, when the caller settles a repeated finish (`answer`, as submit is idempotent in
   * ADR 0031), or is refused as closed (`refuse`). Otherwise it is admitted by `rules.finish`
   * and ended as `time-expired` once its own deadline passed, and otherwise as `submitted`.
   */
  const finish = Effect.fn("assessment.gate.finish")(function* (input: {
    readonly owner: string;
    readonly device: Option.Option<DeviceId>;
    readonly section: Section;
    readonly settled: "answer" | "refuse";
  }) {
    if (
      input.settled === "answer" &&
      (yield* submitted(input.owner, store.section(input.section)))
    ) {
      return;
    }
    const { deadline, live, now } = yield* admit(
      rules.finish,
      input.owner,
      input.device,
      store.section(input.section)
    );
    const reason = now >= deadline.section ? "time-expired" : "submitted";
    yield* store.finish(live, reason, now);
  });

  return { admit, answer, finish };
}
