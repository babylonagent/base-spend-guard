/**
 * Minimal ERC20 calldata decoder — no external deps.
 * Recognizes transfer, transferFrom, approve, increaseAllowance.
 * All parsing is pure string/BigInt; we never execute anything.
 */

export const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

export type Erc20Method =
  | "transfer"
  | "transferFrom"
  | "approve"
  | "increaseAllowance"
  | "unknown";

export interface DecodedErc20 {
  method: Erc20Method;
  /** Recipient (transfer) or spender (approve/increaseAllowance). */
  target?: string;
  /** Raw token amount (base units) as BigInt. */
  amount?: bigint;
  /** True when amount === MaxUint256 (unlimited approval). */
  unlimited: boolean;
  /** True for approve/increaseAllowance. */
  isApproval: boolean;
}

const SELECTORS: Record<string, Erc20Method> = {
  "0xa9059cbb": "transfer", // transfer(address,uint256)
  "0x23b872dd": "transferFrom", // transferFrom(address,address,uint256)
  "0x095ea7b3": "approve", // approve(address,uint256)
  "0x39509351": "increaseAllowance", // increaseAllowance(address,uint256)
};

function readAddress(words: string, wordIndex: number): string {
  const start = wordIndex * 64;
  const word = words.slice(start, start + 64);
  return ("0x" + word.slice(24)).toLowerCase();
}

function readUint(words: string, wordIndex: number): bigint {
  const start = wordIndex * 64;
  const word = words.slice(start, start + 64);
  return BigInt("0x" + (word || "0"));
}

/** Decode ERC20 calldata. Returns method "unknown" for anything unrecognized. */
export function decodeErc20(data?: string): DecodedErc20 {
  if (!data || data === "0x" || data.length < 10) {
    return { method: "unknown", unlimited: false, isApproval: false };
  }
  const selector = data.slice(0, 10).toLowerCase();
  const method = SELECTORS[selector] ?? "unknown";
  const words = data.slice(10);

  if (method === "transfer") {
    return {
      method,
      target: readAddress(words, 0),
      amount: readUint(words, 1),
      unlimited: false,
      isApproval: false,
    };
  }
  if (method === "transferFrom") {
    return {
      method,
      target: readAddress(words, 1), // to
      amount: readUint(words, 2),
      unlimited: false,
      isApproval: false,
    };
  }
  if (method === "approve" || method === "increaseAllowance") {
    const amount = readUint(words, 1);
    return {
      method,
      target: readAddress(words, 0), // spender
      amount,
      unlimited: amount === MAX_UINT256,
      isApproval: true,
    };
  }
  return { method: "unknown", unlimited: false, isApproval: false };
}

/**
 * Convert a token base-unit amount to a USD decimal string.
 * Default valuation assumes a USD-pegged stable (e.g. USDC) at 1:1.
 * decimals defaults to 6 (USDC). Override priceUsd for non-pegged tokens.
 */
export function tokenAmountToUsd(
  amount: bigint,
  opts: { decimals?: number; priceUsd?: string } = {},
): string {
  const decimals = opts.decimals ?? 6;
  const price = opts.priceUsd ?? "1";
  // value = amount / 10^decimals * price ; compute in micro-USD (1e6).
  const priceMicro = BigInt(Math.round(Number(price) * 1_000_000));
  const denom = 10n ** BigInt(decimals);
  const micro = (amount * priceMicro) / denom;
  const intPart = micro / 1_000_000n;
  const frac = (micro % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : `${intPart}`;
}
