import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, KeyRound, Radio, Music, Settings2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { checkBackendHealth } from "@/services/health";
import { checkDatabaseHealth } from "@/services/database";
import { checkAuth0Reachability } from "@/services/auth";
import { listStations } from "@/services/stations";
import { getMediaStatus } from "@/services/media";
import { getPublicConfig } from "@/services/config";
import type { DataSource } from "@/services/data-source";

export const Route = createFileRoute("/migration-status")({ component: MigrationStatusPage });

function MigrationStatusPage() {
  const connectivity = useQuery({
    queryKey: ["provider-connectivity"],
    queryFn: async () => {
      const [api, supabase, auth0] = await Promise.all([
        checkBackendHealth(),
        checkDatabaseHealth(),
        checkAuth0Reachability(),
      ]);
      return { api, supabase, auth0 };
    },
    refetchInterval: 30_000,
  });

  const features = useQuery({
    queryKey: ["migration-feature-sources"],
    queryFn: async () => {
      const [stations, media, config] = await Promise.all([
        listStations(),
        getMediaStatus(),
        getPublicConfig(),
      ]);
      return { stations, media, config };
    },
    refetchInterval: 30_000,
  });

  return (
    <AppLayout
      title="Migration Status"
      description="Provider reachability, fallbacks and active read sources."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <ProviderCard
          label="Radio Core API"
          icon={Activity}
          reachable={connectivity.data?.api.available}
          detail={
            connectivity.data?.api.dependencies?.mongodb?.ok === false
              ? `API online · MongoDB: ${connectivity.data.api.dependencies.mongodb.error ?? "offline"}`
              : connectivity.data?.api.message
          }
        />
        <ProviderCard
          label="Supabase"
          icon={Database}
          reachable={connectivity.data?.supabase.reachable}
          detail={connectivity.data?.supabase.message}
        />
        <ProviderCard
          label="Auth0"
          icon={KeyRound}
          reachable={connectivity.data?.auth0.reachable}
          configured={connectivity.data?.auth0.configured}
          detail={connectivity.data?.auth0.message}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b p-5">
          <h2 className="font-semibold">Active data sources</h2>
          <p className="text-xs text-muted-foreground">
            API-first reads fall back to Supabase only when Radio Core is unavailable.
          </p>
        </div>
        <div className="divide-y">
          <FeatureRow icon={Activity} feature="System health" source="radio-core" fallback="None" />
          <FeatureRow
            icon={Radio}
            feature="Stations (read)"
            source={features.data?.stations.source}
            fallback="Supabase stations (when enabled)"
            reason={features.data?.stations.fallbackReason}
          />
          <FeatureRow
            icon={Music}
            feature="Media status"
            source={features.data?.media.source}
            fallback="Supabase media_files aggregate (when enabled)"
            reason={features.data?.media.fallbackReason}
          />
          <FeatureRow
            icon={Settings2}
            feature="Public config"
            source={features.data?.config.source}
            fallback="Supabase system_settings (when enabled)"
            reason={features.data?.config.fallbackReason}
          />
        </div>
      </Card>
    </AppLayout>
  );
}

function ProviderCard({
  label,
  icon: Icon,
  reachable,
  configured = true,
  detail,
}: {
  label: string;
  icon: typeof Activity;
  reachable?: boolean;
  configured?: boolean;
  detail?: string;
}) {
  const state = !configured
    ? "not configured"
    : reachable === undefined
      ? "checking"
      : reachable
        ? "reachable"
        : "unreachable";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </div>
        <Badge variant="outline">{state}</Badge>
      </div>
      <p className="mt-3 min-h-8 text-xs text-muted-foreground">{detail ?? "Checking provider…"}</p>
    </Card>
  );
}

function FeatureRow({
  icon: Icon,
  feature,
  source,
  fallback,
  reason,
}: {
  icon: typeof Activity;
  feature: string;
  source?: DataSource;
  fallback: string;
  reason?: string;
}) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[1fr_160px_1fr] md:items-center">
      <div className="flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {feature}
      </div>
      <Badge variant="outline" className="w-fit">
        {source ?? "checking"}
      </Badge>
      <div className="text-xs text-muted-foreground" title={reason}>
        Fallback: {fallback}
        {reason ? ` · ${reason}` : ""}
      </div>
    </div>
  );
}
