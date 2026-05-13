# Radio Core Agent

The Radio Core Agent is a Node.js process that runs on the broadcast host (VPS or Docker) and executes operational tasks Radio Core's web app cannot do directly: controlling Liquidsoap via telnet, reloading Stereo Tool presets, restarting Icecast, mounting R2 caches, running loudness normalization, etc.

The web app talks to the agent through a small typed contract (`src/server/agent-client.server.ts`). Until a real agent is paired, every call is **mocked**: it logs a `system_events` row and returns `{ ok: true, mocked: true }`.

## Authentication

Agents authenticate using the existing **`stack_tokens`** table:

1. An admin creates a row in `stack_tokens` with `purpose = 'agent'` and (optionally) `station_id` set. The raw secret is shown once on creation; only its hash is stored.
2. The admin registers the agent in **Integrations → Agents** and pairs it with the token (`agent_instances.stack_token_id`).
3. The agent stores the raw secret locally and sends it as `x-stack-token: <secret>` on every request to Radio Core's public API.

Revoking an agent (UI button) deactivates the linked `stack_tokens` row and marks the agent offline.

## Heartbeat

The agent should POST a heartbeat every 30s:

```
POST /api/public/agent/heartbeat
x-stack-token: <agent secret>

{
  "agent_id": "<uuid>",
  "version": "0.1.0",
  "hostname": "agent-01.example.com",
  "capabilities": { "liquidsoap": true, "stereo_tool": false },
  "metrics": { "cpu": 0.12, "mem_mb": 480 }
}
```

The web app stores `last_seen_at`, updates `status`, and writes a `system_events` entry. (Endpoint to be implemented when the real agent ships — see *out of scope* below.)

## Job dispatch

When an admin triggers an action (Ping, Test runtime, Run loudness pass), the web app records a `sync_jobs` row and writes a `system_events.dispatch` entry. The agent polls `sync_jobs` (or receives a webhook in a future version), claims the job via `claim_sync_jobs(_limit, _worker)`, executes it locally and reports back by updating the row.

Supported job types (text, no enum lock-in):

- `agent_heartbeat`
- `runtime_check`, `runtime_health_check`
- `storage_check`, `r2_sync`
- `azuracast_sync`, `media_import`
- `loudness_normalize`
- `stream_health_check`

## Security

- The agent **never** receives raw runtime credentials (AzuraCast API key, R2 secret). It either uses the local broadcast service directly, or asks Radio Core to perform the privileged operation.
- All cross-tenant guards enforced in `/api/public/*` apply: a token scoped to `station_id = X` cannot read or write data for a different station.
- Tokens are hashed at rest. Compromised tokens should be rotated immediately via the Agents page.

## Out of scope (current round)

- The real Node.js agent codebase (this repo only ships the contract, mocked client and registration UI).
- Push-style job dispatch (current flow is poll-only).
- Per-capability ACLs beyond station scoping.
