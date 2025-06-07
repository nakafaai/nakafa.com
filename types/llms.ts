import type { routing } from "@/i18n/routing";
import type { ArticleCategory } from "./articles/category";
import type { SubjectCategory } from "./subject/category";
import type { Grade } from "./subject/grade";
import type { MaterialGrade } from "./subject/material";

export type Article = {
  category: ArticleCategory;
  slug: string;
};

export type Subject = {
  category: SubjectCategory;
  grade: Grade;
  material: MaterialGrade;
  slug: string[];
};

export type ContentTask = {
  locale: (typeof routing.locales)[number];
  filePath: string;
  section: string;
};
