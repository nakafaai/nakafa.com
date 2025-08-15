"use server";

const COEFFICIENT_X = 15;
const COEFFICIENT_Y = 9;
const CONSTANT = 120;

export async function condition1(x: number, y: number): Promise<boolean> {
  await Promise.resolve();
  return x + y <= 10;
}

export async function condition2(x: number, y: number): Promise<boolean> {
  await Promise.resolve();
  return COEFFICIENT_X * x + COEFFICIENT_Y * y >= CONSTANT;
}
