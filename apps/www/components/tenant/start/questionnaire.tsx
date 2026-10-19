"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import { School01Icon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  SchoolSize,
  StartAnswer,
  StartCountry,
  StartRole,
} from "@repo/backend/confect/tenancy/start";
import {
  Questionnaire,
  QuestionnaireProgress,
} from "@repo/design-system/components/ui/questionnaire";
import { toast } from "@repo/design-system/lib/toast/notify";
import { cn } from "cn";
import { Array as Arr, Effect, Match, Option, Result, Schema } from "effect";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  use,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { QuestionnaireSteps } from "@/components/shared/questionnaire";
import {
  StartCountryQuestion,
  StartLevelsQuestion,
  StartRoleQuestion,
  StartSizeQuestion,
} from "@/components/tenant/start/choices";
import { StartContext } from "@/components/tenant/start/context";
import { useSaveStartAnswer } from "@/components/tenant/start/draft.client";
import { StartNameQuestion } from "@/components/tenant/start/name";
import { StartOpening } from "@/components/tenant/start/opening";
import {
  levelsOf,
  resumeItem,
  START_ITEMS,
  type StartDraft,
  type StartItem,
  startRequest,
  unitName,
} from "@/components/tenant/start/state";
import { createTypedName } from "@/components/tenant/start/typed";
import { reportClientException } from "@/lib/analytics/client";

/** The policy pages the last question links to, from the page's published navigation. */
type Legal = Record<"privacy" | "terms", string> | null;

/** Whether an item name the questionnaire reports is one of its questions. */
const isStartItem = (name: string): name is StartItem =>
  Arr.contains<string>(START_ITEMS, name);

/** Decodes the typed name and address as the answer of the first question, when they make one. */
const decodeAnswer = Schema.decodeUnknownOption(StartAnswer);

/** Nina as the page draws her. The form shows her beside its questions, not on the opening card. */
const StartNinaContext = createContext<ReactNode>(null);

/**
 * The questionnaire that opens a school for the signed-in account (K42): five
 * questions in the entry frame, each answer saved as it is chosen, resumed at
 * the first question left open. It waits for the session and the saved draft, so
 * it never shows an answer that the draft would change. Its children are Nina as
 * the page draws her; she appears with the questions, so the page does not move
 * when they arrive.
 */
export function SchoolStart({
  children,
  legal,
}: {
  children: ReactNode;
  legal: Legal;
}) {
  // The server saw the session, but the client's Convex session settles a moment
  // later; the draft is read once it has, so the first read is never anonymous.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const draft = useQuery(tenancy.start.draft, isSettled ? {} : "skip");
  if (QueryResult.isFailure(draft)) {
    throw draft.error;
  }
  if (!QueryResult.isSuccess(draft)) {
    return null;
  }
  return (
    <StartNinaContext value={children}>
      <SchoolStartForm draft={draft.value} legal={legal} />
    </StartNinaContext>
  );
}

/** The school that the founder opened, as the screen shows it while it opens. */
type Opening = Record<"name" | "slug", string>;

/** The control that takes focus when a refused opening returns to the form. */
const NAME_INPUT = '[data-slot="questionnaire-item"]:not([hidden]) input';
const FINISH_BUTTON = 'button[type="submit"]';

/** No control to focus: the form has not returned from a refused opening. */
const NO_REFOCUS: Option.Option<string> = Option.none();

/**
 * The form of the questionnaire. Finishing shows the school at once and opens
 * its own address once the server answers; a refused address returns to the
 * first question, where the live check names the reason.
 */
function SchoolStartForm({
  draft,
  legal,
}: {
  draft: StartDraft;
  legal: Legal;
}) {
  const t = useTranslations("SchoolStart");
  const nina = use(StartNinaContext);
  const save = useSaveStartAnswer();
  const open = useMutation(tenancy.start.open);
  const [typed] = useState(() => createTypedName(draft));
  const [item, setItem] = useState<StartItem>(() => resumeItem(draft));
  const [opened, setOpened] = useState<Option.Option<Opening>>(Option.none);
  const [shown, showOpening] = useOptimistic(opened);
  const [isOpening, startOpening] = useTransition();
  const refocus = useRef(NO_REFOCUS);

  /**
   * The form mounts again when a refused opening returns to it, so the focus
   * that was on Finish would fall to the page. This puts it back once: on the
   * name when the address was refused, on Finish otherwise.
   */
  function focusReturned(form: HTMLFormElement | null) {
    if (form === null || Option.isNone(refocus.current)) {
      return;
    }
    form.querySelector<HTMLElement>(refocus.current.value)?.focus();
    refocus.current = Option.none();
  }

  /** Saves the typed name and address when they make a valid answer. */
  function saveName() {
    const { name, slug } = typed.getState();
    Option.map(decodeAnswer({ kind: "name", name: name.trim(), slug }), save);
  }

  function handleItemChange(next: string) {
    if (!isStartItem(next)) {
      return;
    }
    if (item === "name") {
      saveName();
    }
    setItem(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = startRequest(
      draft,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      (level, school) =>
        unitName(
          draft?.country ?? "ID",
          draft?.country === "ID"
            ? t(`level.${level}.title`)
            : t(`stage.${level}`),
          school,
          (label, name) => t("unit-name", { level: label, name })
        )
    );
    if (Option.isNone(request)) {
      toast.error({ title: "onboarding-invalid-selection.title" });
      return;
    }
    const school = { name: request.value.name, slug: request.value.slug };
    startOpening(async () => {
      showOpening(Option.some(school));
      const outcome = await Effect.runPromise(
        Effect.tryPromise(() => open(request.value)).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.result
        )
      );
      Result.match(outcome, {
        onFailure: (error) => {
          refocus.current = Option.some(FINISH_BUTTON);
          Match.value(error).pipe(
            Match.tag("FoundingRefused", (refused) =>
              Match.value(refused.code).pipe(
                Match.when("SCHOOL_LIMIT", () =>
                  toast.error({
                    description: "school-limit.description",
                    title: "school-limit.title",
                  })
                ),
                Match.when("RATE_LIMITED", () =>
                  toast.error({
                    description: "school-rate.description",
                    title: "school-rate.title",
                  })
                ),
                Match.when("LOGIN_ACCOUNT", () =>
                  toast.error({
                    description: "school-login-account.description",
                    title: "school-login-account.title",
                  })
                ),
                Match.orElse(() => {
                  refocus.current = Option.some(NAME_INPUT);
                  startOpening(() => setItem("name"));
                })
              )
            ),
            Match.orElse((failure) => {
              Effect.runFork(
                reportClientException(failure, { source: "school-start-open" })
              );
              toast.error({
                description: "school-open-error.description",
                title: "school-open-error.title",
              });
            })
          );
        },
        onSuccess: ({ address }) => {
          startOpening(() => setOpened(Option.some(school)));
          // The new school replaces this questionnaire in the history, so Back never
          // returns to a blank questionnaire of a school that is already open.
          window.location.replace(address);
        },
      });
    });
  }

  if (Option.isSome(shown)) {
    return <StartOpening name={shown.value.name} slug={shown.value.slug} />;
  }

  const country = draft?.country ?? "ID";

  return (
    <StartContext value={{ draft, legal, save, typed }}>
      {nina}
      <Questionnaire
        className="w-full max-w-md"
        item={item}
        items={[
          { name: "name", required: true },
          {
            choices: Arr.map(StartCountry.literals, (value) => ({ value })),
            name: "country",
            required: true,
          },
          {
            choices: Arr.map(levelsOf(country), (value) => ({ value })),
            name: "levels",
            required: true,
          },
          {
            choices: Arr.map(StartRole.literals, (value) => ({ value })),
            name: "role",
            required: true,
          },
          {
            choices: Arr.map(SchoolSize.literals, (value) => ({ value })),
            name: "size",
            required: true,
          },
        ]}
        onItemChange={handleItemChange}
        onSubmit={handleSubmit}
        ref={focusReturned}
        shortcuts="letters"
      >
        <QuestionnaireProgress
          className="flex w-full flex-col gap-2"
          render={(props, { current, total }) => (
            <div {...props}>
              <div aria-hidden="true" className="grid w-full grid-cols-5 gap-2">
                {Arr.map(START_ITEMS, (name, index) => (
                  <span
                    className={cn(
                      "h-1 rounded-full bg-muted transition-colors",
                      index < current && "bg-primary"
                    )}
                    key={name}
                  />
                ))}
              </div>
              <span>{t("progress", { current, total })}</span>
            </div>
          )}
        />
        <StartNameQuestion />
        <StartCountryQuestion />
        <StartLevelsQuestion />
        <StartRoleQuestion />
        <StartSizeQuestion />
        <QuestionnaireSteps finishIcon={School01Icon} inert={isOpening}>
          {t("finish")}
        </QuestionnaireSteps>
      </Questionnaire>
    </StartContext>
  );
}
