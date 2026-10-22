"use client";

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AccessPanel, { AccessField } from "../../components/sam/AccessPanel";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("admin@samaritan.local");
  const [password, setPassword] = useState("SamaritanSecure2026!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push("/");
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
        <>
          No account yet?{" "}
          <Link href="/register" className="text-signal underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
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
