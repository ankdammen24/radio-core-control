/**
 * Cloudflare R2 admin: upload media/artwork/public files, see URL, copy, delete.
 *
 * Backend handles the upload (server function). Frontend never touches R2 keys.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ResourcePageShell } from "@/components/resource-page-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  uploadObject,
  deleteStoredObject,
  listStoredObjects,
} from "@/lib/r2-storage.functions";

export const Route = createFileRoute("/r2-storage")({ component: R2Page });

type BucketType = "media" | "artwork" | "public";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function R2Page() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const list = useServerFn(listStoredObjects);
  const upload = useServerFn(uploadObject);
  const remove = useServerFn(deleteStoredObject);

  const [type, setType] = useState<BucketType>("media");
  const [pathPrefix, setPathPrefix] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["r2-objects"],
    queryFn: () => list(),
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return upload({
        data: {
          type,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          base64,
          pathPrefix: pathPrefix || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Uploaded");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["r2-objects"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Upload failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["r2-objects"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const rows = query.data ?? [];

  const state =
    query.isLoading ? { kind: "loading" as const } :
    query.error    ? { kind: "error" as const, message: (query.error as Error).message, retry: () => query.refetch() } :
    rows.length === 0 ? { kind: "empty" as const, title: "No files yet", hint: "Upload audio, artwork, or other public assets to Cloudflare R2." } :
    { kind: "ready" as const };

  const onPickFile = async (f: File | undefined | null) => {
    if (!f) return;
    if (!isEditor) { toast.error("Editor role required"); return; }
    uploadMut.mutate(f);
  };

  const accept =
    type === "media"   ? "audio/*,.mp3,.wav,.flac,.m4a,.ogg" :
    type === "artwork" ? "image/*,.jpg,.jpeg,.png,.webp,.svg" :
                         "audio/*,image/*";

  return (
    <ResourcePageShell
      title="R2 Storage"
      description="Cloudflare R2 buckets for media, artwork and public assets. Uploads are processed server-side."
      hideStationScope
      state={state}
    >
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 mb-4">
        <div className="grid gap-3 md:grid-cols-[160px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Bucket</Label>
            <Select value={type} onValueChange={(v) => setType(v as BucketType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="media">media (audio)</SelectItem>
                <SelectItem value="artwork">artwork (images)</SelectItem>
                <SelectItem value="public">public (cdn)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Path prefix (optional)</Label>
            <Input
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
              placeholder="e.g. tracks/2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">&nbsp;</Label>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={!isEditor || uploadMut.isPending}
            >
              <Upload className="w-4 h-4 mr-1" />
              {uploadMut.isPending ? "Uploading…" : "Choose file"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Allowed audio: mp3, wav, flac, m4a, ogg. Allowed images: jpg, jpeg, png, webp, svg.
          Max 500&nbsp;MB audio / 25&nbsp;MB image.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bucket</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell><Badge variant="outline" className="uppercase">{r.bucket_type}</Badge></TableCell>
              <TableCell className="font-mono text-xs max-w-[300px] truncate" title={r.object_key}>{r.object_key}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{r.content_type ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {r.size_bytes ? `${(r.size_bytes / 1024).toFixed(1)} KB` : "—"}
              </TableCell>
              <TableCell className="max-w-[280px]">
                <a
                  href={r.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline text-xs font-mono truncate block"
                  title={r.public_url}
                >
                  {r.public_url}
                </a>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => { navigator.clipboard.writeText(r.public_url ?? ""); toast.success("URL copied"); }}
                  title="Copy URL"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  disabled={!isEditor || deleteMut.isPending}
                  onClick={() => { if (confirm("Delete this object?")) deleteMut.mutate(r.id); }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResourcePageShell>
  );
}
