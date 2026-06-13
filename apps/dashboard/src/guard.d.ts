import { type Decision, type Policy, type SpendRequest } from "@spendguard/core";
export declare const defaultPolicy: Policy;
export declare const defaultRequest: SpendRequest;
export declare function parseJson<T>(raw: string): {
    ok: true;
    value: T;
} | {
    ok: false;
    error: string;
};
export declare function previewDecision(policyRaw: string, requestRaw: string): {
    decision?: Decision;
    error?: string;
};
