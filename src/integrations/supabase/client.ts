/**
 * Drop-in Supabase-compatible client backed by the FastAPI Backend.
 *
 * This shim implements the small subset of supabase-js v2 used by the
 * NyumbaFlow frontend, so existing page code keeps working unchanged:
 *
 *   supabase.from("table").select(...).eq(...).order(...).single()
 *   supabase.from("table").insert(...) / .update(...).eq(...) / .delete().eq(...)
 *   supabase.auth.signUp / signInWithPassword / signOut / getSession / getUser
 *   supabase.auth.onAuthStateChange
 *
 * Configure VITE_API_BASE_URL (defaults to http://localhost:8000).
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
const TOKEN_KEY = "nyumbaflow.access_token";
const USER_KEY = "nyumbaflow.user";

type AuthChangeCb = (event: string, session: SessionLike | null) => void;
const listeners = new Set<AuthChangeCb>();

interface SessionLike {
  access_token: string;
  user: { id: string; email: string };
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token: string | null, user: SessionLike["user"] | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
  const session = token && user ? { access_token: token, user } : null;
  listeners.forEach((cb) => cb(token ? "SIGNED_IN" : "SIGNED_OUT", session));
}

function getCachedUser(): SessionLike["user"] | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.detail || body?.message || res.statusText;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return body as T;
}

// ============================================================
// Query builder mimicking supabase-js .from(table).select()...
// ============================================================
class QueryBuilder<T = any> {
  private table: string;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: any = null;
  private filters: Record<string, string> = {};
  private wantExpand = false;
  private wantSingle = false;
  private orderBy: { col: string; asc: boolean } | null = null;
  private headFlag = false;
  private countFlag = false;

  constructor(table: string) {
    this.table = table;
  }

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    this.op = "select";
    if (cols && /[a-z_]+\s*\(/i.test(cols)) this.wantExpand = true;
    if (opts?.head) this.headFlag = true;
    if (opts?.count) this.countFlag = true;
    return this;
  }

  insert(values: any) {
    this.op = "insert";
    this.payload = Array.isArray(values) ? values[0] : values;
    return this;
  }

  update(values: any) {
    this.op = "update";
    this.payload = values;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(col: string, val: any) {
    this.filters[col] = String(val);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters[col] = vals.join(",");
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending !== false };
    return this;
  }

  limit(_n: number) { return this; }

  single() {
    this.wantSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantSingle = true;
    return this;
  }

  // Make awaitable
  then<TResult1 = any>(
    onFulfilled?: (value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>,
  ): Promise<TResult1> {
    return this.execute().then(onFulfilled as any);
  }

  catch(cb: any) { return this.execute().catch(cb); }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      // Single by id  -> GET /{table}/{id}
      if (this.op === "select" && this.wantSingle && this.filters.id) {
        const data = await http<any>(`/${this.table}/${this.filters.id}`);
        return { data, error: null };
      }

      // Build query string for collection ops
      const params = new URLSearchParams();
      Object.entries(this.filters).forEach(([k, v]) => params.set(k, v));
      if (this.wantExpand) params.set("expand", "true");
      const qs = params.toString();

      if (this.op === "select") {
        if (this.headFlag && this.countFlag) {
          // Count-only – fetch list and report length (acceptable scale)
          const data = await http<any[]>(`/${this.table}/${qs ? `?${qs}` : ""}`);
          return { data: null, error: null, count: data.length };
        }
        let data = await http<any[]>(`/${this.table}/${qs ? `?${qs}` : ""}`);
        if (this.orderBy) {
          const { col, asc } = this.orderBy;
          data = [...data].sort((a, b) => {
            const av = a?.[col]; const bv = b?.[col];
            if (av === bv) return 0;
            return (av > bv ? 1 : -1) * (asc ? 1 : -1);
          });
        }
        if (this.wantSingle) return { data: data[0] ?? null, error: null };
        return { data, error: null };
      }

      if (this.op === "insert") {
        const data = await http<any>(`/${this.table}/`, {
          method: "POST",
          body: JSON.stringify(this.payload),
        });
        return { data, error: null };
      }

      if (this.op === "update") {
        if (!this.filters.id) throw new Error("update requires .eq('id', ...)");
        const data = await http<any>(`/${this.table}/${this.filters.id}`, {
          method: "PATCH",
          body: JSON.stringify(this.payload),
        });
        return { data, error: null };
      }

      if (this.op === "delete") {
        if (!this.filters.id) throw new Error("delete requires .eq('id', ...)");
        await http<void>(`/${this.table}/${this.filters.id}`, { method: "DELETE" });
        return { data: null, error: null };
      }

      return { data: null, error: new Error("Unsupported operation") };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || String(err) } };
    }
  }
}

// ============================================================
// Auth API mimicking supabase.auth
// ============================================================
const auth = {
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, any> } }) {
    try {
      const tok = await http<{ access_token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          full_name: options?.data?.full_name ?? "",
          phone: options?.data?.phone ?? null,
          business_name: options?.data?.business_name ?? null,
        }),
      });
      // Fetch user details
      localStorage.setItem(TOKEN_KEY, tok.access_token);
      const me = await http<any>("/auth/me");
      const user = { id: me.id, email: me.email };
      setSession(tok.access_token, user);
      return { data: { user, session: { access_token: tok.access_token, user } }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err.message } };
    }
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const tok = await http<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, tok.access_token);
      const me = await http<any>("/auth/me");
      const user = { id: me.id, email: me.email };
      setSession(tok.access_token, user);
      return { data: { user, session: { access_token: tok.access_token, user } }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err.message } };
    }
  },

  async signOut() {
    setSession(null, null);
    return { error: null };
  },

  async getSession() {
    const token = getToken();
    const user = getCachedUser();
    return {
      data: { session: token && user ? { access_token: token, user } : null },
      error: null,
    };
  },

  async getUser() {
    const user = getCachedUser();
    return { data: { user }, error: null };
  },

  onAuthStateChange(cb: AuthChangeCb) {
    listeners.add(cb);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(cb),
        },
      },
    };
  },
};

// ============================================================
// Public client
// ============================================================
export const supabase = {
  from<T = any>(table: string) {
    return new QueryBuilder<T>(table);
  },
  auth,
};

export type { SessionLike };
