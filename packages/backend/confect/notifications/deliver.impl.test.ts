import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { scheduledJobs, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";
import { Base64Url } from "effect/encoding";

/** The fetch the push action's client calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const { send } = refs.public.classroom.forum.messages;
const push = refs.public.notifications.push;
const inbox = refs.public.notifications.inbox;
const deliver = refs.internal.notifications.deliver;

/** A browser's real push keys, so the payload encrypts. */
const browserKeys = Effect.promise(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  return {
    auth: Base64Url.encode(crypto.getRandomValues(new Uint8Array(16))),
    endpoint: "https://push.example.test/student",
    p256dh: Base64Url.encode(
      new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))
    ),
  };
});

/** The operator's VAPID keys, set in the environment as a deployment sets them. */
const setVapid = Effect.promise(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  vi.stubEnv("WEB_PUSH_PRIVATE_KEY", jwk.d ?? "");
  vi.stubEnv(
    "WEB_PUSH_PUBLIC_KEY",
    Base64Url.encode(
      new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))
    )
  );
  vi.stubEnv("WEB_PUSH_SUBJECT", "mailto:halo@nakafa.com");
});

/** A class whose student subscribed a browser, and a teacher's message that mentions the student. */
const mentioned = Effect.gen(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  yield* fixture.as("student").mutation(push.subscribe, yield* browserKeys);
  yield* fixture.as("teacher").mutation(send, {
    ...forum,
    clientKey: "pushed-mention",
    mentions: [{ _tag: "person", id: fixture.people.student.personId }],
    slug: nf,
    text: "@Student",
  });
  const rows = yield* fixture.as("student").query(inbox.list, firstPage);
  const row = Arr.getUnsafe(rows.page, 0);
  return { fixture, notificationId: row.id };
});

describe("notifications/deliver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    fetcher.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "sends nothing while the deployment has no VAPID keys, and pushes once to each browser when it has",
    () =>
      Effect.gen(function* () {
        const { fixture, notificationId } = yield* mentioned;
        yield* fixture.finishScheduled();
        expect(fetcher).not.toHaveBeenCalled();
        yield* setVapid;
        fetcher.mockResolvedValue(new Response(null, { status: 201 }));
        yield* fixture.internal.action(deliver.send, { notificationId });
        expect(fetcher).toHaveBeenCalledTimes(1);
        const notice = yield* fixture.internal.query(deliver.notice, {
          notificationId,
        });
        expect(notice?.payload).toContain("Seseorang menyebutmu di kelas.");
        expect(notice?.targets).toHaveLength(1);
      })
  );

  it.effect(
    "forgets a browser whose push service says it is gone, logs any other refusal, and skips a read row",
    () =>
      Effect.gen(function* () {
        const { fixture, notificationId } = yield* mentioned;
        yield* setVapid;
        fetcher.mockResolvedValueOnce(new Response(null, { status: 500 }));
        yield* fixture.internal.action(deliver.send, { notificationId });
        fetcher.mockResolvedValueOnce(new Response(null, { status: 410 }));
        yield* fixture.internal.action(deliver.send, { notificationId });
        expect(
          yield* fixture.internal.query(deliver.notice, { notificationId })
        ).toBeNull();
        yield* fixture.internal.mutation(deliver.forget, {
          endpoint: "https://push.example.test/gone",
        });
        yield* fixture.as("student").mutation(push.subscribe, yield* browserKeys);
        yield* fixture.as("student").mutation(inbox.read, { notificationId });
        expect(
          yield* fixture.internal.query(deliver.notice, { notificationId })
        ).toBeNull();
        yield* fixture.internal.action(deliver.send, { notificationId });
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "holds a student's push until quiet hours end in the class's zone",
    () =>
      Effect.gen(function* () {
        // 22:00 in Jakarta, inside quiet hours, which end at 06:00 there, 23:00 UTC.
        vi.setSystemTime(Date.UTC(2026, 9, 1, 15, 0, 0));
        const { fixture } = yield* mentioned;
        const jobs = yield* fixture.run(scheduledJobs);
        const held = Arr.filter(jobs, (job) => job.name.includes("deliver"));
        expect(Arr.map(held, (job) => job.scheduledTime)).toEqual([
          Date.UTC(2026, 9, 1, 23, 0, 0),
        ]);
      })
  );
});
