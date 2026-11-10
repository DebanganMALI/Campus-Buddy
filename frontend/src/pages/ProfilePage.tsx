import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LIMITS } from "@scc/shared";
import { getProfile, updateProfile } from "../api/endpoints/account";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import { useAuth } from "../auth/auth-context";
import { Field, FormError } from "../components/Field";
import { Icon } from "../components/Icon";
import { useToast } from "../components/toast-context";
import { ErrorState, PageHeader } from "../components/ui";
import { formatDate, initials, ROLE_LABEL } from "../lib/format";
import { toFieldErrors, type FieldErrors } from "../lib/form-errors";
import { useDocumentTitle } from "../lib/use-document-title";

/** Own profile only: the endpoint has no user id, so editing someone else is impossible by design. */
export function ProfilePage() {
  useDocumentTitle("Profile");
  const { refetchMe } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: keys.profile, queryFn: ({ signal }) => getProfile(signal) });
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", bio: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (query.data) setF({ name: query.data.name, phone: query.data.phone ?? "", bio: query.data.bio ?? "" });
  }, [query.data]);

  async function save() {
    const e: FieldErrors = {};
    if (f.name.trim().length < LIMITS.nameMin) e.name = "Enter your name.";
    if (f.bio.length > 300) e.bio = "Keep your bio under 300 characters.";
    if (f.phone && !/^\+?[0-9 -]{8,16}$/.test(f.phone.trim())) e.phone = "Enter a valid phone number.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setPending(true);
    setFormError(null);
    try {
      await updateProfile({ name: f.name.trim(), phone: f.phone.trim(), bio: f.bio.trim() });
      await qc.invalidateQueries({ queryKey: keys.profile });
      await refetchMe(); // the header shows the name too
      toast.show("Profile updated");
      setEditing(false);
    } catch (err) {
      if (isApiError(err) && err.code === "VALIDATION_ERROR") setErrors(toFieldErrors(err.issues ?? []));
      setFormError(isApiError(err) ? err.message : "Couldn't save.");
    } finally {
      setPending(false);
    }
  }

  if (query.isPending) return <div className="container page"><div className="skeleton" style={{ height: 320, marginTop: 40 }} /></div>;
  if (query.isError) return <div className="container section"><ErrorState error={query.error} onRetry={() => void query.refetch()} /></div>;
  const p = query.data;

  return (
    <div className="page container">
      <PageHeader title="Your profile" />
      <div className="split">
        <section className="card stack" aria-labelledby="about-h">
          <div className="row">
            <span className="avatar" style={{ width: 64, height: 64, fontSize: "1.25rem" }} aria-hidden>{initials(p.name)}</span>
            <div>
              <h2 id="about-h">{p.name}</h2>
              <p className="muted small">{p.email}</p>
            </div>
          </div>

          {editing ? (
            <form className="form-grid" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
              <FormError message={formError} />
              <Field label="Name" error={errors.name}>
                {(a) => <input {...a} className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
              </Field>
              <Field label="Phone" optional error={errors.phone}>
                {(a) => <input {...a} className="input" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}
              </Field>
              <Field label="Bio" optional hint={`${f.bio.length}/300`} error={errors.bio}>
                {(a) => <textarea {...a} className="textarea" style={{ minHeight: 120 }} maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />}
              </Field>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setErrors({}); setFormError(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
              </div>
            </form>
          ) : (
            <>
              <dl className="meta-list">
                <div><dt>Phone</dt><dd>{p.phone || "—"}</dd></div>
                <div><dt>Bio</dt><dd>{p.bio || "—"}</dd></div>
              </dl>
              <div>
                <button type="button" className="btn" onClick={() => setEditing(true)}>
                  <Icon name="edit" size={16} /> Edit profile
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="card stack" aria-labelledby="college-h">
          <h3 id="college-h" className="row"><Icon name="lock" size={18} /> College record</h3>
          <p className="small muted">Set by the college. Ask an admin if something is wrong.</p>
          <dl className="meta-list">
            <div><dt>Role</dt><dd>{ROLE_LABEL[p.role] ?? p.role}</dd></div>
            <div><dt>Department</dt><dd>{p.department}</dd></div>
            {p.year && <div><dt>Year</dt><dd>{p.year}</dd></div>}
            {p.rollNo && <div><dt>Roll no.</dt><dd>{p.rollNo}</dd></div>}
            <div><dt>Member since</dt><dd>{formatDate(p.createdAt)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
