import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
const TOKEN_KEY = "nyumbaflow.access_token";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export default function Settings() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", business_name: "" });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => api<any>("/users/me/profile"),
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        business_name: profile.business_name ?? "",
      });
    }
  }, [profile]);

  const updateMut = useMutation({
    mutationFn: () =>
      api<any>("/users/me/profile", { method: "PATCH", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Settings" description="Your profile and workspace preferences." />

      <Card className="border-border/60 shadow-card max-w-2xl">
        <CardContent className="p-6 space-y-5">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
            <p className="text-sm mt-1">{user?.email}</p>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Roles</Label>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {roles.length ? roles.map((r) => (
                <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
              )) : <span className="text-sm text-muted-foreground">No roles assigned</span>}
            </div>
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business_name">Business name</Label>
              <Input id="business_name" value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
            </div>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              {updateMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
