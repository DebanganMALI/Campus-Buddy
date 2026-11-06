import { useEffect, useRef, useState } from "react";
import { loginBody } from "@scc/shared";
import { login } from "../api/endpoints/auth";
import { isApiError } from "../api/errors";
import { useAuth } from "../auth/auth-context";
import { toFieldErrors, type FieldErrors } from "../lib/form-errors";

const IS_MOCK = import.meta.env.MODE === "mock";

export function LoginPage() {
  const { refetchMe } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Log in · Campus Companion";
  }, []);

  // Countdown after "too many attempts"; the button stays disabled until it reaches 0
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const t = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [waitSeconds]);

  async function submit() {
    if (pending || waitSeconds > 0) return;
    setFormError(null);

    // Check in the browser first with the SAME schema the server uses
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = "Enter your email.";
    if (!password) errors.password = "Enter your password.";
    const parsed = loginBody.safeParse({ email, password });
    if (Object.keys(errors).length > 0 || !parsed.success) {
      setFieldErrors(parsed.success ? errors : { ...toFieldErrors(parsed.error.issues), ...errors });
      return;
    }
    setFieldErrors({});
    setPending(true);

    try {
      const res = await login(parsed.data);
      if (res.status === "MFA_REQUIRED") {
        setFormError("This account needs two-step login, which this version doesn't support yet. Contact an admin.");
        return;
      }
      await refetchMe(); // the GuestOnly guard then sends the user on to returnTo
    } catch (err) {
      if (!isApiError(err)) {
        setFormError("Something went wrong. Please try again.");
        return;
      }
      switch (err.code) {
        case "INVALID_CREDENTIALS":
          // Show the server's generic message as-is: never reveal whether the email exists
          setFormError(err.message);
          setPassword("");
          passwordRef.current?.focus();
          break;
        case "ACCOUNT_LOCKED":
        case "RATE_LIMITED":
          setFormError(err.message);
          setWaitSeconds(err.retryAfter ?? 60);
          break;
        case "VALIDATION_ERROR":
          setFieldErrors(toFieldErrors(err.issues ?? []));
          setFormError(err.message);
          break;
        default:
          setFormError(err.requestId ? `${err.message} (Ref: ${err.requestId})` : err.message);
      }
    } finally {
      setPending(false);
    }
  }

  const blocked = pending || waitSeconds > 0;

  return (
    <main className="center-screen">
      <div className="card auth-card">
        <p className="eyebrow">Campus Companion</p>
        <h1>Log in</h1>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
            {waitSeconds > 0 && ` Try again in ${waitSeconds}s.`}
          </p>
        )}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="field">
            <label htmlFor="email">College email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="field-error">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-row">
              <input
                id="password"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                spellCheck={false}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                className="btn btn-ghost"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="field-error">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary full" disabled={blocked} aria-busy={pending || undefined}>
            {pending ? "Logging in…" : "Log in"}
          </button>
        </form>

        {IS_MOCK && (
          <aside className="mock-hint">
            <p className="eyebrow">Mock mode · sample accounts</p>
            <p className="small">
              student.a@iem.edu.in · faculty.b@iem.edu.in · admin.c@iem.edu.in
              <br />
              Password: <code>demo-password-123</code> · Try locked@iem.edu.in for the lock screen.
            </p>
          </aside>
        )}
      </div>
    </main>
  );
}
