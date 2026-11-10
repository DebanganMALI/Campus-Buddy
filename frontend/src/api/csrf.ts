// The CSRF token lives in memory only, never in localStorage (AGENTS.md §6)
let token: string | null = null;

export const csrf = {
  get: () => token,
  set: (t: string) => {
    token = t;
  },
  clear: () => {
    token = null;
  },
};
