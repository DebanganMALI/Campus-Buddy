import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { LIMITS } from "@scc/shared";
import { createAnnouncement, getAnnouncement, updateAnnouncement } from "../api/endpoints/content";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import type { AudienceDTO } from "../api/types";
import { useCanChange } from "../auth/use-can-change";
import { AudiencePicker } from "../components/AudiencePicker";
import { Field, FormError } from "../components/Field";
import { ForbiddenState } from "../components/states";
import { useToast } from "../components/toast-context";
import { ErrorState, PageHeader } from "../components/ui";
import { toFieldErrors, type FieldErrors } from "../lib/form-errors";
import { useDocumentTitle } from "../lib/use-document-title";

export function AnnouncementFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? "Edit announcement" : "New announcement");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const existing = useQuery({
    queryKey: [...keys.announcements, "detail", id],
    queryFn: ({ signal }) => getAnnouncement(id!, signal),
    enabled: editing,
  });
  const { canEdit } = useCanChange("announcement", existing.data?.author.id);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AudienceDTO>({ departments: ["ALL"], years: ["ALL"] });
  const [pinned, setPinned] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "draft" | "published">(null);

  useEffect(() => {
    if (!existing.data) return;
    setTitle(existing.data.title);
    setBody(existing.data.body);
    setAudience(existing.data.audience);
    setPinned(existing.data.pinned);
  }, [existing.data]);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (title.trim().length < 3) e.title = "Title needs at least 3 characters.";
    if (title.trim().length > LIMITS.titleMax) e.title = `Keep the title under ${LIMITS.titleMax} characters.`;
    if (!body.trim()) e.body = "Write the announcement.";
    if (body.length > LIMITS.bodyMax) e.body = `Keep it under ${LIMITS.bodyMax.toLocaleString()} characters.`;
    if ((audience.departments as string[]).length === 0) e["audience.departments"] = "Choose at least one department.";
    if ((audience.years as unknown[]).length === 0) e["audience.years"] = "Choose at least one year.";
    return e;
  }

  async function save(status: "draft" | "published") {
    if (pending) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Some fields need attention.");
      return;
    }
    setFormError(null);
    setPending(status);
    const payload = { title: title.trim(), body: body.trim(), audience, pinned, status };
    try {
      const saved = editing ? await updateAnnouncement(id!, payload) : await createAnnouncement(payload);
      await qc.invalidateQueries({ queryKey: keys.announcements });
      toast.show(status === "draft" ? "Draft saved" : editing ? "Announcement updated" : "Announcement published");
      navigate(`/announcements/${saved.id}`, { replace: true });
    } catch (err) {
      if (isApiError(err) && err.code === "VALIDATION_ERROR") setErrors(toFieldErrors(err.issues ?? []));
      setFormError(isApiError(err) ? err.message : "Couldn't save. Please try again.");
    } finally {
      setPending(null);
    }
  }

  if (editing && existing.isPending) return <div className="container page"><div className="skeleton" style={{ height: 400, marginTop: 40 }} /></div>;
  if (editing && existing.isError) return <div className="container section"><ErrorState error={existing.error} /></div>;
  if (editing && existing.data && !canEdit) return <ForbiddenState />;

  return (
    <div className="page container">
      <PageHeader
        title={editing ? "Edit announcement" : "New announcement"}
        lead="Plain text. Line breaks are kept. Students only see posts addressed to their department and year."
      />
      <form
        className="card form-grid"
        style={{ maxWidth: 820 }}
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void save("published");
        }}
      >
        <FormError message={formError} />
        <Field label="Title" error={errors.title} hint={`${title.length}/${LIMITS.titleMax}`}>
          {(a) => <input {...a} className="input" value={title} maxLength={LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Message" error={errors.body}>
          {(a) => <textarea {...a} className="textarea" value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <AudiencePicker
          value={audience}
          onChange={setAudience}
          errors={{ departments: errors["audience.departments"], years: errors["audience.years"] }}
        />
        <label className="check">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to the top of the board
        </label>
        <div className="form-actions">
          <Link to={editing ? `/announcements/${id}` : "/announcements"} className="btn btn-ghost">
            Cancel
          </Link>
          <button type="button" className="btn" disabled={pending !== null} onClick={() => void save("draft")}>
            {pending === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending !== null} aria-busy={pending === "published" || undefined}>
            {pending === "published" ? "Publishing…" : editing ? "Save changes" : "Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}
