import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Trash2, Upload, Play, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { processRecording, blobToBase64 } from "@/lib/audio-processor";

export const Route = createFileRoute("/voicetracks")({ component: VoicetracksPage });

type Phase = "idle" | "recording" | "processing" | "uploading";

function VoicetracksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: stations } = useQuery({
    queryKey: ["vt-stations"],
    queryFn: async () => (await supabase.from("stations").select("id,name").eq("is_active", true)).data ?? [],
  });
  const { data: presenters } = useQuery({
    queryKey: ["vt-presenters"],
    queryFn: async () => (await supabase.from("presenters").select("id,name").eq("is_active", true)).data ?? [],
  });
  const list = useQuery({
    queryKey: ["voicetracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voicetracks")
        .select("*, stations(name), presenters(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [stationId, setStationId] = useState<string>("");
  const [presenterId, setPresenterId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stationId && stations?.[0]?.id) setStationId(stations[0].id);
  }, [stations, stationId]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const reset = () => {
    setProcessedBlob(null);
    setDuration(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsed(0);
    chunksRef.current = [];
  };

  const startRecording = async () => {
    if (!stationId) { toast.error("Välj station först"); return; }
    try {
      reset();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        setPhase("processing");
        try {
          const raw = new Blob(chunksRef.current, { type: mime });
          const result = await processRecording(raw);
          setProcessedBlob(result.mp3Blob);
          setDuration(result.durationSeconds);
          setPreviewUrl(URL.createObjectURL(result.mp3Blob));
          toast.success(`Bearbetad: ${result.durationSeconds.toFixed(1)}s, ${result.rmsDbBefore.toFixed(1)}→${result.rmsDbAfter.toFixed(1)} dBFS`);
        } catch (err: any) {
          toast.error(`Bearbetning misslyckades: ${err.message}`);
        } finally {
          setPhase("idle");
        }
      };
      rec.start();
      recorderRef.current = rec;
      setPhase("recording");
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 200);
    } catch (e: any) {
      toast.error(`Mikrofon nekad: ${e.message}`);
      setPhase("idle");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!processedBlob || !stationId || !title.trim()) throw new Error("Titel, station och inspelning krävs");
      setPhase("uploading");
      const { data: vt, error } = await supabase.from("voicetracks").insert({
        station_id: stationId,
        title: title.trim(),
        description: description.trim() || null,
        presenter_id: presenterId || null,
        duration_seconds: duration,
        status: "processing",
        recorded_by: user?.id ?? null,
      }).select().single();
      if (error) throw error;

      const base64 = await blobToBase64(processedBlob);
      const safeTitle = title.trim().replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 60);
      const filename = `${Date.now()}-${safeTitle || "voicetrack"}.mp3`;

      const { data, error: fnErr } = await supabase.functions.invoke("azuracast-upload-voicetrack", {
        body: { voicetrack_id: vt.id, filename, mime: "audio/mpeg", base64 },
      });
      if (fnErr) throw fnErr;
      if (!data?.ok) throw new Error(data?.message ?? "Upload misslyckades");
      return vt;
    },
    onSuccess: () => {
      toast.success("Voicetrack uppladdad till AzuraCast");
      reset();
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["voicetracks"] });
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setPhase("idle"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voicetracks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Borttagen"); qc.invalidateQueries({ queryKey: ["voicetracks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const isBusy = phase !== "idle";
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <AppLayout title="Voicetracks" description="Spela in voicetracks i webbläsaren. Bearbetas och pushas till AzuraCast.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-lg">Ny inspelning</h2>

          <div className="grid gap-3">
            <div>
              <Label>Station *</Label>
              <Select value={stationId} onValueChange={setStationId} disabled={isBusy}>
                <SelectTrigger><SelectValue placeholder="Välj station" /></SelectTrigger>
                <SelectContent>
                  {stations?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Presentatör</Label>
              <Select value={presenterId} onValueChange={setPresenterId} disabled={isBusy}>
                <SelectTrigger><SelectValue placeholder="(valfri)" /></SelectTrigger>
                <SelectContent>
                  {presenters?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Titel *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="t.ex. Veckans tip" disabled={isBusy} />
            </div>
            <div>
              <Label>Beskrivning</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={isBusy} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {phase === "recording" ? (
              <Button onClick={stopRecording} variant="destructive"><Square className="h-4 w-4 mr-2" />Stoppa ({mm(elapsed)})</Button>
            ) : (
              <Button onClick={startRecording} disabled={isBusy || !stationId}>
                <Mic className="h-4 w-4 mr-2" />Spela in
              </Button>
            )}
            {phase === "processing" && <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Bearbetar…</Badge>}
            {phase === "uploading" && <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Laddar upp…</Badge>}
          </div>

          {previewUrl && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Förhandsgranskning {duration && `(${duration.toFixed(1)}s)`}</Label>
              <audio src={previewUrl} controls className="w-full" />
              <div className="flex gap-2">
                <Button onClick={() => upload.mutate()} disabled={isBusy || !title.trim()}>
                  <Upload className="h-4 w-4 mr-2" />Ladda upp till AzuraCast
                </Button>
                <Button variant="ghost" onClick={reset} disabled={isBusy}><Trash2 className="h-4 w-4 mr-2" />Kasta</Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-semibold text-lg">Senaste voicetracks</h2>
          {list.isLoading && <div className="text-sm text-muted-foreground">Laddar…</div>}
          {list.data?.length === 0 && <div className="text-sm text-muted-foreground">Inga inspelningar ännu.</div>}
          <div className="divide-y">
            {list.data?.map((v: any) => (
              <div key={v.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{v.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.stations?.name} · {v.presenters?.name ?? "—"} · {v.duration_seconds ? `${Number(v.duration_seconds).toFixed(1)}s` : "—"}
                  </div>
                  {v.error_message && <div className="text-xs text-destructive mt-1">{v.error_message}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={v.status === "ready" ? "default" : v.status === "error" ? "destructive" : "secondary"}>{v.status}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(v.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
