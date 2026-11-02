import { QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFlag } from "@/components/player/flag";
import {
  PlayerFooter,
  PlayerNote,
  PlayerOpener,
} from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerKeys } from "@/components/player/keys";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerQuestions } from "@/components/player/questions";
import {
  TryExamIdContext,
  TrySlugContext,
  TryStoreContext,
} from "@/components/tenant/exams/try/context";
import { ExamTryEmpty } from "@/components/tenant/exams/try/empty";
import {
  ExamTryQuestion,
  TryReveal,
} from "@/components/tenant/exams/try/question";
import { projectTryQuestions } from "@/components/tenant/exams/try/questions";
import { createExamTry } from "@/components/tenant/exams/try/store";
import {
  ExamGone,
  ExamUnavailable,
} from "@/components/tenant/exams/unavailable";
import { useLastValue } from "@/lib/data/kept";
import { schoolExamEditTarget } from "@/lib/routing/school/target";

/**
 * One exam as its students will meet it, for its teacher to try: the sitting's own player, full screen
 * with the player's header, the navigator and its legend, the flag and the keys, and the same questions
 * in the same order with the same controls. The answers and the flags stay in this page's store and are
 * never sent, so a try leaves no attempt and no score behind, as the footer says once for the whole paper.
 * The header holds the way back, the view and its one action, the player's own finish, so a teacher meets the
 * review a student meets. Nothing was saved, so finishing only returns to the editor. Its links are plain
 * ones, because a school host has no locale in its paths.
 */
export function ExamTryPaper({
  examId,
  slug,
}: {
  examId: Id<"exams">;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const navigate = useNavigate();
  // The exam needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const result = useQuery(
    exams.exams.open,
    isSettled ? { examId, slug } : "skip"
  );
  const [store] = useState(createExamTry);
  // The navigator, the flag and the keys mark the try's own answers and flags.
  const answers = useStore(store);
  // An exam that goes while it is tried keeps its paper and its title, and says so in the note, which opens by itself.
  const kept = useLastValue(result);

  if (Option.isNone(kept)) {
    return QueryResult.isFailure(result) ? <ExamUnavailable /> : null;
  }
  const exam = kept.value;
  if (Arr.isReadonlyArrayEmpty(exam.questions)) {
    return (
      <PlayerProvider keys={[]} mode="list">
        <PaperBar
          back={<PaperBack examId={examId} />}
          title={exam.title || t("untitled")}
        />
        <ExamTryEmpty examId={examId} />
      </PlayerProvider>
    );
  }
  const gone = QueryResult.isFailure(result);

  const models = projectTryQuestions({
    questions: exam.questions,
    try: answers,
  });

  return (
    <TrySlugContext value={slug}>
      <TryExamIdContext value={examId}>
        <TryStoreContext value={store}>
          <PlayerProvider
            keys={Arr.map(exam.questions, (question) => question.id)}
            mode="list"
          >
            <PlayerKeys locked={false} questions={models} />
            <PaperBar
              back={<PaperBack examId={examId} />}
              title={exam.title || t("untitled")}
            >
              {gone ? null : (
                <PlayerFinish
                  description={t("try-note")}
                  label={t("try-finish")}
                  locked={false}
                  onFinish={() => {
                    navigate(schoolExamEditTarget(slug, examId));
                  }}
                  pending={false}
                  questions={models}
                  title={t("try-finish")}
                />
              )}
            </PaperBar>
            <PlayerMain
              navigator={
                <PlayerSidebar>
                  <PlayerGrid questions={models} />
                  <PlayerLegend />
                </PlayerSidebar>
              }
            >
              <TryReveal questions={exam.questions}>
                <PlayerQuestions>
                  {Arr.map(exam.questions, (question, index) => (
                    <ExamTryQuestion
                      key={question.id}
                      number={index + 1}
                      question={question}
                    />
                  ))}
                </PlayerQuestions>
              </TryReveal>
            </PlayerMain>
            <PlayerFooter>
              <PlayerFlag beforeNote locked={false} questions={models} />
              <PlayerOpener />
              <PlayerNote defaultOpen={gone} key={String(gone)}>
                {gone ? <ExamGone /> : t("try-note")}
              </PlayerNote>
            </PlayerFooter>
            <PlayerSheet>
              <PlayerGrid questions={models} />
              <PlayerLegend />
            </PlayerSheet>
          </PlayerProvider>
        </TryStoreContext>
      </TryExamIdContext>
    </TrySlugContext>
  );
}
