# Contract gaps (frontend → backend)

AGENTS.md §5.7–5.8 lists these endpoints but does not define every shape.
The frontend and its mocks use the **proposed** shapes below. Please confirm or change them
in a `contract/...` PR (all four members approve), then we update `src/api/types.ts`.

| # | Endpoint | Gap | Proposed shape (used by the frontend now) |
|---|---|---|---|
| 1 | `GET /api/bookmarks` | Item shape not defined | `{ items: [{ itemType, itemId, createdAt, item: <DTO> }], nextCursor }` |
| 2 | `GET /api/profile` | Response not defined | `UserDTO` + `phone?`, `bio?` |
| 3 | `PATCH /api/profile` | Defined: `{ name?, phone?, bio? }` | Unknown fields → `400 VALIDATION_ERROR` |
| 4 | `POST/PATCH /api/announcements` | Body not defined | `{ title, body, audience, status: "draft"\|"published", pinned, expiresAt? }` |
| 5 | `POST/PATCH /api/events` | Body not defined | `{ title, description, venue, startsAt, endsAt, capacity?, audience, status }` |
| 6 | Content DTOs | Only auth/user schemas exist in `shared/` | Copy `src/api/types.ts` into `shared/src/schemas/*.ts` as Zod schemas |
| 7 | `GET /api/events` | No upcoming/past filter | Frontend splits by `endsAt` on the client |
| 8 | `GET /api/resources` | No list of subjects | Frontend builds the subject list from the results at that level |

Server rules the frontend relies on (must be enforced by the backend, not only the UI):
- Every create/update/delete checks permissions from `shared/permissions.ts` → `403 FORBIDDEN`.
- Content outside a student's department/year → `404 NOT_FOUND` (never reveal it exists).
- Suspended user → next request `401 SESSION_REVOKED`; login with correct password → `403 ACCOUNT_SUSPENDED`.
- `POST /api/auth/register` → always the same `202` message (no account enumeration).
