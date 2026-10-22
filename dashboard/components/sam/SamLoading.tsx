import { DecodeText } from "./Decode";

// Samaritan's calculating state: the prompt types out behind a cursor that
// keeps blinking, a hairline sweeps beneath it and the triangle pulses.
// `compact` fits inside a panel; the default fills a route.
export default function SamLoading({
  label = "Calculating response",
  compact = false,
  className = "",
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`sam-ui flex flex-col items-center justify-center text-center ${
        compact ? "min-h-[9rem] py-6" : "min-h-[60vh]"
      } ${className}`}
    >
      <DecodeText
        text={label}
        trigger="mount"
        hold
        underline={false}
        className={`font-display uppercase tracking-[0.06em] text-signal ${compact ? "text-[13px]" : "text-[22px]"}`}
      />
      <div className={`sam-loading-line mt-3 h-px ${compact ? "w-32" : "w-56"}`} aria-hidden />
      <span className="sam-triangle sam-pulse mt-2" aria-hidden />
    </div>
  );
}
