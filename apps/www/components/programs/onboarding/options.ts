import {
  type SelfSelectableUserRole,
  selfSelectableUserRoles,
} from "@repo/backend/convex/users/roles";
import type {
  LearningInterest,
  LearningProgramKind,
} from "@repo/contents/_types/program/schema";

export type ChoiceTone = "guide" | "nina" | "practice" | "school" | "target";
export type PreviewAsset =
  | "/classes/ball.png"
  | "/classes/lamp.png"
  | "/classes/music.png"
  | "/classes/puzzle.png"
  | "/classes/rocket.png"
  | "/classes/sakura.png"
  | "/classes/sky.png"
  | "/classes/stars.png"
  | "/classes/writer.png";

/** Normal Nakafa roles accepted by the learner-facing onboarding flow. */
export type OnboardingRole = SelfSelectableUserRole;

/** One role card shown on the first onboarding step. */
export interface RoleOption {
  descriptionKey: `onboarding.role.${OnboardingRole}.description`;
  image: PreviewAsset;
  key: OnboardingRole;
  titleKey: `onboarding.role.${OnboardingRole}.title`;
  tone: ChoiceTone;
}

const studentSchoolFocusKey = "student-school";
const studentExamFocusKey = "student-exam";
const teacherMaterialsFocusKey = "teacher-materials";
const teacherPracticeFocusKey = "teacher-practice";
const parentUnderstandFocusKey = "parent-understand";
const parentPracticeFocusKey = "parent-practice";

export const onboardingFocusKeys = [
  studentSchoolFocusKey,
  studentExamFocusKey,
  teacherMaterialsFocusKey,
  teacherPracticeFocusKey,
  parentUnderstandFocusKey,
  parentPracticeFocusKey,
] as const;

export type OnboardingFocusKey = (typeof onboardingFocusKeys)[number];

const studentFocusOptions = [
  {
    descriptionKey: "onboarding.focus.student.school.description",
    image: "/classes/writer.png",
    interest: "school-curriculum",
    key: studentSchoolFocusKey,
    preferredKinds: ["school-curriculum"],
    titleKey: "onboarding.focus.student.school.title",
    tone: "school",
  },
  {
    descriptionKey: "onboarding.focus.student.exam.description",
    image: "/classes/rocket.png",
    interest: "exam-prep",
    key: studentExamFocusKey,
    preferredKinds: ["admission-exam"],
    titleKey: "onboarding.focus.student.exam.title",
    tone: "target",
  },
] as const;

const teacherFocusOptions = [
  {
    descriptionKey: "onboarding.focus.teacher.materials.description",
    image: "/classes/puzzle.png",
    interest: "school-curriculum",
    key: teacherMaterialsFocusKey,
    preferredKinds: ["school-curriculum"],
    titleKey: "onboarding.focus.teacher.materials.title",
    tone: "school",
  },
  {
    descriptionKey: "onboarding.focus.teacher.practice.description",
    image: "/classes/ball.png",
    interest: "assessment-prep",
    key: teacherPracticeFocusKey,
    preferredKinds: ["assessment", "admission-exam"],
    titleKey: "onboarding.focus.teacher.practice.title",
    tone: "practice",
  },
] as const;

const parentFocusOptions = [
  {
    descriptionKey: "onboarding.focus.parent.understand.description",
    image: "/classes/stars.png",
    interest: "school-curriculum",
    key: parentUnderstandFocusKey,
    preferredKinds: ["school-curriculum"],
    titleKey: "onboarding.focus.parent.understand.title",
    tone: "school",
  },
  {
    descriptionKey: "onboarding.focus.parent.practice.description",
    image: "/classes/music.png",
    interest: "assessment-prep",
    key: parentPracticeFocusKey,
    preferredKinds: ["assessment", "admission-exam"],
    titleKey: "onboarding.focus.parent.practice.title",
    tone: "practice",
  },
] as const;

export const roleOptions = [
  {
    descriptionKey: "onboarding.role.student.description",
    image: "/classes/sakura.png",
    key: "student",
    titleKey: "onboarding.role.student.title",
    tone: "school",
  },
  {
    descriptionKey: "onboarding.role.teacher.description",
    image: "/classes/lamp.png",
    key: "teacher",
    titleKey: "onboarding.role.teacher.title",
    tone: "guide",
  },
  {
    descriptionKey: "onboarding.role.parent.description",
    image: "/classes/sky.png",
    key: "parent",
    titleKey: "onboarding.role.parent.title",
    tone: "nina",
  },
] as const satisfies readonly RoleOption[];

export const focusOptionsByRole = {
  parent: parentFocusOptions,
  student: studentFocusOptions,
  teacher: teacherFocusOptions,
} as const satisfies Record<
  OnboardingRole,
  readonly {
    descriptionKey: string;
    image: PreviewAsset;
    interest: LearningInterest;
    key: string;
    preferredKinds: readonly LearningProgramKind[];
    titleKey: string;
    tone: ChoiceTone;
  }[]
>;

export type FocusOption = (typeof focusOptionsByRole)[OnboardingRole][number];

/** Runtime role values shared with the user profile role mutation. */
export const onboardingRoles = selfSelectableUserRoles;
