import type { BaseAsk } from "@repo/seo/ask/types";

const data: BaseAsk[] = [];

export const highSchool11MathematicsData = data.map((item) => ({
  ...item,
  category: "high-school",
  grade: "11",
  material: "mathematics",
}));
