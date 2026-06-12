import { describe, it, expect } from "vitest";
import { signReceipt, verifyReceipt, type SpendReceipt } from "../src/receipts.js";

// Well-known Hardhat test key #0 — public, never used for real funds.
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const base: SpendReceipt = {
  to: "0x1111111111111111111111111111111111111111",
  valueUsd: "10.5",
  tool: "tip",
  decision: "allow",
  policyHash: "sha256:deadbeef",
  timestamp: 1_750_000_000_000,
  nonce: "n-1",
};

describe("spend receipts", () => {
  it("signs and verifies a receipt", async () => {
    const signed = await signReceipt(base, TEST_KEY);
    expect(signed.signature).toMatch(/^0x/);
    expect(verifyReceipt(signed)).toBe(true);
  });

  it("fails verification when a field is tampered", async () => {
    const signed = await signReceipt(base, TEST_KEY);
    const tampered = { ...signed, valueUsd: "9999" };
    expect(verifyReceipt(tampered)).toBe(false);
  });

  it("fails verification when signer is swapped", async () => {
    const signed = await signReceipt(base, TEST_KEY);
    const tampered = { ...signed, signer: "0x0000000000000000000000000000000000000002" };
    expect(verifyReceipt(tampered)).toBe(false);
  });
});
