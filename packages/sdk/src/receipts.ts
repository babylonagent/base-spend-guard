import { Wallet, verifyMessage } from "ethers";
import type { Decision } from "@spendguard/core";

export interface SpendReceipt {
  /** Recipient of the spend. */
  to: string;
  /** USD value of the spend (decimal string). */
  valueUsd: string;
  /** Logical tool/route that spent the budget. */
  tool?: string;
  /** Final policy decision action. */
  decision: Decision["action"];
  /** sha256 of the policy used. */
  policyHash: string;
  /** Epoch milliseconds. */
  timestamp: number;
  /** Unique nonce to prevent receipt replay. */
  nonce: string;
}

export interface SignedReceipt extends SpendReceipt {
  /** EIP-191 personal_sign signature over the canonical receipt. */
  signature: string;
  /** Address that signed the receipt. */
  signer: string;
}

/** Canonical, sorted-key JSON for stable signing/verification. */
export function canonicalReceipt(r: SpendReceipt): string {
  const ordered: SpendReceipt = {
    to: r.to.toLowerCase(),
    valueUsd: r.valueUsd,
    tool: r.tool,
    decision: r.decision,
    policyHash: r.policyHash,
    timestamp: r.timestamp,
    nonce: r.nonce,
  };
  return JSON.stringify(ordered, Object.keys(ordered).sort());
}

/** Sign a spend receipt with an EOA private key (EIP-191). */
export async function signReceipt(
  receipt: SpendReceipt,
  privateKey: string,
): Promise<SignedReceipt> {
  const wallet = new Wallet(privateKey);
  const message = canonicalReceipt(receipt);
  const signature = await wallet.signMessage(message);
  return { ...receipt, signature, signer: wallet.address };
}

/** Verify a signed receipt. Returns true if the signature matches the signer. */
export function verifyReceipt(receipt: SignedReceipt): boolean {
  const { signature, signer, ...rest } = receipt;
  try {
    const recovered = verifyMessage(canonicalReceipt(rest), signature);
    return recovered.toLowerCase() === signer.toLowerCase();
  } catch {
    return false;
  }
}
