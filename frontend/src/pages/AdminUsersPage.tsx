import type { UserDTO } from "@scc/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { listUsers, setUserStatus } from "../api/endpoints/account";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import { useAuth } from "../auth/auth-context";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { useToast } from "../components/toast-context";
import { EmptyState, ErrorState, PageHeader } from "../components/ui";
import { ROLE_LABEL } from "../lib/format";
import { useDebounced } from "../lib/use-debounced";
import { useDocumentTitle } from "../lib/use-document-title";

const STATUS_CHIP: Record<string, string> = {
  active: "chip chip-success",
  suspended: "chip chip-danger",
  pending: "chip chip-warning",
  deleted: "chip",
};

export function AdminUsersPage() {
  useDocumentTitle("Manage users");
  const { state } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = params.get("status") ?? "";
  const debouncedQ = useDebounced(q.trim(), 300);
  const filters = { q: debouncedQ || undefined, status: status || undefined };
  const query = useQuery({ queryKey: [...keys.users, filters], queryFn: ({ signal }) => listUsers(filters, signal), staleTime: 0 });

  const [target, setTarget] = useState<UserDTO | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const suspending = target?.status !== "suspended";
  const meId = state.status === "authenticated" ? state.user.id : "";

  async function apply() {
    if (!target) return;
    if (suspending && reason.trim().length < 3) {
      setReasonError("Give a short reason (kept in the audit log).");
      return;
    }
    setPending(true);
    try {
      await setUserStatus(target.id, suspending ? "suspended" : "active", reason.trim());
      await qc.invalidateQueries({ queryKey: keys.users });
      toast.show(suspending ? `${target.name} is suspended and signed out` : `${target.name} is active again`);
      setTarget(null);
    } catch (e) {
      toast.show(isApiError(e) ? e.message : "Couldn't change the status.", "error");
    } finally {
      setPending(false);
    }
  }

  const items = query.data?.items ?? [];

  return (
    <div className="page container">
      <PageHeader title="Manage users" lead="Suspending someone signs them out on their next request. Every change is recorded." />
      <div className="filters">
        <div className="input-wrap">
          <Icon name="search" className="lead-icon" />
          <label htmlFor="u-q" className="sr-only">Search users</label>
          <input id="u-q" className="input has-icon" type="search" placeholder="Search by name, email or roll no." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="pill-group" role="group" aria-label="Status">
          {["", "active", "suspended"].map((s) => (
            <button key={s} type="button" className="pill" aria-pressed={status === s} onClick={() => setParams(s ? { status: s } : {}, { replace: true })}>
              {s ? s[0]!.toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <div className="skeleton" style={{ height: 280 }} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="users" title="No users match" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Department</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name"><span><strong>{u.name}</strong><span className="muted">{u.email}</span></span></td>
                  <td data-label="Role">{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td data-label="Department">{u.department}{u.year ? `, Year ${u.year}` : ""}</td>
                  <td data-label="Status"><span className={STATUS_CHIP[u.status] ?? "chip"}>{u.status}</span></td>
                  <td data-label="">
                    {u.id === meId ? (
                      <span className="small muted">You</span>
                    ) : (
                      <button
                        type="button"
                        className={u.status === "suspended" ? "btn btn-sm" : "btn btn-sm btn-danger"}
                        onClick={() => { setTarget(u); setReason(""); setReasonError(undefined); }}
                      >
                        {u.status === "suspended" ? "Reactivate" : "Suspend"}
                        <span className="sr-only"> {u.name}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={target !== null}
        title={suspending ? `Suspend ${target?.name ?? ""}?` : `Reactivate ${target?.name ?? ""}?`}
        confirmLabel={suspending ? "Suspend user" : "Reactivate user"}
        danger={suspending}
        pending={pending}
        onConfirm={() => void apply()}
        onCancel={() => setTarget(null)}
      >
        {suspending ? (
          <>
            <p>They will be signed out and can't log in until reactivated.</p>
            <Field label="Reason" error={reasonError}>
              {(a) => <input {...a} className="input" value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          </>
        ) : (
          <p>They will be able to log in again.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
