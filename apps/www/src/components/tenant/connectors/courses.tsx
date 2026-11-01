import type { Ref } from "@confect/core";
import { useAction } from "@confect/react";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Array as Arr, Effect, Option } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useState,
  useTransition,
} from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import {
  forumCall,
  runForumCall,
} from "@/components/tenant/classes/forum/call";
import { useTenant } from "@/components/tenant/context";

/** What a preview answers: the school's classes, its connection, and the courses it teaches. */
export type Preview = NonNullable<
  Ref.Returns<typeof connectors.classroom.preview>
>;

/** One course of a preview. */
export type Course = Preview["courses"][number];

/**
 * What Google last answered for the open Classroom, which the pane's body and its footer both read. Its actions are
 * functions, so it is a plain shape.
 */
interface CoursesStore {
  /** Marks the read as failed, and keeps the courses it already shows. */
  readonly fail: () => void;
  readonly hasFailed: boolean;
  /** Shows a course in a class, or in none, before the server answers. */
  readonly place: (courseId: string, classId: Course["classId"]) => void;
  readonly preview: Option.Option<Preview>;
  /** Takes what Google answered, where no answer is a failed read. */
  readonly settle: (answer: Option.Option<Preview>) => void;
}

/** Creates the read of one open detail, which has no answer yet. */
const createCourses = () =>
  createStore<CoursesStore>()((set) => ({
    fail: () => set({ hasFailed: true }),
    hasFailed: false,
    place: (courseId, classId) =>
      set(({ preview }) => ({
        preview: Option.map(preview, (found) => ({
          ...found,
          courses: Arr.map(found.courses, (row) =>
            row.courseId === courseId ? { ...row, classId } : row
          ),
        })),
      })),
    preview: Option.none(),
    settle: (answer) =>
      set({ hasFailed: Option.isNone(answer), preview: answer }),
  }));

const CoursesContext = createContext<StoreApi<CoursesStore> | null>(null);

/** Gives an open detail its one read of the courses, for the body that shows them and the footer that acts on them. */
export function CoursesProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createCourses);

  return <CoursesContext value={store}>{children}</CoursesContext>;
}

/** Reads one selected slice of the open detail's courses. */
export function useCourses<T>(selector: (state: CoursesStore) => T) {
  const store = use(CoursesContext);

  if (store === null) {
    throw new Error("useCourses must be used within CoursesProvider");
  }

  return useStore(store, selector);
}

/** Asks Google for the courses. */
export function useLoadCourses() {
  const { slug } = useTenant();
  const preview = useAction(connectors.classroom.preview);
  const fail = useCourses((state) => state.fail);
  const settle = useCourses((state) => state.settle);
  const [isLoading, startLoading] = useTransition();

  const load = () =>
    startLoading(() =>
      runForumCall(
        forumCall(() => preview({ slug })).pipe(
          Effect.tap((answer) =>
            Effect.sync(() => settle(Option.fromNullOr(answer)))
          )
        ),
        fail
      )
    );

  return { isLoading, load };
}
