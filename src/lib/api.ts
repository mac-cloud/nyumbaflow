/**
 * FastAPI client for the NyumbaFlow Backend.
 *
 * Configure the base URL via VITE_API_BASE_URL in your .env file.
 * Defaults to http://localhost:8000 for local development.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Json = Record<string, unknown>;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- Properties ----------
export const propertiesApi = {
  list: () => request<any[]>("/properties/"),
  get: (id: string) => request<any>(`/properties/${id}`),
  create: (data: Json) =>
    request<any>("/properties/", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<void>(`/properties/${id}`, { method: "DELETE" }),
};

// ---------- Units ----------
export const unitsApi = {
  list: (propertyId?: string) =>
    request<any[]>(`/units/${propertyId ? `?property_id=${propertyId}` : ""}`),
  create: (data: Json) =>
    request<any>("/units/", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<void>(`/units/${id}`, { method: "DELETE" }),
};

// ---------- Tenants ----------
export const tenantsApi = {
  list: () => request<any[]>("/tenants/"),
  get: (id: string) => request<any>(`/tenants/${id}`),
  create: (data: Json) =>
    request<any>("/tenants/", { method: "POST", body: JSON.stringify(data) }),
};

// ---------- Leases ----------
export const leasesApi = {
  list: () => request<any[]>("/leases/"),
  create: (data: Json) =>
    request<any>("/leases/", { method: "POST", body: JSON.stringify(data) }),
  end: (id: string) =>
    request<any>(`/leases/${id}/end`, { method: "POST" }),
};

// ---------- Payments ----------
export const paymentsApi = {
  list: (leaseId?: string) =>
    request<any[]>(`/payments/${leaseId ? `?lease_id=${leaseId}` : ""}`),
  create: (data: Json) =>
    request<any>("/payments/", { method: "POST", body: JSON.stringify(data) }),
  totalCollected: () =>
    request<{ total_collected: number }>("/payments/summary/total"),
};

export const api = {
  properties: propertiesApi,
  units: unitsApi,
  tenants: tenantsApi,
  leases: leasesApi,
  payments: paymentsApi,
};
