import type { ReactNode } from "react";

// Sign-in and registration frame, modelled on the Samaritan lock screen:
// identity, the prompt line with its triangle, then the form.
export default function AccessPanel({
  prompt,
  error,
  children,
  footer,
}: {
  prompt: string;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="sam-ui flex min-h-[78vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="font-display text-[13px] uppercase tracking-[0.18em] text-key">Samaritan</span>
          <h1 className="mt-6 !text-[20px]">{prompt}</h1>
          <div className="mt-3 h-px w-48 bg-signal" aria-hidden />
          <span className="sam-triangle sam-pulse mt-2" aria-hidden />
        </div>

        {error && (
          <p className="mt-8 border-l border-alert pl-3 text-[12px] text-alert" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8">{children}</div>

        {footer && <div className="mt-6 text-center text-[12px] text-key">{footer}</div>}
      </div>
    </div>
  );
}

export function AccessField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="sam-key mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
