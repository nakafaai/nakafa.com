import { QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { SittingBar } from "@/components/exams/sitting/bar";
import { PlayerFlag } from "@/components/player/flag";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerKeys } from "@/components/player/keys";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerQuestions } from "@/components/player/questions";
import {
  TrySlugContext,
  TryStoreContext,
} from "@/components/tenant/exams/try/context";
import { ExamTryQuestion } from "@/components/tenant/exams/try/question";
import { projectTryQuestions } from "@/components/tenant/exams/try/questions";
import { createExamTry } from "@/components/tenant/exams/try/store";
import {
  ExamGone,
  ExamUnavailable,
} from "@/components/tenant/exams/unavailable";
import { useLastValue } from "@/lib/data/kept";
import { TargetLink } from "@/lib/routing/link";
import { schoolExamEditTarget } from "@/lib/routing/school/target";

/**
 * One exam as its students will meet it, for its teacher to try: the sitting's own player, with the
 * school's header, the navigator and its legend, the flag and the keys, and the same questions in the
 * same order with the same controls. The answers and the flags stay in this page's store and are
 * never sent, so a try leaves no attempt and no score behind. The header's one action returns to the
 * editor. Its links are plain ones, because a school host has no locale in its paths.
 */
export function ExamTryPaper({
  examId,
  slug,
}: {
  examId: Id<"exams">;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  // The exam needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const result = useQuery(
    exams.exams.open,
    isSettled ? { examId, slug } : "skip"
  );
  const [store] = useState(createExamTry);
  // The navigator, the flag and the keys mark the try's own answers and flags.
  const answers = useStore(store);
  // An exam that goes while it is tried keeps its paper and its title, and says so in place of the note.
  const kept = useLastValue(result);

  if (Option.isNone(kept)) {
    return QueryResult.isFailure(result) ? <ExamUnavailable /> : null;
  }
  const exam = kept.value;
  const gone = QueryResult.isFailure(result);
  const editor = schoolExamEditTarget(slug, examId);

  const models = projectTryQuestions({
    questions: exam.questions,
    try: answers,
  });

  return (
    <TrySlugContext value={slug}>
      <TryStoreContext value={store}>
        <PlayerProvider
          keys={Arr.map(exam.questions, (question) => question.id)}
          mode="list"
        >
          <PlayerKeys locked={false} questions={models} />
          <SittingBar examTitle={exam.title || t("untitled")}>
            {gone ? null : (
              <TargetLink className={buttonVariants()} target={editor}>
                {t("try-finish")}
              </TargetLink>
            )}
          </SittingBar>
          <PlayerMain
            navigator={
              <PlayerSidebar>
                <PlayerGrid questions={models} />
                <PlayerLegend />
              </PlayerSidebar>
            }
          >
            <p className="text-muted-foreground text-sm">
              {gone ? <ExamGone /> : t("try-note")}
            </p>
            <PlayerQuestions>
              {Arr.map(exam.questions, (question, index) => (
                <ExamTryQuestion
                  key={question.id}
                  number={index + 1}
                  question={question}
                />
              ))}
            </PlayerQuestions>
          </PlayerMain>
          <PlayerFooter>
            <PlayerFlag locked={false} questions={models} />
            <PlayerOpener />
          </PlayerFooter>
          <PlayerSheet>
            <PlayerGrid questions={models} />
            <PlayerLegend />
          </PlayerSheet>
        </PlayerProvider>
      </TryStoreContext>
    </TrySlugContext>
  );
}
