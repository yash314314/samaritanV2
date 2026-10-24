"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { authConfig } from "../../lib/auth";
import { safeNextPath } from "../../components/AuthGate";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AccessPanel, { AccessField } from "../../components/sam/AccessPanel";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authConfig().then((config) => {
      if (!cancelled) setRegistrationOpen(config.registrationOpen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessPanel
      prompt="Awaiting credentials"
      error={error}
      footer={
        registrationOpen ? (
          <>
            No account yet?{" "}
            <Link href="/register" className="text-signal underline-offset-4 hover:underline">
              Create one
            </Link>
          </>
        ) : (
          <>Accounts are created by the administrator of this server.</>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AccessField label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="sam-input" required />
        </AccessField>
        <AccessField label="Password">
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="sam-input" required />
        </AccessField>
        <button type="submit" disabled={loading} className="sam-button w-full py-2" data-variant="primary">
          {loading ? "Verifying" : "Sign in"}
        </button>
      </form>
    </AccessPanel>
  );
}
