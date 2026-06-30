import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "@/services/database";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plug, Zap, Shield, User as UserIcon, Building2, Wrench, ArrowRight } from "lucide-react";
import { getPublicConfig } from "@/services/config";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { isAdmin } = useAuth();
  return (
    <AppLayout
      title="Settings"
      description="Anslut din broadcast-server, hantera konto och systeminställningar."
    >
      <Tabs defaultValue="connect" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="connect">
            <Plug className="w-4 h-4 mr-2" />
            Anslut server
          </TabsTrigger>
          <TabsTrigger value="profile">
            <UserIcon className="w-4 h-4 mr-2" />
            Min profil
          </TabsTrigger>
          <TabsTrigger value="brand">
            <Building2 className="w-4 h-4 mr-2" />
            System & varumärke
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Wrench className="w-4 h-4 mr-2" />
            Avancerat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connect">
          <ConnectServerTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="brand">
          <BrandTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="advanced">
          <AdvancedTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

/* -------------------- Connect external server -------------------- */

function ConnectServerTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: stations } = useQuery({
    queryKey: ["stations-min"],
    queryFn: async () =>
      (await database.from("stations").select("id,name").order("name")).data ?? [],
  });
  const conns = useQuery({
    queryKey: ["azura-conn-settings"],
    queryFn: async () =>
      (
        await database
          .from("azuracast_connections")
          .select("*, stations(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const [needStation, setNeedStation] = useState(false);
  const [stationDraft, setStationDraft] = useState({ name: "", slug: "" });
  const [form, setForm] = useState({
    station_id: "",
    base_url: "",
    azuracast_station_id: "",
    api_key_secret_name: "AZURACAST_API_KEY",
  });

  useEffect(() => {
    if (stations && stations.length === 0) setNeedStation(true);
  }, [stations]);

  const createStation = useMutation({
    mutationFn: async () => {
      const slug = (stationDraft.slug || stationDraft.name)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, "");
      const { data, error } = await database
        .from("stations")
        .insert({ name: stationDraft.name, slug })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s: any) => {
      toast.success("Station skapad");
      setForm((f) => ({ ...f, station_id: s.id }));
      setNeedStation(false);
      qc.invalidateQueries({ queryKey: ["stations-min"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.station_id || !form.base_url || !form.azuracast_station_id)
        throw new Error("Fyll i station, URL och remote station ID");
      const { error } = await database.from("azuracast_connections").insert(form as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anslutning sparad");
      setForm({
        station_id: "",
        base_url: "",
        azuracast_station_id: "",
        api_key_secret_name: "AZURACAST_API_KEY",
      });
      qc.invalidateQueries({ queryKey: ["azura-conn-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await database.functions.invoke("azuracast-test-connection", {
        body: { connection_id: id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.message ?? "OK");
      qc.invalidateQueries({ queryKey: ["azura-conn-settings"] });
    },
    onError: (e: any) => toast.error(`Test misslyckades: ${e.message}`),
  });

  if (!isAdmin) {
    return <Card className="p-6 text-sm">Endast admin kan hantera serveranslutningar.</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-1">Anslut din befintliga radio-server</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Radio Core sköter planering, podcasts och metadata. Din AzuraCast / Icecast-server är
          källan för playout. Steg-för-steg: skapa en station, lägg in URL och API-nyckel, testa
          anslutning.
        </p>

        <ol className="space-y-6">
          <li>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                1
              </span>
              <span className="font-medium">Välj eller skapa station</span>
            </div>
            {needStation || !stations?.length ? (
              <div className="ml-8 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label>Stationsnamn</Label>
                  <Input
                    value={stationDraft.name}
                    onChange={(e) => setStationDraft({ ...stationDraft, name: e.target.value })}
                    placeholder="Min Radio"
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={stationDraft.slug}
                    onChange={(e) => setStationDraft({ ...stationDraft, slug: e.target.value })}
                    placeholder="min-radio"
                  />
                </div>
                <Button
                  onClick={() => createStation.mutate()}
                  disabled={!stationDraft.name || createStation.isPending}
                >
                  Skapa station
                </Button>
              </div>
            ) : (
              <div className="ml-8 max-w-sm">
                <Select
                  value={form.station_id}
                  onValueChange={(v) => setForm({ ...form, station_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj station" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 mt-1"
                  onClick={() => setNeedStation(true)}
                >
                  + Skapa ny station
                </Button>
              </div>
            )}
          </li>

          <li>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                2
              </span>
              <span className="font-medium">Lägg till API-nyckeln</span>
            </div>
            <div className="ml-8 text-sm text-muted-foreground">
              Lägg till hemligheten{" "}
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                AZURACAST_API_KEY
              </code>{" "}
              i backend-secrets. Nyckeln stannar på servern och syns aldrig i webbläsaren. Hittas i
              AzuraCast under <em>Profile → API Keys</em>.
            </div>
          </li>

          <li>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                3
              </span>
              <span className="font-medium">Anslutningsuppgifter</span>
            </div>
            <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Server-URL *</Label>
                <Input
                  placeholder="https://radio.example.com"
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                />
              </div>
              <div>
                <Label>Remote station ID *</Label>
                <Input
                  placeholder="t.ex. 1"
                  value={form.azuracast_station_id}
                  onChange={(e) => setForm({ ...form, azuracast_station_id: e.target.value })}
                />
              </div>
              <div>
                <Label>API key secret-namn</Label>
                <Input
                  value={form.api_key_secret_name}
                  onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })}
                />
              </div>
            </div>
            <div className="ml-8 mt-4">
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.station_id}>
                {save.isPending ? "Sparar…" : "Spara anslutning"}
              </Button>
            </div>
          </li>
        </ol>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-3">Befintliga anslutningar</h3>
        {!conns.data?.length ? (
          <p className="text-sm text-muted-foreground">Inga anslutningar ännu.</p>
        ) : (
          <div className="space-y-3">
            {conns.data?.map((c: any) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border rounded-md p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">{c.stations?.name}</div>
                  <div className="text-xs text-muted-foreground font-mono break-all">
                    {c.base_url} · station {c.azuracast_station_id}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-muted-foreground">
                      testad:{" "}
                      {c.last_tested_at ? new Date(c.last_tested_at).toLocaleString() : "aldrig"}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => test.mutate(c.id)}
                  disabled={test.isPending}
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Testa
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          Hantera mer detaljerat under{" "}
          <Link to="/azuracast" className="underline">
            AzuraCast-sidan
          </Link>
          .
        </div>
      </Card>
    </div>
  );
}

/* -------------------- Profile -------------------- */

function ProfileTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      (await database.from("profiles").select("*").eq("id", user!.id).single()).data,
  });
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  useEffect(() => {
    if (profile.data) setName(profile.data.display_name ?? "");
  }, [profile.data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await database
        .from("profiles")
        .update({ display_name: name })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil sparad");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const changePw = useMutation({
    mutationFn: async () => {
      if (pw.length < 8) throw new Error("Lösenord måste vara minst 8 tecken");
      const { error } = await database.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lösenord uppdaterat");
      setPw("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <UserIcon className="w-4 h-4" />
          Min profil
        </h3>
        <div className="space-y-3">
          <div>
            <Label>E-post</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div>
            <Label>Visningsnamn</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            Spara
          </Button>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Byt lösenord
        </h3>
        <div className="space-y-3">
          <div>
            <Label>Nytt lösenord</Label>
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="minst 8 tecken"
            />
          </div>
          <Button onClick={() => changePw.mutate()} disabled={changePw.isPending || !pw}>
            Uppdatera lösenord
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* -------------------- Brand / system -------------------- */

function BrandTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const publicConfig = useQuery({
    queryKey: ["public-config"],
    queryFn: getPublicConfig,
  });
  const { data: stations } = useQuery({
    queryKey: ["stations-brand"],
    queryFn: async () => (await database.from("stations").select("*").order("name")).data ?? [],
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await database.from("stations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sparat");
      qc.invalidateQueries({ queryKey: ["stations-brand"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!stations?.length) {
    return (
      <div className="space-y-4">
        <PublicConfigCard query={publicConfig} />
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">Inga stationer skapade ännu.</p>
          <Button asChild>
            <Link to="/stations">
              Gå till Stations <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PublicConfigCard query={publicConfig} />
      {stations.map((s: any) => (
        <Card key={s.id} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Namn</Label>
              <Input
                defaultValue={s.name}
                disabled={!isAdmin}
                onBlur={(e) =>
                  e.target.value !== s.name &&
                  update.mutate({ id: s.id, patch: { name: e.target.value } })
                }
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input defaultValue={s.slug} disabled />
            </div>
            <div>
              <Label>Beskrivning</Label>
              <Input
                defaultValue={s.description ?? ""}
                disabled={!isAdmin}
                onBlur={(e) =>
                  e.target.value !== (s.description ?? "") &&
                  update.mutate({ id: s.id, patch: { description: e.target.value } })
                }
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PublicConfigCard({
  query,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getPublicConfig>>>>;
}) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Publik konfiguration</h3>
          <p className="text-xs text-muted-foreground">Read-only från den aktiva datakällan.</p>
        </div>
        <Badge variant="outline">
          {query.data?.source ?? (query.isLoading ? "loading" : "unavailable")}
        </Badge>
      </div>
      {query.error ? (
        <p className="text-sm text-destructive">{query.error.message}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <ReadOnlyConfig label="Produkt" value={query.data?.data.product_name} />
          <ReadOnlyConfig label="Standardstation" value={query.data?.data.default_station_slug} />
          <ReadOnlyConfig label="Lyssnarlänk" value={query.data?.data.listen_url} />
        </div>
      )}
    </Card>
  );
}

function ReadOnlyConfig({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs">
        {typeof value === "string" ? value : "—"}
      </div>
    </div>
  );
}

/* -------------------- Advanced (raw system_settings) -------------------- */

function AdvancedTab() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data } = useQuery({
    queryKey: ["system_settings"],
    queryFn: async () =>
      (await database.from("system_settings").select("*").order("key")).data ?? [],
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data)
      setDrafts(Object.fromEntries(data.map((s: any) => [s.id, JSON.stringify(s.value, null, 2)])));
  }, [data]);

  const save = useMutation({
    mutationFn: async ({ id, raw }: { id: string; raw: string }) => {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Ogiltig JSON");
      }
      const { error } = await database
        .from("system_settings")
        .update({ value: parsed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sparat");
      qc.invalidateQueries({ queryKey: ["system_settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm bg-muted/40">
        Avancerade inställningar i råformat (JSON). Var försiktig — felaktiga värden kan påverka
        schemaläggning och defaults. Se även:{" "}
        <Link to="/audit" className="underline">
          Audit logs
        </Link>
        ,{" "}
        <Link to="/backup" className="underline">
          Backup
        </Link>
        ,{" "}
        <Link to="/health" className="underline">
          Service health
        </Link>
        .
      </Card>
      {!isAdmin && (
        <Card className="p-4 border-warning/40 bg-warning/10 text-sm">
          Endast admin kan ändra dessa värden.
        </Card>
      )}
      {data?.map((s: any) => (
        <Card key={s.id} className="p-5">
          <div className="flex items-baseline justify-between mb-1">
            <Label className="font-mono text-sm">{s.key}</Label>
          </div>
          {s.description && <p className="text-xs text-muted-foreground mb-3">{s.description}</p>}
          <Textarea
            className="font-mono text-xs"
            rows={4}
            value={drafts[s.id] ?? ""}
            disabled={!isAdmin}
            onChange={(e) => setDrafts({ ...drafts, [s.id]: e.target.value })}
          />
          {isAdmin && (
            <div className="mt-3">
              <Button
                size="sm"
                onClick={() => save.mutate({ id: s.id, raw: drafts[s.id] })}
                disabled={save.isPending}
              >
                Spara
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
