import { describe, expect, it } from "vitest";
import { createHash } from "./crypto-shim";

const vectors = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  ["Base Spend Guard", "c8837cc8e487f30e14a405be0c37d66376967f0f728c83d4efc1b67a40356936"],
];

describe("dashboard crypto shim", () => {
  it.each(vectors)("matches sha256 test vector for %s", (input, expected) => {
    expect(createHash("sha256").update(input).digest("hex")).toBe(expected);
  });
});
