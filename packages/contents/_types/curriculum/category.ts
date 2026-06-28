import { SUBJECT_CATEGORIES } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

export const SubjectCategorySchema = Schema.Literal(...SUBJECT_CATEGORIES);
