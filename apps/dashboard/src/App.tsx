import { useMemo, useState } from "react";
import { defaultPolicy, defaultRequest, previewDecision } from "./guard";
import "./style.css";

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export function App() {
  const [policyRaw, setPolicyRaw] = useState(pretty(defaultPolicy));
  const [requestRaw, setRequestRaw] = useState(pretty(defaultRequest));
  const result = useMemo(() => previewDecision(policyRaw, requestRaw), [policyRaw, requestRaw]);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Base Spend Guard</p>
        <h1>Preview agent spend policies before signing.</h1>
        <p>
          Paste a policy and transaction request. The dashboard runs the same deterministic core engine used by the SDK and MCP server.
        </p>
      </section>

      <section className="grid" aria-label="Policy preview inputs">
        <label>
          Policy JSON
          <textarea value={policyRaw} onChange={(event) => setPolicyRaw(event.target.value)} spellCheck={false} />
        </label>
        <label>
          Spend request JSON
          <textarea value={requestRaw} onChange={(event) => setRequestRaw(event.target.value)} spellCheck={false} />
        </label>
      </section>

      <section className="decision" aria-live="polite">
        <div>
          <span>Decision</span>
          <strong className={result.decision?.action ?? "error"}>{result.decision?.action ?? "error"}</strong>
        </div>
        <pre>{result.error ?? pretty(result.decision)}</pre>
      </section>
    </main>
  );
}
