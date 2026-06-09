import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AppUser } from "../../convex/users";

export function Login({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const login = useMutation(api.users.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await login({ email, password });
      if (res.ok) onLogin(res.user);
      else setError(res.error);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="side-brand" style={{ padding: 0, marginBottom: 6 }}>
          <div className="side-logo">O</div>
          <div className="side-name">OPPRating<small>Commercial Engine</small></div>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "0 0 16px" }}>
          The pipeline machine. Sign in with your Oppr account.
        </p>
        <label className="f-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            placeholder="you@oppr.ai"
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>
        <label className="f-field" style={{ marginTop: 10 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>
        {error && <p style={{ color: "var(--red)", fontSize: 12, margin: "10px 0 0" }}>{error}</p>}
        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} onClick={submit} disabled={busy || !email.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="faint" style={{ fontSize: 11, marginTop: 14, marginBottom: 0 }}>
          Team accounts: floris@ · lars@ · sales1@ · sales2@ (oppr.ai)
        </p>
      </div>
    </div>
  );
}
