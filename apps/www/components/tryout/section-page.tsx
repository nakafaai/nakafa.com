import { TryoutQuestionMarkdown } from "@/components/tryout/question-markdown";
import { TryoutPageHeader } from "@/components/tryout/shared/page-header";

interface TryoutSectionQuestion {
  choices: readonly {
    label: string;
    optionKey: string;
    order: number;
  }[];
  number: number;
  questionBody: string;
  sourceKey: string;
  title: string;
}

interface TryoutSectionPageProps {
  backHref: string;
  backLabel: string;
  description?: string;
  questionCountLabel: string;
  questions: readonly TryoutSectionQuestion[];
  title: string;
}

/** Renders the public section question list from the Convex try-out catalog. */
export function TryoutSectionPage({
  backHref,
  backLabel,
  description,
  questionCountLabel,
  questions,
  title,
}: TryoutSectionPageProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-16">
      <div className="space-y-8">
        <TryoutPageHeader
          description={description}
          link={{ href: backHref, label: backLabel }}
          status={questionCountLabel}
          title={title}
        />

        <div className="space-y-5">
          {questions.map((question) => (
            <article
              className="rounded-lg border bg-card p-5"
              key={question.sourceKey}
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-sm">
                  {question.number}
                </span>
                <h2 className="font-medium">{question.title}</h2>
              </div>

              <TryoutQuestionMarkdown
                body={question.questionBody}
                id={`tryout-question-${question.sourceKey}`}
              />

              {question.choices.length > 0 ? (
                <ol className="mt-5 space-y-2">
                  {question.choices.map((choice) => (
                    <li
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                      key={choice.optionKey}
                    >
                      {choice.label}
                    </li>
                  ))}
                </ol>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
