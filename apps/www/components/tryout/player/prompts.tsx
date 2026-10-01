"use client";

import { type ReactNode, use } from "react";
import { PlayerPrompts } from "@/components/player/context";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * Joins signed question bodies to the runtime by the content identity frozen
 * at attempt start. Missing or stale content refreshes the route once.
 */
export function TryoutPrompts({
  children,
  content,
  runtime,
}: {
  readonly children: ReactNode;
  readonly content: Promise<TryoutRuntimeContent> | null;
  readonly runtime: TryoutSectionRuntime;
}) {
  if (!content) {
    return <TryoutContentRefresh />;
  }
  const bodies = new Map(
    use(content).questions.map((question) => [
      contentIdentity(question),
      question.content,
    ])
  );
  const prompts = new Map<string, ReactNode>();
  for (const question of runtime.questions) {
    const identity = contentIdentity(question);
    if (!bodies.has(identity)) {
      return <TryoutContentRefresh />;
    }
    prompts.set(question.placementId, bodies.get(identity));
  }
  return <PlayerPrompts prompts={prompts}>{children}</PlayerPrompts>;
}

/** The immutable identity a question body was captured with. */
function contentIdentity(question: {
  readonly contentHash: string;
  readonly sourcePath: string;
  readonly sourceRevision: string;
}) {
  return `${question.sourcePath}:${question.contentHash}:${question.sourceRevision}`;
}
