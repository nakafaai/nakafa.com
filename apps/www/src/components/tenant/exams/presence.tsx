import { QueryResult, useMutation, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { ExamEditor } from "@repo/backend/confect/exams/presence";
import {
  AvatarGroup,
  AvatarGroupCount,
} from "@repo/design-system/components/ui/avatar";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cva } from "class-variance-authority";
import { Array as Arr, Data, Effect, Fiber } from "effect";
import { useEffect } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { sentAction } from "@/components/tenant/exams/action";
import { makeHeartbeat } from "@/components/tenant/exams/heartbeat";
import { useExam } from "@/components/tenant/exams/provider";
import { reportClientException } from "@/lib/analytics/client";

/** Where the presence of the editor reports its failures. */
const SOURCE = "components/tenant/exams/presence";

/** The most avatars the row shows before it counts the rest in one more circle. */
const SHOWN_EDITORS = 3;

/** The round focus ring of an avatar's trigger, which holds no style of its own. */
const presenceTrigger = cva(
  "rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
);

/** A leave that did not reach the server. */
class LeaveFailed extends Data.TaggedError("LeaveFailed")<{
  readonly cause: unknown;
}> {}

/** One other teacher in the exam's editor. */
type Editor = typeof ExamEditor.Type;

/**
 * The other teachers in the exam's editor, as Canva and Google Docs show their co-editors: an
 * avatar for each, with a tooltip that names them, up to four circles, the last counting the rest
 * when more are in. The editor joins the exam's room while it is open, and only once Convex holds
 * the session, because a join before then is refused. An archived unit's exam is read only, so it
 * joins no room. The row shows nothing until the room is read and while no one else is in it, and
 * it sits at the end of the title, so the title and the actions keep their places.
 */
export function ExamPresence() {
  const { exam, slug } = useExam();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const isOpen = isSettled && !exam.archived;
  useExamHeartbeat(isOpen);
  const editors = useQuery(
    exams.presence.list,
    isOpen ? { examId: exam.id, slug } : "skip"
  );

  if (
    !QueryResult.isSuccess(editors) ||
    Arr.isReadonlyArrayEmpty(editors.value)
  ) {
    return null;
  }

  return <PresenceRow editors={editors.value} />;
}

/**
 * Keeps this editor in the exam's room while `isOpen` holds: it joins at once, beats every
 * interval while the tab shows, joins again a moment after the tab shows once a beat found it hidden, and
 * leaves when the page goes away or the editor closes (`makeHeartbeat`). A failure is reported,
 * and the row keeps what the room last said.
 */
function useExamHeartbeat(isOpen: boolean) {
  const { exam, slug } = useExam();
  const join = useMutation(exams.presence.join);
  const leave = useMutation(exams.presence.leave);
  const examId = exam.id;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const report = (error: unknown) =>
      reportClientException(error, { source: SOURCE });
    const heartbeat = Effect.runSync(
      makeHeartbeat({
        isVisible: () => document.visibilityState === "visible",
        join: (session) =>
          sentAction(() => join({ examId, session, slug })).pipe(
            Effect.map((joined) => joined.token)
          ),
        leave: (token) =>
          Effect.tryPromise({
            catch: (cause) => new LeaveFailed({ cause }),
            try: () => leave({ token }),
          }).pipe(Effect.asVoid, Effect.catch(report)),
      })
    );
    const running = Effect.runFork(heartbeat.run.pipe(Effect.catch(report)));

    function onVisibility() {
      if (document.visibilityState === "visible") {
        Effect.runFork(heartbeat.returned.pipe(Effect.catch(report)));
      }
    }

    function onPageHide() {
      Effect.runFork(heartbeat.leave);
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        Effect.runFork(heartbeat.returned.pipe(Effect.catch(report)));
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      Effect.runFork(Fiber.interrupt(running));
    };
  }, [examId, isOpen, join, leave, slug]);
}

/**
 * The avatars of the other editors. Up to four show as they are; past four, the first three show
 * and the last circle counts the rest, so the row never takes more than four circles.
 */
function PresenceRow({ editors }: { editors: readonly Editor[] }) {
  const [shown, rest] =
    editors.length <= SHOWN_EDITORS + 1
      ? [editors, []]
      : Arr.splitAt(editors, SHOWN_EDITORS);

  return (
    <AvatarGroup className="shrink-0">
      {Arr.map(shown, (editor) => (
        <EditorAvatar editor={editor} key={editor.id} />
      ))}
      {Arr.isReadonlyArrayNonEmpty(rest) ? (
        <MoreEditors editors={rest} />
      ) : null}
    </AvatarGroup>
  );
}

/** One other editor's avatar, which names them in its tooltip and to a screen reader. */
function EditorAvatar({ editor }: { editor: Editor }) {
  const t = useTranslations("Exams");

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={t("presence-editor", { name: editor.name })}
        className={presenceTrigger()}
        type="button"
      >
        <PersonAvatar
          className="ring-2 ring-background"
          mascot={editor.mascot}
          photo={editor.image}
          size="sm"
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p dir="auto">{editor.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** The circle that counts the editors past the shown avatars, with a tooltip that lists them. */
function MoreEditors({ editors }: { editors: readonly Editor[] }) {
  const t = useTranslations("Exams");
  const format = useFormatter();
  const names = format.list(
    Arr.map(editors, (editor) => editor.name),
    { type: "conjunction" }
  );

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={t("presence-more", { names })}
        className={presenceTrigger()}
        type="button"
      >
        <AvatarGroupCount className="text-xs tabular-nums">
          +{editors.length}
        </AvatarGroupCount>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <ul>
          {Arr.map(editors, (editor) => (
            <li dir="auto" key={editor.id}>
              {editor.name}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
