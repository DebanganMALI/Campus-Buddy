import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Label + control + hint + error, wired with aria-describedby so screen readers read the error. */
export function Field({
  label,
  optional,
  hint,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label} {optional && <span className="opt">(optional)</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="field-error">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message && ref.current) {
      ref.current.focus({ preventScroll: true });
      ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [message]);
  if (!message) return null;
  return (
    <p className="form-error" role="alert" tabIndex={-1} ref={ref}>
      <Icon name="alert" />
      <span>{message}</span>
    </p>
  );
}
