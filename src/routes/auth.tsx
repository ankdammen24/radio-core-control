import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioCoreLogo } from "@/components/radio-core-logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) nav({ to: "/" });
  }, [loading, session, nav]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Welcome back");
  };
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { display_name: displayName } },
    });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Account created — you can sign in.");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-sidebar-primary flex items-center justify-center">
            <Radio className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">RADIO CORE</div>
            <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Broadcast Operations</div>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">The control plane for modern radio.</h2>
          <p className="text-sidebar-foreground/70 max-w-md">Manage stations, media, metadata, playlists, scheduler and streaming from one professional broadcast operations console.</p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">© Radio Core</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Use your operator account to access Radio Core.</p>
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-5">
              <form onSubmit={signIn} className="space-y-4">
                <div><Label htmlFor="e1">Email</Label><Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="p1">Password</Label><Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-5">
              <form onSubmit={signUp} className="space-y-4">
                <div><Label htmlFor="n2">Display name</Label><Input id="n2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
                <div><Label htmlFor="e2">Email</Label><Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="p2">Password</Label><Input id="p2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
                <p className="text-xs text-muted-foreground">First account becomes admin. Subsequent accounts default to viewer until promoted.</p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
