---
"www": patch
"@repo/backend": patch
"@repo/contents": patch
"@repo/email": patch
"@repo/internationalization": patch
"@repo/seo": patch
---

Score short answers, rubrics, and penalized try-outs from one response module.
Try-outs read @nakafa/aksara-contracts 0.44.0. Short answers are graded against
their answer keys in the question's language, with a comma decimal in Indonesian
and German, a dot in English, and fractions only where the key accepts them.
Rubric final answers are graded on the spot, while written work waits for the
grader. Every answer now records whether it is correct, incorrect, partially
correct, or awaiting grading, and an answer awaiting grading keeps the score
provisional instead of counting as zero. Questions can be worth more than one
point, and penalized sets add their sections' signed marks for right, wrong, and
blank answers. Lesson pages use their search title in the browser tab and search
results, while navigation and headings keep the lesson's short name.
