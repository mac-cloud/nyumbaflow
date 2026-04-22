import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCog, Info } from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
const TOKEN_KEY = "nyumbaflow.access_token";

async function api<T>(path: string): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.json();
}

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

export default function Team() {
  const { data: members, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => api<TeamMember[]>("/users/team"),
  });

  return (
    <div>
      <PageHeader title="Team" description="People with access to this workspace and their roles." />

      <Card className="border-primary/20 bg-primary-soft/40 mb-6">
        <CardContent className="p-4 flex gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Inviting teammates</p>
            <p className="text-muted-foreground">
              Have new teammates sign up at the login page, then assign their role
              via the API ({" "}
              <code className="text-xs">POST /users/&#123;user_id&#125;/roles</code>{" "}
              ).
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !members?.length ? (
        <Card className="border-dashed border-2 bg-gradient-clay/40">
          <CardContent className="p-10 text-center">
            <UserCog className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-display text-xl">No team members yet</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const display = m.full_name || m.email;
            return (
              <Card key={m.id} className="border-border/60 shadow-card">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary-soft text-secondary flex items-center justify-center font-semibold">
                    {display.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{display}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {m.roles.length ? m.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
                      )) : <Badge variant="outline">no role</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
