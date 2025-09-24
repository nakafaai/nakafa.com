import type { BaseAsk } from "@repo/seo/ask/types";

const data: BaseAsk[] = [];

export const highSchool12MathematicsData = data.map((item) => ({
  ...item,
  category: "high-school",
  grade: "12",
  material: "mathematics",
}));
