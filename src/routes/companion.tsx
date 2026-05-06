// Public-facing companion page: live now-playing, EPG, song request + studio chat.
// No auth required. Anon writes are allowed by RLS for song_requests + studio_messages.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio, Music2, MessageSquare, Activity } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/companion")({ component: CompanionPage });

function CompanionPage() {
  const qc = useQueryClient();
  const stations = useQuery({ queryKey: ["pub-stations"], queryFn: async () => (await supabase.from("stations").select("id,name,slug").eq("is_active", true).order("name")).data ?? [] });
  const np = useQuery({
    queryKey: ["pub-now"], refetchInterval: 8_000,
    queryFn: async () => (await supabase.from("now_playing").select("*, stations(name,slug)")).data ?? [],
  });
  const upcoming = useQuery({
    queryKey: ["pub-upcoming"], refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("episodes").select("*, shows(name,color,stations(name))").gte("scheduled_end", new Date().toISOString()).order("scheduled_start").limit(10)).data ?? [],
  });

  const [req, setReq] = useState({ station_id: "", requester_name: "", track_text: "", message: "" });
  const sendRequest = useMutation({
    mutationFn: async () => {
      if (!req.station_id || !req.track_text) throw new Error("Station + track required");
      const { error } = await supabase.from("song_requests").insert(req);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tack! Önskning skickad till studion."); setReq({ station_id: req.station_id, requester_name: "", track_text: "", message: "" }); qc.invalidateQueries({ queryKey: ["pub-requests-mine"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [msg, setMsg] = useState({ station_id: "", from_name: "", body: "" });
  const sendMsg = useMutation({
    mutationFn: async () => {
      if (!msg.station_id || !msg.body) throw new Error("Station + message required");
      const { error } = await supabase.from("studio_messages").insert({ ...msg, kind: "chat" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Skickat till studion."); setMsg({ station_id: msg.station_id, from_name: "", body: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary flex items-center justify-center"><Radio className="w-5 h-5 text-primary-foreground" /></div>
          <div>
            <div className="font-semibold tracking-tight">Radio Companion</div>
            <div className="text-xs text-muted-foreground">Live nu · programguide · interaktion</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 md:col-span-2">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> Live nu</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(np.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">Ingen sändning hittas just nu.</div>}
            {(np.data ?? []).map((n: any) => (
              <div key={n.station_id} className="border border-border rounded-lg p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{n.stations?.name}</div>
                <div className="font-semibold text-lg mt-1">{n.title ?? "—"}</div>
                <div className="text-sm text-muted-foreground">{n.artist ?? ""}</div>
                <div className="text-xs text-muted-foreground mt-2">{n.listeners ?? 0} lyssnare</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Programguide</h2>
          <ul className="space-y-2 text-sm">
            {(upcoming.data ?? []).map((e: any) => (
              <li key={e.id} className="flex items-center gap-3 border-l-4 pl-3 py-1" style={{ borderColor: e.shows?.color ?? "#3b82f6" }}>
                <div className="text-xs text-muted-foreground w-24">{new Date(e.scheduled_start).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</div>
                <div>
                  <div className="font-medium">{e.shows?.name}</div>
                  <div className="text-xs text-muted-foreground">{e.shows?.stations?.name}</div>
                </div>
              </li>
            ))}
            {(upcoming.data ?? []).length === 0 && <li className="text-muted-foreground">Inget planerat just nu.</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Music2 className="w-4 h-4" /> Önska en låt</h2>
          <div className="space-y-2">
            <Select value={req.station_id} onValueChange={(v) => setReq({ ...req, station_id: v })}>
              <SelectTrigger><SelectValue placeholder="Välj station" /></SelectTrigger>
              <SelectContent>{(stations.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Ditt namn (valfritt)" value={req.requester_name} onChange={(e) => setReq({ ...req, requester_name: e.target.value })} />
            <Input placeholder="Artist – Låt" value={req.track_text} onChange={(e) => setReq({ ...req, track_text: e.target.value })} />
            <Textarea placeholder="Hälsning till studion (valfritt)" value={req.message} onChange={(e) => setReq({ ...req, message: e.target.value })} />
            <Button className="w-full" onClick={() => sendRequest.mutate()}>Skicka önskning</Button>
          </div>
        </Card>

        <Card className="p-5 md:col-span-2">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Skriv till studion</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select value={msg.station_id} onValueChange={(v) => setMsg({ ...msg, station_id: v })}>
              <SelectTrigger><SelectValue placeholder="Station" /></SelectTrigger>
              <SelectContent>{(stations.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Ditt namn" value={msg.from_name} onChange={(e) => setMsg({ ...msg, from_name: e.target.value })} />
            <Button onClick={() => sendMsg.mutate()}>Skicka</Button>
            <Textarea className="md:col-span-3" placeholder="Ditt meddelande" value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} />
          </div>
        </Card>
      </main>

      <footer className="text-center text-xs text-muted-foreground py-6">Powered by Radio Core</footer>
    </div>
  );
}
