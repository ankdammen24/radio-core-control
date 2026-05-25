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
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ssoEmail, setSsoEmail] = useState("");
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

  const signInWithGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) toast.error(result.error.message || "Google sign-in failed");
    if (result.redirected) return;
    toast.success("Welcome back");
  };
  const signInWithApple = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) toast.error(result.error.message || "Apple sign-in failed");
    if (result.redirected) return;
    toast.success("Welcome back");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground relative overflow-hidden">
        <div className="grid-overlay absolute inset-0 opacity-50 pointer-events-none" />
        <div className="relative">
          <RadioCoreLogo size="lg" tone="brand" />
        </div>
        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3 py-1 text-[10px] uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-onair onair-pulse" />
            Broadcast Control Plane
          </div>
          <h2 className="text-3xl font-semibold tracking-tight max-w-md leading-tight">
            The control plane for modern radio.
          </h2>
          <p className="text-sidebar-foreground/70 max-w-md">
            Manage stations, media, metadata, playlists, scheduler and streaming from one
            professional broadcast operations console.
          </p>
        </div>
        <div className="relative text-xs text-sidebar-foreground/50">© Radio Core · White-label runtime</div>
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
            <TabsContent value="signin" className="mt-5 space-y-4">
              <form onSubmit={signIn} className="space-y-4">
                <div><Label htmlFor="e1">Email</Label><Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="p1">Password</Label><Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
              </form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or</span></div>
              </div>
              <Button variant="outline" className="w-full" disabled={busy} onClick={signInWithGoogle}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </Button>
              <Button variant="outline" className="w-full" disabled={busy} onClick={signInWithApple}>
                <svg className="mr-2 h-4 w-4" viewBox="0 1 24 24" fill="currentColor"><path d="M17.05 20.28c-.98 1.44-2.2 2.84-3.96 2.86-1.74.02-2.3-1.02-4.28-1.02-1.96 1.02-2.66 1-4.28 1.02-1.76.02-3.12-1.4-4.1-2.84-3.4-4.9-2.9-12.18 2.46-14.76 1.18-.62 2.5-.96 3.88-.96 1.78 1.02 2.68 1.02 4.46 1.02 1.78 1.02 2.68 1.02 4.46 1.02 1.38 0 2.72-.34 3.88-.96 4.54 7.82-.48 14.76 2.48 14.78-1.78 0-2.68 0-4.46 1.02zM16.36 6.06c.92-1.1 1.54-2.58 1.38-4.08-1.34.06-2.96.88-3.92 1.98-.84.96-1.56 2.52-1.36 3.98 1.44.1 2.92-.72 3.9-1.88z"/></svg>
                Sign in with Apple
              </Button>
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
