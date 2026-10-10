import { Ref } from "@confect/core";
import { expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createMemoryTest } from "@repo/backend/test/nina/memory";

const memory = refs.public.nina.memory;
const get = Ref.getFunctionReference(memory.get);
const enable = Ref.getFunctionReference(memory.enable);
const disable = Ref.getFunctionReference(memory.disable);
const forget = Ref.getFunctionReference(memory.forget);

it("answers browser tabs opened before October 2026 and changes nothing", async () => {
  const f = await createMemoryTest();
  await f.seed({ text: "Stays as it is" });
  const before = await f.stored();
  expect(await f.t.query(get, {})).toBeNull();
  expect(await f.owner.query(get, {})).toBeNull();
  expect(await f.owner.mutation(enable, {})).toEqual({ facts: [] });
  expect(await f.owner.mutation(disable, {})).toBeNull();
  expect(await f.owner.mutation(forget, { key: 0 })).toBeNull();
  // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
  expect(await f.stored()).toStrictEqual(before);
  expect(
    await f.t.query((ctx) => ctx.db.query("learningPreferences").collect())
  ).toEqual([]);
});
