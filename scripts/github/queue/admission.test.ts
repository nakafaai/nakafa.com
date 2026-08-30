import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import {
  decodeQueueIdentity,
  validateQueueHead,
  validateQueuePull,
} from "#scripts/github/queue/admission";

const BASE_SHA = "1".repeat(40);
const GROUP_SHA = "2".repeat(40);
const PULL_SHA = "3".repeat(40);

const ownerPull = {
  base: {
    ref: "main",
    repo: { full_name: "nakafaai/nakafa.com" },
    sha: BASE_SHA,
  },
  head: {
    ref: "codex/example",
    repo: { full_name: "nakafaai/nakafa.com" },
    sha: PULL_SHA,
  },
  number: 42,
  state: "open",
  user: { login: "nabilfatih" },
};

const queueEvent = {
  action: "checks_requested",
  merge_group: {
    base_ref: "refs/heads/main",
    base_sha: BASE_SHA,
    head_ref: `gh-readonly-queue/main/pr-42-${BASE_SHA}`,
    head_sha: GROUP_SHA,
  },
  repository: { full_name: "nakafaai/nakafa.com" },
  sender: { login: "nabilfatih" },
};

describe("merge queue admission", () => {
  it.effect("decodes one exact queued pull request", () =>
    Effect.gen(function* () {
      const identity = yield* decodeQueueIdentity({
        actor: "nabilfatih",
        event: queueEvent,
        ref: `refs/heads/${queueEvent.merge_group.head_ref}`,
        sha: GROUP_SHA,
      });

      expect(identity).toEqual({
        actor: "nabilfatih",
        baseBranch: "main",
        baseSha: BASE_SHA,
        groupRef: `refs/heads/${queueEvent.merge_group.head_ref}`,
        groupSha: GROUP_SHA,
        pullNumber: 42,
        repository: "nakafaai/nakafa.com",
        sender: "nabilfatih",
      });
    })
  );

  it.effect("rejects a queue ref whose base identity changed", () =>
    decodeQueueIdentity({
      actor: "nabilfatih",
      event: queueEvent,
      ref: `refs/heads/gh-readonly-queue/main/pr-42-${"4".repeat(40)}`,
      sha: GROUP_SHA,
    }).pipe(
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );

  it.effect("rejects a pull request outside the owner-controlled lane", () =>
    Effect.gen(function* () {
      const identity = yield* decodeQueueIdentity({
        actor: "nabilfatih",
        event: queueEvent,
        ref: `refs/heads/${queueEvent.merge_group.head_ref}`,
        sha: GROUP_SHA,
      });
      const result = yield* validateQueuePull(identity, {
        ...ownerPull,
        head: { ...ownerPull.head, ref: "contributor/change" },
        user: { login: "contributor" },
      }).pipe(Effect.result);

      expect(Result.isFailure(result)).toBe(true);
    })
  );

  it.effect("admits the exact repository-generated Changesets lane", () =>
    Effect.gen(function* () {
      const identity = yield* decodeQueueIdentity({
        actor: "nabilfatih",
        event: queueEvent,
        ref: `refs/heads/${queueEvent.merge_group.head_ref}`,
        sha: GROUP_SHA,
      });

      expect(yield* validateQueuePull(identity, ownerPull)).toBe("owner");
      expect(
        yield* validateQueuePull(identity, {
          ...ownerPull,
          head: { ...ownerPull.head, ref: "changeset-release/main" },
          user: { login: "github-actions[bot]" },
        })
      ).toBe("release");
    })
  );

  it.effect("rejects the Actions bot outside the Changesets branch", () =>
    Effect.gen(function* () {
      const identity = yield* decodeQueueIdentity({
        actor: "nabilfatih",
        event: queueEvent,
        ref: `refs/heads/${queueEvent.merge_group.head_ref}`,
        sha: GROUP_SHA,
      });
      const result = yield* validateQueuePull(identity, {
        ...ownerPull,
        user: { login: "github-actions[bot]" },
      }).pipe(Effect.result);

      expect(Result.isFailure(result)).toBe(true);
    })
  );

  it.effect("revalidates the generated release head at the final gate", () =>
    Effect.gen(function* () {
      const releasePull = {
        ...ownerPull,
        head: { ...ownerPull.head, ref: "changeset-release/main" },
        user: { login: "github-actions[bot]" },
      };

      expect(
        yield* validateQueueHead("nakafaai/nakafa.com", PULL_SHA, releasePull)
      ).toBe("release");
      const result = yield* validateQueueHead(
        "nakafaai/nakafa.com",
        "4".repeat(40),
        releasePull
      ).pipe(Effect.result);
      expect(Result.isFailure(result)).toBe(true);
    })
  );
});
