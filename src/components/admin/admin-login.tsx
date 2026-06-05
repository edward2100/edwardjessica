"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const json = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(json.error || "Unable to sign in.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="app-shell section">
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="panel">
          <p className="eyebrow">
            <LockKeyhole size={14} style={{ display: "inline", marginRight: 6 }} />
            Admin
          </p>
          <h1 className="title serif">Edward & Jessica</h1>
          <form
            action="/admin/session"
            method="post"
            onSubmit={submit}
            style={{ display: "grid", gap: 14, marginTop: 28 }}
          >
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                className="input"
                id="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Enter your password"
                required
              />
            </div>
            {error ? <p className="muted">{error}</p> : null}
            <button className="button button-muted" type="submit" disabled={loading}>
              <LogIn size={17} />
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
