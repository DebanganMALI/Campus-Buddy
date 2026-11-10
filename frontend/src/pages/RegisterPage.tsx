import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { DEPARTMENTS, LIMITS, YEARS, registerBody } from "@scc/shared";
import { register } from "../api/endpoints/auth";
import { isApiError } from "../api/errors";
import { Field, FormError } from "../components/Field";
import { Icon } from "../components/Icon";
import { AuthLayout } from "../layouts/AuthLayout";
import { toFieldErrors, type FieldErrors } from "../lib/form-errors";
import { useDocumentTitle } from "../lib/use-document-title";

export function RegisterPage() {
  useDocumentTitle("Create account");
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", rollNo: "", department: "", year: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (pending) return;
    setFormError(null);
    // Same schema the server validates with (shared/src/schemas/auth.ts)
    const parsed = registerBody.safeParse({
      name: form.name,
      email: form.email,
      password: form.password,
      rollNo: form.rollNo.trim() ? form.rollNo : undefined,
      department: form.department,
      year: form.year ? Number(form.year) : undefined,
    });
    const next: FieldErrors = parsed.success ? {} : toFieldErrors(parsed.error.issues);
    if (!form.name.trim()) next.name = "Enter your full name.";
    if (!form.department) next.department = "Choose your department.";
    if (!form.year) next.year = "Choose your year.";
    if (form.confirm !== form.password) next.confirm = "Passwords don't match.";
    if (!parsed.success || Object.keys(next).length) {
      setErrors(next);
      setFormError("Some fields need attention.");
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await register(parsed.data);
      // The server answers the same way whether or not the email exists, so we never say "account created"
      navigate("/login?registered=1", { replace: true });
    } catch (e) {
      if (isApiError(e) && e.code === "VALIDATION_ERROR") {
        setErrors(toFieldErrors(e.issues ?? []));
        setFormError(e.message);
      } else {
        setFormError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="stack-s">
          <p className="eyebrow">Students</p>
          <h1>Create your account</h1>
          <p className="muted">Faculty and staff accounts are created by an admin.</p>
        </div>
        <FormError message={formError} />
        <form
          className="form-grid"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Full name" error={errors.name}>
            {(a) => <input {...a} className="input" autoComplete="name" value={form.name} onChange={set("name")} />}
          </Field>
          <Field label="College email" hint="Use your @iem.edu.in address." error={errors.email}>
            {(a) => <input {...a} className="input" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} />}
          </Field>
          <Field label="Roll number" optional error={errors.rollNo}>
            {(a) => <input {...a} className="input" autoComplete="off" value={form.rollNo} onChange={set("rollNo")} />}
          </Field>
          <div className="form-grid form-grid-2">
            <Field label="Department" error={errors.department}>
              {(a) => (
                <select {...a} className="select" value={form.department} onChange={set("department")}>
                  <option value="">Choose…</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Year" error={errors.year}>
              {(a) => (
                <select {...a} className="select" value={form.year} onChange={set("year")}>
                  <option value="">Choose…</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Password" hint={`At least ${LIMITS.passwordMin} characters. A short sentence works well.`} error={errors.password}>
            {(a) => (
              <div className="input-wrap">
                <input
                  {...a}
                  className="input"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={form.password}
                  onChange={set("password")}
                />
                <button
                  type="button"
                  className="icon-btn trail-btn"
                  aria-pressed={show}
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow((v) => !v)}
                >
                  <Icon name={show ? "eyeOff" : "eye"} />
                </button>
              </div>
            )}
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            {(a) => (
              <input {...a} className="input" type={show ? "text" : "password"} autoComplete="new-password" spellCheck={false} value={form.confirm} onChange={set("confirm")} />
            )}
          </Field>
          <button type="submit" className="btn btn-dark btn-block" disabled={pending} aria-busy={pending || undefined}>
            {pending ? <span className="spinner" aria-hidden /> : null}
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
