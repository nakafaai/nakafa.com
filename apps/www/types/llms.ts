import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import { routing } from "@repo/internationalization/src/routing";
import { Schema } from "effect";

export const ArticleSchema = Schema.Struct({
  category: ArticleCategorySchema,
  slug: Schema.Array(Schema.String),
}).pipe(Schema.mutable);
export type Article = Schema.Schema.Type<typeof ArticleSchema>;

export const SubjectSchema = Schema.Struct({
  category: SubjectCategorySchema,
  grade: GradeSchema,
  material: MaterialSchema,
  slug: Schema.Array(Schema.String),
}).pipe(Schema.mutable);
export type Subject = Schema.Schema.Type<typeof SubjectSchema>;

export const ContentTaskSchema = Schema.Struct({
  locale: Schema.Literal(...routing.locales),
  filePath: Schema.String,
  section: Schema.String,
}).pipe(Schema.mutable);
export type ContentTask = Schema.Schema.Type<typeof ContentTaskSchema>;
