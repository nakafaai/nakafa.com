import { QueryResult } from "@confect/react";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { demoExam } from "@/components/marketing/school/demo/exam";
import {
  DEMO_EXAM,
  DemoSchool,
  useDemoExam,
} from "@/components/marketing/school/demo/school";
import { ExamDesk } from "@/components/tenant/exams/editor";
import { ExamProvider } from "@/components/tenant/exams/provider";

/**
 * The real School exam editor, on the School landing, over a demo school that lives in the page: the editor's own
 * header, toolbar, canvas, teacher's panel and footer, with a momentum question, a numeric one and an essay, in the
 * reader's language. A visitor writes, sets the key, the points and the scoring, adds and moves questions, zooms and
 * opens the grid as a teacher does, and nothing leaves the browser.
 */
export function EditorDemo() {
  const t = useTranslations("SchoolSite");
  const [seed] = useState(() =>
    demoExam({
      answer: t("demo-exam-answer"),
      essay: t.raw("demo-exam-essay"),
      explanation: t.raw("demo-exam-explanation"),
      numeric: t.raw("demo-exam-numeric"),
      question: t.raw("demo-exam-question"),
      rubric: t.raw("demo-exam-rubric"),
      title: t("demo-exam-title"),
    })
  );

  return (
    <DemoSchool seed={seed}>
      <DemoWorkspace />
    </DemoSchool>
  );
}

/**
 * The editor's desk once the demo's server answers the exam, which it does in the first render, in a frame one
 * screen tall, so the canvas scrolls inside it as it does in a school.
 */
function DemoWorkspace() {
  const result = useDemoExam();

  return (
    <div
      className="bg-background ring-foreground/10 flex h-[min(46rem,85svh)] flex-col overflow-hidden rounded-xl shadow-xs ring-1"
      data-slot="editor-demo"
    >
      {QueryResult.isSuccess(result) ? (
        <ExamProvider exam={result.value} gone={false} slug={DEMO_EXAM.slug}>
          <ExamDesk />
        </ExamProvider>
      ) : null}
    </div>
  );
}
