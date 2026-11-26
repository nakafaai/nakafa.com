import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { use } from "react";
import { ShellLock } from "@/components/sidebar/lock";
import { TryoutContentContext } from "@/components/tryout/content/context";
import { TryoutPartOpening } from "@/components/tryout/player/opening";
import { TryoutPaperProvider } from "@/components/tryout/player/paper";
import {
  getTryoutAttemptLock,
  getTryoutPublicPath,
} from "@/components/tryout/route/path";
import { useTryoutStartPhase } from "@/components/tryout/runtime/start";
import { shouldLockTryoutShell } from "@/components/tryout/runtime/state";
import { useTryoutPlayerPath } from "@/components/tryout/section/header";
import { useTryoutSectionPage } from "@/components/tryout/section/page";

/**
 * Holds the player until the page's read has brought the section's bodies. The live state
 * can say a section runs a commit before the read does, which lands before the browser
 * paints, so the player waits in its frame instead of reading a section with no questions.
 */
export function TryoutSectionBodies({ children }: { children: ReactNode }) {
  const bodies = use(TryoutContentContext)?.bodies ?? null;
  return bodies === null ? <TryoutSectionOpening /> : children;
}

/** The player's frame, while a section the learner's press opens gets ready. */
export function TryoutSectionOpening() {
  const { page } = useTryoutSectionPage();
  return <TryoutPartOpening part={page.section} />;
}

/**
 * The paper the section's player shows: the way to the section, its set's sections, and whether a running attempt,
 * or a press that opens one, holds the learner in it. While the attempt runs its set stays bound to it, and the group
 * and the track link only while the page sits at the section's current catalog path.
 */
export function TryoutSectionPaper({ children }: { children: ReactNode }) {
  const { binding, page, parts, route, setPath } = useTryoutSectionPage();
  const opening = useTryoutStartPhase() === "opening";
  const running = binding?.initialState.attempt.status === "in-progress";
  const activeSectionKey = running
    ? binding.initialState.attempt.activeSectionKey
    : null;
  const locked = shouldLockTryoutShell({ activeSectionKey, opening });
  const visibleParts =
    binding && !running
      ? Arr.filter(parts, (part) =>
          Arr.contains(
            binding.initialState.attempt.completedSectionKeys,
            part.key
          )
        )
      : parts;
  const path = useTryoutPlayerPath({
    page,
    parents:
      !binding || binding.startPath === getTryoutPublicPath(route)
        ? "linked"
        : "unlinked",
    setPath: running ? page.set.publicPath : setPath,
  });
  return (
    <TryoutPaperProvider
      attemptId={binding?.attemptId}
      current={page.section.sectionKey}
      locked={locked}
      parts={visibleParts}
      path={path}
      title={page.section.title}
    >
      {children}
    </TryoutPaperProvider>
  );
}

/**
 * Locks the app shell only while a timed section clock is actively running or while the learner's press opens
 * a section here, so the page takes the whole screen during timed work and stays unlocked in the lobby.
 */
export function TryoutSectionLock() {
  const { binding, page, route } = useTryoutSectionPage();
  const opening = useTryoutStartPhase() === "opening";
  const attempt = binding?.initialState.attempt;
  const activeSectionKey =
    attempt?.status === "in-progress" ? attempt.activeSectionKey : null;
  if (!shouldLockTryoutShell({ activeSectionKey, opening })) {
    return null;
  }
  if (
    binding &&
    attempt?.status === "in-progress" &&
    activeSectionKey !== null
  ) {
    return (
      <ShellLock
        remember={getTryoutAttemptLock({
          attemptId: binding.attemptId,
          locale: route.locale,
          setPath: page.set.publicPath,
          until: attempt.activeSectionExpiresAt ?? attempt.expiresAt,
        })}
      />
    );
  }
  return <ShellLock />;
}
