import { describe, it, expect } from "vitest";
import { toMicro, fromMicro, addUsd, gtUsd, gteUsd } from "../src/decimal.js";

describe("decimal", () => {
  it("round-trips integers and decimals", () => {
    expect(fromMicro(toMicro("100"))).toBe("100");
    expect(fromMicro(toMicro("100.50"))).toBe("100.5");
    expect(fromMicro(toMicro("0.000001"))).toBe("0.000001");
  });

  it("adds without float drift", () => {
    expect(addUsd("0.1", "0.2")).toBe("0.3");
    expect(addUsd("99.99", "0.01")).toBe("100");
  });

  it("compares correctly", () => {
    expect(gtUsd("100.01", "100")).toBe(true);
    expect(gtUsd("100", "100")).toBe(false);
    expect(gteUsd("100", "100")).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(() => toMicro("abc")).toThrow();
  });
});
