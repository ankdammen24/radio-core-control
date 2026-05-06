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
import { EmptyState } from "@/components/data-states";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square, Play, Pause, Trash2, Save, RefreshCw, Radio } from "lucide-react";

export const Route = createFileRoute("/voicetracks")({ component: VoicetracksPage });

type DeviceInfo = { deviceId: string; label: string };

function VoicetracksPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();

  // form
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [stationId, setStationId] = useState<string>("");
  const [prevMediaId, setPrevMediaId] = useState<string>("");
  const [nextMediaId, setNextMediaId] = useState<string>("");

  // audio devices
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [permError, setPermError] = useState<string>("");

  // recording
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const elapsedTimerRef = useRef<number | null>(null);

  const stations = useQuery({
    queryKey: ["stations-min"],
    queryFn: async () => (await supabase.from("stations").select("id,name").order("name")).data ?? [],
  });
  const mediaList = useQuery({
    queryKey: ["media-min"],
    queryFn: async () => (await supabase.from("media_files").select("id,file_name").order("file_name").limit(200)).data ?? [],
  });
  const tracks = useQuery({
    queryKey: ["voicetracks"],
    queryFn: async () => (await supabase.from("voicetracks").select("*, stations(name)").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  // enumerate devices after permission
  async function loadDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter((d) => d.kind === "audioinput").map((d, i) => ({
        deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}`,
      }));
      setDevices(inputs);
      if (!deviceId && inputs[0]) setDeviceId(inputs[0].deviceId);
    } catch (e: any) {
      setPermError(e?.message ?? "Could not enumerate audio devices");
    }
  }

  useEffect(() => {
    loadDevices();
    const handler = () => loadDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestPermission() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setPermError("");
      await loadDevices();
      toast.success("Microphone access granted");
    } catch (e: any) {
      setPermError(e?.message ?? "Microphone permission denied");
    }
  }

  function stopAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    rafRef.current = null;
    elapsedTimerRef.current = null;
    try { mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  async function startRecording() {
    if (!isEditor) return toast.error("Editor or admin role required");
    setBlob(null); setPreviewUrl(""); setElapsed(0); setDuration(0);
    chunksRef.current = [];
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const ac = new AudioContext();
      audioCtxRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setLevel(peak);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setDuration((Date.now() - startedAtRef.current) / 1000);
      };
      rec.start(250);
      startedAtRef.current = Date.now();
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }, 100);
      setIsRecording(true);
    } catch (e: any) {
      setPermError(e?.message ?? "Failed to start recording");
      toast.error(e?.message ?? "Failed to start recording");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setIsRecording(false);
    setLevel(0);
  }

  function discard() {
    setBlob(null); setPreviewUrl(""); setElapsed(0); setDuration(0);
  }

  async function saveVoicetrack() {
    if (!blob) return;
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const ext = (blob.type.includes("webm") ? "webm" : blob.type.split("/")[1] || "webm");
      const path = `${u.user?.id ?? "anon"}/${Date.now()}-${title.replace(/[^a-z0-9-_]+/gi, "_")}.${ext}`;
      const up = await supabase.storage.from("voicetracks").upload(path, blob, {
        contentType: blob.type || "audio/webm", upsert: false,
      });
      if (up.error) throw up.error;
      const { error } = await supabase.from("voicetracks").insert({
        title: title.trim(),
        notes: notes.trim() || null,
        station_id: stationId || null,
        prev_media_id: prevMediaId || null,
        next_media_id: nextMediaId || null,
        storage_path: path,
        mime_type: blob.type || "audio/webm",
        duration_seconds: duration || null,
        file_size: blob.size,
        status: "ready",
      });
      if (error) throw error;
      toast.success("Voicetrack saved");
      setTitle(""); setNotes(""); setBlob(null); setPreviewUrl(""); setElapsed(0); setDuration(0);
      qc.invalidateQueries({ queryKey: ["voicetracks"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const del = useMutation({
    mutationFn: async (row: any) => {
      if (row.storage_path) await supabase.storage.from("voicetracks").remove([row.storage_path]);
      const { error } = await supabase.from("voicetracks").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["voicetracks"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function fmt(s: number) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <AppLayout title="Voicetracks" description="Record DJ voicetracks straight from your computer's microphone.">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><Mic className="w-4 h-4" /> Recorder</h3>
            <Button variant="ghost" size="sm" onClick={loadDevices}><RefreshCw className="w-3 h-3 mr-1" /> Devices</Button>
          </div>

          {permError && (
            <div className="text-xs rounded border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2">
              {permError}
              <Button size="sm" variant="outline" className="ml-2" onClick={requestPermission}>Grant access</Button>
            </div>
          )}
          {!permError && devices.length === 0 && (
            <Button size="sm" variant="outline" onClick={requestPermission}>Enable microphone</Button>
          )}

          <div className="space-y-2">
            <Label>Input device</Label>
            <Select value={deviceId} onValueChange={setDeviceId} disabled={isRecording || devices.length === 0}>
              <SelectTrigger><SelectValue placeholder="Select microphone" /></SelectTrigger>
              <SelectContent>
                {devices.map((d) => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-base">{fmt(elapsed)}</span>
              <Badge variant={isRecording ? "destructive" : "secondary"}>
                {isRecording ? "REC" : blob ? "READY" : "IDLE"}
              </Badge>
            </div>
            <div className="h-3 w-full rounded bg-background overflow-hidden border">
              <div
                className="h-full bg-primary transition-[width] duration-75"
                style={{ width: `${Math.min(100, level * 140)}%` }}
              />
            </div>
            <div className="flex gap-2">
              {!isRecording ? (
                <Button onClick={startRecording} disabled={!isEditor || !!blob}>
                  <Mic className="w-4 h-4 mr-1" /> Record
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="w-4 h-4 mr-1" /> Stop
                </Button>
              )}
              {blob && (
                <Button variant="outline" onClick={discard}>
                  <Trash2 className="w-4 h-4 mr-1" /> Discard
                </Button>
              )}
            </div>
            {previewUrl && (
              <audio src={previewUrl} controls className="w-full mt-2" />
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Voicetrack name" /></div>
            <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Script / notes" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Station</Label>
                <Select value={stationId} onValueChange={setStationId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {(stations.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Input disabled value={blob ? "Ready to save" : "Awaiting recording"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Previous track</Label>
                <Select value={prevMediaId} onValueChange={setPrevMediaId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {(mediaList.data ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.file_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Next track</Label>
                <Select value={nextMediaId} onValueChange={setNextMediaId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {(mediaList.data ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.file_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button onClick={saveVoicetrack} disabled={!blob || !isEditor || saving} className="w-full">
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save voicetrack"}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Radio className="w-4 h-4" /> Recent voicetracks</h3>
            <Badge variant="outline">{tracks.data?.length ?? 0}</Badge>
          </div>
          {tracks.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (tracks.data ?? []).length === 0 ? (
            <EmptyState icon={Mic} title="No voicetracks yet" description="Record your first DJ break with the recorder." />
          ) : (
            <div className="space-y-2">
              {(tracks.data ?? []).map((t: any) => (
                <VoicetrackRow key={t.id} row={t} onDelete={() => del.mutate(t)} canEdit={isEditor} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

function VoicetrackRow({ row, onDelete, canEdit }: { row: any; onDelete: () => void; canEdit: boolean }) {
  const [url, setUrl] = useState<string>("");
  const [open, setOpen] = useState(false);

  async function load() {
    if (url) { setOpen((o) => !o); return; }
    const { data, error } = await supabase.storage.from("voicetracks").createSignedUrl(row.storage_path, 3600);
    if (error) return toast.error(error.message);
    setUrl(data.signedUrl); setOpen(true);
  }

  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{row.title}</div>
          <div className="text-xs text-muted-foreground truncate">
            {row.stations?.name ?? "—"} · {row.duration_seconds ? `${Math.round(row.duration_seconds)}s` : "—"} · {new Date(row.created_at).toLocaleString()}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load}>
            {open ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </Button>
          {canEdit && (
            <ConfirmDialog
              title="Delete voicetrack?"
              description="This permanently removes the recording and its audio file."
              confirmText="Delete"
              destructive
              onConfirm={onDelete}
              trigger={<Button size="sm" variant="outline"><Trash2 className="w-3 h-3" /></Button>}
            />
          )}
        </div>
      </div>
      {open && url && <audio src={url} controls className="w-full mt-2" />}
    </div>
  );
}
