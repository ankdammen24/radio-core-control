# STORAGE-DESIGN.md

# Radio Core Storage Architecture
Version: 1.0
Platform: Radio Core / Listen / Radio Uppsala
Status: Draft Architecture Specification

---

# 1. Purpose

This document defines the storage architecture for:

- Radio Core
- listen.radiouppsala.se
- radiouppsala.se

The storage layer must support:

- live radio
- on-demand streaming
- podcasts
- AI-generated audio
- metadata
- analytics
- future SaaS multi-tenant operation
- scalable object storage
- local-first MVP deployment

The platform must be able to start on a single Ubuntu VPS and later scale to:

- S3-compatible storage
- Cloudflare R2
- Azure Blob Storage
- Kubernetes
- multi-region deployments
- enterprise environments

without requiring major frontend rewrites.

---

# 2. Core Storage Philosophy

## 2.1 Radio Core Owns All Media

Radio Core is the single source of truth for:

- audio files
- metadata
- artwork
- AI-generated content
- transcoded variants
- playback permissions
- rights metadata
- analytics

Listen and Radio Uppsala never own media files.

---

# 2.2 Frontend Never Talks Directly To Storage

Frontend applications must never receive:

- storage credentials
- bucket credentials
- permanent object URLs
- direct origin access

All access must go through:

```txt
Listen
  -> Radio Core API
  -> playback policy
  -> signed playback URL or stream proxy
  -> object storage
