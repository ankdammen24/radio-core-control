import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({ component: UsersPage });

function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin"|"editor"|"viewer" }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["users-with-roles"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleActive = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users-with-roles"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Users & Roles" description="Manage operators, assign roles and activation status.">
      {!isAdmin && <Card className="p-4 mb-4 border-warning/40 bg-warning/10 text-sm">You are not an administrator. Role and activation changes are disabled.</Card>}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
              <TableHead>Active</TableHead><TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.display_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Select value={u.roles[0] ?? "viewer"} disabled={!isAdmin} onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as any })}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Switch checked={u.is_active} disabled={!isAdmin} onCheckedChange={(v) => toggleActive.mutate({ id: u.id, val: v })} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {!isLoading && !data?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground mt-4">New accounts default to <Badge variant="outline">viewer</Badge>. The first signup automatically becomes admin.</p>
    </AppLayout>
  );
}
