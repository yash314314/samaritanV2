"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { authConfig } from "../../lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AccessPanel, { AccessField } from "../../components/sam/AccessPanel";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

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
      await register(name, email, password);
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessPanel
      prompt="New profile"
      error={registrationOpen === false ? "Registration is closed on this server. Ask its administrator for an account." : error}
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="text-signal underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AccessField label="Name">
          <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="sam-input" required />
        </AccessField>
        <AccessField label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="sam-input" required />
        </AccessField>
        <AccessField label="Password">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} className="sam-input" required aria-describedby="password-rule" />
          <span id="password-rule" className="mt-1 block text-[11px] text-key">At least 10 characters.</span>
        </AccessField>
        <button type="submit" disabled={loading || registrationOpen === false} className="sam-button w-full py-2" data-variant="primary">
          {loading ? "Creating profile" : "Create profile"}
        </button>
      </form>
    </AccessPanel>
  );
}
