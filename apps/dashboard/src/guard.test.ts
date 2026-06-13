import { describe, expect, it } from "vitest";
import { defaultPolicy, defaultRequest, previewDecision } from "./guard";

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

describe("dashboard guard preview", () => {
  it("evaluates the default request", () => {
    const result = previewDecision(pretty(defaultPolicy), pretty(defaultRequest));
    expect(result.decision?.action).toBe("allow");
  });

  it("reports invalid JSON", () => {
    const result = previewDecision("{", pretty(defaultRequest));
    expect(result.error).toContain("Policy JSON");
  });
});
