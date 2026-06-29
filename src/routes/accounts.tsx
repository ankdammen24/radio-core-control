import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "@/services/database";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-states";
import { Plus, Trash2, Building2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { accountSchema, formatZodError } from "@/lib/validation";

export const Route = createFileRoute("/accounts")({ component: AccountsPage });

function AccountsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "broadcaster", contact_email: "", notes: "" });

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await database.from("accounts").select("*, stations(id)").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = accountSchema.safeParse(form);
      if (!parsed.success) { const m = formatZodError(parsed.error); setErrs(m); throw new Error(m); }
      setErrs(null);
      const { error } = await database.from("accounts").insert(parsed.data);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Account created"); setOpen(false); setForm({ name:"", type:"broadcaster", contact_email:"", notes:"" }); qc.invalidateQueries({ queryKey:["accounts"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await database.from("accounts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey:["accounts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout title="Accounts" description="Customer and brand accounts that own stations." actions={
      isEditor && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />New Account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Type</Label><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></div>
              <div><Label>Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              {errs && <p className="text-xs text-destructive">{errs}</p>}
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }>
      {accounts.error && <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />}
      {!accounts.error && (
        <Card className="overflow-hidden">
          {accounts.isLoading ? <LoadingRows cols={5} /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead>Stations</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
              <TableBody>
                {accounts.data?.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.type ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.contact_email ?? "—"}</TableCell>
                    <TableCell>{a.stations?.length ?? 0}</TableCell>
                    <TableCell>
                      {isAdmin && (
                        <ConfirmDialog
                          title={`Delete "${a.name}"?`}
                          description="This will fail if stations still reference this account."
                          confirmText="Delete" destructive
                          onConfirm={() => del.mutateAsync(a.id)}
                          trigger={<Button variant="ghost" size="icon"><Trash2 className="w-4 h-4" /></Button>}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!accounts.isLoading && !accounts.data?.length && (
            <div className="p-6"><EmptyState icon={Building2} title="No accounts yet" description="Add your first broadcaster or client account." /></div>
          )}
        </Card>
      )}
    </AppLayout>
  );
}
