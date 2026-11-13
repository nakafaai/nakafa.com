import { type ReactNode, use } from "react";
import { PlayerTimer, PlayerTimerCard } from "@/components/player/timer";
import { ShellLock } from "@/components/sidebar/lock";
import { TryoutContentContext } from "@/components/tryout/content/context";
import { TryoutPlayerOpening } from "@/components/tryout/player/opening";
import { TryoutPaperProvider } from "@/components/tryout/player/paper";
import {
  getTryoutAttemptLock,
  getTryoutPublicPath,
} from "@/components/tryout/route/path";
import { useTryoutStartPhase } from "@/components/tryout/runtime/start";
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
  return (
    <TryoutPlayerOpening
      card={<PlayerTimerCard seconds={page.section.timeLimitSeconds} />}
      questionCount={page.section.questionCount}
    >
      <PlayerTimer seconds={page.section.timeLimitSeconds} />
    </TryoutPlayerOpening>
  );
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
      locked={running || opening}
      parts={parts}
      path={path}
      title={page.section.title}
    >
      {children}
    </TryoutPaperProvider>
  );
}

/**
 * Locks the app shell while the attempt this page is bound to runs, or while the learner's press opens
 * a section here, so the page takes the whole screen from the press on.
 */
export function TryoutSectionLock() {
  const { binding } = useTryoutSectionPage();
  const opening = useTryoutStartPhase() === "opening";
  if (binding?.initialState.attempt.status === "in-progress") {
    return (
      <ShellLock
        remember={getTryoutAttemptLock(
          binding.attemptId,
          binding.initialState.attempt.expiresAt
        )}
      />
    );
  }
  return opening ? <ShellLock /> : null;
}
