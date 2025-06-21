"use server";

export async function condition1(x: number, y: number): Promise<boolean> {
  await Promise.resolve();
  return x + y <= 10;
}

export async function condition2(x: number, y: number): Promise<boolean> {
  await Promise.resolve();
  return 15 * x + 9 * y >= 120;
}
