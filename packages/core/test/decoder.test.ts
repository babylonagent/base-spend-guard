import { describe, it, expect } from "vitest";
import { decodeErc20, tokenAmountToUsd, MAX_UINT256 } from "../src/decoder.js";

// transfer(0x1111...,1000000) => 1 USDC (6 decimals)
const TRANSFER =
  "0xa9059cbb" +
  "0000000000000000000000001111111111111111111111111111111111111111" +
  "00000000000000000000000000000000000000000000000000000000000f4240"; // 1_000_000

// approve(0x2222...,MaxUint256)
const APPROVE_UNLIMITED =
  "0x095ea7b3" +
  "0000000000000000000000002222222222222222222222222222222222222222" +
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

// approve(0x2222...,500000) => 0.5 USDC
const APPROVE_FINITE =
  "0x095ea7b3" +
  "0000000000000000000000002222222222222222222222222222222222222222" +
  "000000000000000000000000000000000000000000000000000000000007a120"; // 500_000

describe("decodeErc20", () => {
  it("decodes transfer", () => {
    const d = decodeErc20(TRANSFER);
    expect(d.method).toBe("transfer");
    expect(d.target).toBe("0x1111111111111111111111111111111111111111");
    expect(d.amount).toBe(1_000_000n);
    expect(d.isApproval).toBe(false);
  });

  it("detects unlimited approval", () => {
    const d = decodeErc20(APPROVE_UNLIMITED);
    expect(d.method).toBe("approve");
    expect(d.isApproval).toBe(true);
    expect(d.unlimited).toBe(true);
    expect(d.amount).toBe(MAX_UINT256);
  });

  it("decodes finite approval", () => {
    const d = decodeErc20(APPROVE_FINITE);
    expect(d.isApproval).toBe(true);
    expect(d.unlimited).toBe(false);
    expect(d.amount).toBe(500_000n);
  });

  it("returns unknown for empty / non-erc20 data", () => {
    expect(decodeErc20("0x").method).toBe("unknown");
    expect(decodeErc20(undefined).method).toBe("unknown");
  });

  it("values USDC 1:1 at 6 decimals", () => {
    expect(tokenAmountToUsd(1_000_000n)).toBe("1");
    expect(tokenAmountToUsd(500_000n)).toBe("0.5");
    expect(tokenAmountToUsd(123_456_789n)).toBe("123.456789");
  });
});
