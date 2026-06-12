/**
 * Minimal fixed-point decimal helpers for USD amounts represented as strings.
 * We scale to 1e6 (micro-dollars) internally and compare as BigInt — no floats.
 */

const SCALE = 1_000_000n; // 6 dp is enough for USD cents + buffer

/** Parse a decimal string like "100.50" into scaled micro-units (BigInt). */
export function toMicro(value: string): bigint {
  const s = value.trim();
  if (s === "") return 0n;
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`invalid decimal: ${value}`);
  }
  const neg = s.startsWith("-");
  const abs = neg ? s.slice(1) : s;
  const [intPart, fracPartRaw = ""] = abs.split(".");
  const fracPart = (fracPartRaw + "000000").slice(0, 6);
  const micro = BigInt(intPart) * SCALE + BigInt(fracPart || "0");
  return neg ? -micro : micro;
}

/** Format scaled micro-units back to a trimmed decimal string. */
export function fromMicro(micro: bigint): string {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const intPart = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  const body = frac ? `${intPart}.${frac}` : `${intPart}`;
  return neg ? `-${body}` : body;
}

export function addUsd(a: string, b: string): string {
  return fromMicro(toMicro(a) + toMicro(b));
}

/** Returns true if a > b. */
export function gtUsd(a: string, b: string): boolean {
  return toMicro(a) > toMicro(b);
}

/** Returns true if a >= b. */
export function gteUsd(a: string, b: string): boolean {
  return toMicro(a) >= toMicro(b);
}
