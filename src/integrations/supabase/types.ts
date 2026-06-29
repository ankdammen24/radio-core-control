export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ad_campaigns: {
        Row: {
          advertiser: string
          created_at: string
          daily_target: number
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          start_date: string | null
          station_id: string
          updated_at: string
        }
        Insert: {
          advertiser: string
          created_at?: string
          daily_target?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          start_date?: string | null
          station_id: string
          updated_at?: string
        }
        Update: {
          advertiser?: string
          created_at?: string
          daily_target?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          start_date?: string | null
          station_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_spots: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          media_file_id: string | null
          weight: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          media_file_id?: string | null
          weight?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          media_file_id?: string | null
          weight?: number
        }
        Relationships: []
      }
      agent_instances: {
        Row: {
          capabilities: Json
          created_at: string
          hostname: string | null
          id: string
          last_error: string | null
          last_seen_at: string | null
          metadata: Json
          metrics: Json
          name: string
          reload_requested_at: string | null
          stack_token_id: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
          version: string | null
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          hostname?: string | null
          id?: string
          last_error?: string | null
          last_seen_at?: string | null
          metadata?: Json
          metrics?: Json
          name: string
          reload_requested_at?: string | null
          stack_token_id?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          version?: string | null
        }
        Update: {
          capabilities?: Json
          created_at?: string
          hostname?: string | null
          id?: string
          last_error?: string | null
          last_seen_at?: string | null
          metadata?: Json
          metrics?: Json
          name?: string
          reload_requested_at?: string | null
          stack_token_id?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_stack_token_id_fkey"
            columns: ["stack_token_id"]
            isOneToOne: false
            referencedRelation: "stack_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          station_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          station_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          station_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      azuracast_connections: {
        Row: {
          api_key_secret_name: string | null
          azuracast_station_id: string | null
          base_url: string | null
          created_at: string
          id: string
          last_tested_at: string | null
          station_id: string
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          azuracast_station_id?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          last_tested_at?: string | null
          station_id: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          azuracast_station_id?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          last_tested_at?: string | null
          station_id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "azuracast_connections_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          scheduled_end: string
          scheduled_start: string
          show_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_end: string
          scheduled_start: string
          show_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_end?: string
          scheduled_start?: string
          show_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fallback_tracks: {
        Row: {
          created_at: string
          external_url: string | null
          id: string
          is_active: boolean
          label: string
          media_file_id: string | null
          priority: number
          station_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          id?: string
          is_active?: boolean
          label: string
          media_file_id?: string | null
          priority?: number
          station_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_url?: string | null
          id?: string
          is_active?: boolean
          label?: string
          media_file_id?: string | null
          priority?: number
          station_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      icecast_configs: {
        Row: {
          admin_email: string | null
          admin_password: string
          admin_user: string
          created_at: string
          hostname: string
          id: string
          location: string | null
          max_clients: number
          max_sources: number
          port: number
          relay_password: string
          source_password: string
          station_id: string
          updated_at: string
        }
        Insert: {
          admin_email?: string | null
          admin_password?: string
          admin_user?: string
          created_at?: string
          hostname?: string
          id?: string
          location?: string | null
          max_clients?: number
          max_sources?: number
          port?: number
          relay_password?: string
          source_password?: string
          station_id: string
          updated_at?: string
        }
        Update: {
          admin_email?: string | null
          admin_password?: string
          admin_user?: string
          created_at?: string
          hostname?: string
          id?: string
          location?: string | null
          max_clients?: number
          max_sources?: number
          port?: number
          relay_password?: string
          source_password?: string
          station_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      liquidsoap_configs: {
        Row: {
          created_at: string
          crossfade_seconds: number
          custom_liq: string | null
          fallback_track_path: string | null
          generated_at: string | null
          generated_liq: string | null
          id: string
          normalize_audio: boolean
          station_id: string
          telnet_host: string
          telnet_port: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          crossfade_seconds?: number
          custom_liq?: string | null
          fallback_track_path?: string | null
          generated_at?: string | null
          generated_liq?: string | null
          id?: string
          normalize_audio?: boolean
          station_id: string
          telnet_host?: string
          telnet_port?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          crossfade_seconds?: number
          custom_liq?: string | null
          fallback_track_path?: string | null
          generated_at?: string | null
          generated_liq?: string | null
          id?: string
          normalize_audio?: boolean
          station_id?: string
          telnet_host?: string
          telnet_port?: number
          updated_at?: string
        }
        Relationships: []
      }
      listener_stats: {
        Row: {
          id: string
          listeners: number
          mount_path: string | null
          peak_listeners: number
          recorded_at: string
          station_id: string
        }
        Insert: {
          id?: string
          listeners?: number
          mount_path?: string | null
          peak_listeners?: number
          recorded_at?: string
          station_id: string
        }
        Update: {
          id?: string
          listeners?: number
          mount_path?: string | null
          peak_listeners?: number
          recorded_at?: string
          station_id?: string
        }
        Relationships: []
      }
      live_inputs: {
        Row: {
          auto_takeover: boolean
          bitrate: number
          created_at: string
          fade_in_seconds: number
          fade_out_seconds: number
          forced_takeover: boolean
          format: string
          harbor_port: number
          id: string
          is_enabled: boolean
          is_live: boolean
          last_state_change: string | null
          mount_path: string
          notes: string | null
          source_password: string
          source_user: string
          station_id: string
          updated_at: string
        }
        Insert: {
          auto_takeover?: boolean
          bitrate?: number
          created_at?: string
          fade_in_seconds?: number
          fade_out_seconds?: number
          forced_takeover?: boolean
          format?: string
          harbor_port?: number
          id?: string
          is_enabled?: boolean
          is_live?: boolean
          last_state_change?: string | null
          mount_path?: string
          notes?: string | null
          source_password?: string
          source_user?: string
          station_id: string
          updated_at?: string
        }
        Update: {
          auto_takeover?: boolean
          bitrate?: number
          created_at?: string
          fade_in_seconds?: number
          fade_out_seconds?: number
          forced_takeover?: boolean
          format?: string
          harbor_port?: number
          id?: string
          is_enabled?: boolean
          is_live?: boolean
          last_state_change?: string | null
          mount_path?: string
          notes?: string | null
          source_password?: string
          source_user?: string
          station_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_takeover_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string | null
          source: string
          station_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          source?: string
          station_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          source?: string
          station_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      live_takeover_schedule: {
        Row: {
          auto_activate: boolean
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          notes: string | null
          presenter_id: string | null
          starts_at: string
          station_id: string
          title: string
          updated_at: string
        }
        Insert: {
          auto_activate?: boolean
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          notes?: string | null
          presenter_id?: string | null
          starts_at: string
          station_id: string
          title: string
          updated_at?: string
        }
        Update: {
          auto_activate?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          presenter_id?: string | null
          starts_at?: string
          station_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_files: {
        Row: {
          azuracast_media_id: string | null
          checksum: string | null
          created_at: string
          duration_seconds: number | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          media_kind: string
          mime_type: string | null
          original_file_name: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["media_status"]
          storage_location_id: string | null
          updated_at: string
        }
        Insert: {
          azuracast_media_id?: string | null
          checksum?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          media_kind?: string
          mime_type?: string | null
          original_file_name?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_location_id?: string | null
          updated_at?: string
        }
        Update: {
          azuracast_media_id?: string | null
          checksum?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          media_kind?: string
          mime_type?: string | null
          original_file_name?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_files_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_files_storage_location_id_fkey"
            columns: ["storage_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_broadcast_history: {
        Row: {
          broadcast_time: string
          created_at: string
          id: string
          metadata: Json
          news_item_id: string
          program_name: string | null
          station_id: string
        }
        Insert: {
          broadcast_time?: string
          created_at?: string
          id?: string
          metadata?: Json
          news_item_id: string
          program_name?: string | null
          station_id: string
        }
        Update: {
          broadcast_time?: string
          created_at?: string
          id?: string
          metadata?: Json
          news_item_id?: string
          program_name?: string | null
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_broadcast_history_news_item_id_fkey"
            columns: ["news_item_id"]
            isOneToOne: false
            referencedRelation: "news_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_broadcast_history_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          audio_url: string | null
          category: string | null
          created_at: string
          estimated_duration_seconds: number | null
          expires_at: string | null
          external_id: string | null
          full_article: string | null
          id: string
          image_url: string | null
          language: string
          municipality: string | null
          priority: Database["public"]["Enums"]["news_priority"]
          published_at: string | null
          radio_script: string | null
          region: string | null
          short_title: string | null
          source: string | null
          status: Database["public"]["Enums"]["news_status"]
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          category?: string | null
          created_at?: string
          estimated_duration_seconds?: number | null
          expires_at?: string | null
          external_id?: string | null
          full_article?: string | null
          id?: string
          image_url?: string | null
          language?: string
          municipality?: string | null
          priority?: Database["public"]["Enums"]["news_priority"]
          published_at?: string | null
          radio_script?: string | null
          region?: string | null
          short_title?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["news_status"]
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          category?: string | null
          created_at?: string
          estimated_duration_seconds?: number | null
          expires_at?: string | null
          external_id?: string | null
          full_article?: string | null
          id?: string
          image_url?: string | null
          language?: string
          municipality?: string | null
          priority?: Database["public"]["Enums"]["news_priority"]
          published_at?: string | null
          radio_script?: string | null
          region?: string | null
          short_title?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["news_status"]
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      now_playing: {
        Row: {
          album: string | null
          artist: string | null
          duration_seconds: number | null
          listeners: number
          media_file_id: string | null
          mount_path: string | null
          started_at: string
          station_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          album?: string | null
          artist?: string | null
          duration_seconds?: number | null
          listeners?: number
          media_file_id?: string | null
          mount_path?: string | null
          started_at?: string
          station_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          album?: string | null
          artist?: string | null
          duration_seconds?: number | null
          listeners?: number
          media_file_id?: string | null
          mount_path?: string | null
          started_at?: string
          station_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      play_history: {
        Row: {
          album: string | null
          artist: string | null
          duration_seconds: number | null
          id: string
          listeners: number | null
          media_file_id: string | null
          played_at: string
          station_id: string
          title: string | null
        }
        Insert: {
          album?: string | null
          artist?: string | null
          duration_seconds?: number | null
          id?: string
          listeners?: number | null
          media_file_id?: string | null
          played_at?: string
          station_id: string
          title?: string | null
        }
        Update: {
          album?: string | null
          artist?: string | null
          duration_seconds?: number | null
          id?: string
          listeners?: number | null
          media_file_id?: string | null
          played_at?: string
          station_id?: string
          title?: string | null
        }
        Relationships: []
      }
      playlist_assignments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          media_file_id: string
          playlist_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          media_file_id: string
          playlist_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          media_file_id?: string
          playlist_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_assignments_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_assignments_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          azuracast_playlist_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          playlist_type: Database["public"]["Enums"]["playlist_type"]
          priority: number
          station_id: string
          updated_at: string
        }
        Insert: {
          azuracast_playlist_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          playlist_type?: Database["public"]["Enums"]["playlist_type"]
          priority?: number
          station_id: string
          updated_at?: string
        }
        Update: {
          azuracast_playlist_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          playlist_type?: Database["public"]["Enums"]["playlist_type"]
          priority?: number
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_episodes: {
        Row: {
          artwork_url: string | null
          audio_format: string | null
          audio_url: string
          checksum: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_seconds: number | null
          episode_number: number | null
          explicit: boolean
          guid: string
          id: string
          podcast_id: string
          publish_date: string | null
          season: number | null
          title: string
          transcript_url: string | null
          updated_at: string
          version: number
        }
        Insert: {
          artwork_url?: string | null
          audio_format?: string | null
          audio_url: string
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          episode_number?: number | null
          explicit?: boolean
          guid: string
          id?: string
          podcast_id: string
          publish_date?: string | null
          season?: number | null
          title: string
          transcript_url?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          artwork_url?: string | null
          audio_format?: string | null
          audio_url?: string
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          episode_number?: number | null
          explicit?: boolean
          guid?: string
          id?: string
          podcast_id?: string
          publish_date?: string | null
          season?: number | null
          title?: string
          transcript_url?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_play_log: {
        Row: {
          duration_played: number | null
          episode_id: string
          id: string
          played_at: string
          source: Database["public"]["Enums"]["podcast_play_source"]
          station_id: string
        }
        Insert: {
          duration_played?: number | null
          episode_id: string
          id?: string
          played_at?: string
          source?: Database["public"]["Enums"]["podcast_play_source"]
          station_id: string
        }
        Update: {
          duration_played?: number | null
          episode_id?: string
          id?: string
          played_at?: string
          source?: Database["public"]["Enums"]["podcast_play_source"]
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_play_log_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_play_log_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_sources: {
        Row: {
          auth_secret_name: string | null
          base_url: string
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["podcast_source_kind"]
          last_synced_at: string | null
          name: string
          sync_interval_minutes: number
          updated_at: string
        }
        Insert: {
          auth_secret_name?: string | null
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["podcast_source_kind"]
          last_synced_at?: string | null
          name: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_secret_name?: string | null
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["podcast_source_kind"]
          last_synced_at?: string | null
          name?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      podcast_sync_runs: {
        Row: {
          episodes_deleted: number
          episodes_new: number
          episodes_updated: number
          error: string | null
          finished_at: string | null
          id: string
          podcasts_seen: number
          source_id: string
          started_at: string
          status: Database["public"]["Enums"]["podcast_sync_status"]
        }
        Insert: {
          episodes_deleted?: number
          episodes_new?: number
          episodes_updated?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          podcasts_seen?: number
          source_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["podcast_sync_status"]
        }
        Update: {
          episodes_deleted?: number
          episodes_new?: number
          episodes_updated?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          podcasts_seen?: number
          source_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["podcast_sync_status"]
        }
        Relationships: [
          {
            foreignKeyName: "podcast_sync_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "podcast_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      podcasts: {
        Row: {
          artwork_url: string | null
          categories: string[]
          checksum: string | null
          created_at: string
          description: string | null
          external_id: string
          id: string
          is_active: boolean
          language: string | null
          last_updated_at: string | null
          owner: string | null
          source_id: string
          title: string
          updated_at: string
        }
        Insert: {
          artwork_url?: string | null
          categories?: string[]
          checksum?: string | null
          created_at?: string
          description?: string | null
          external_id: string
          id?: string
          is_active?: boolean
          language?: string | null
          last_updated_at?: string | null
          owner?: string | null
          source_id: string
          title: string
          updated_at?: string
        }
        Update: {
          artwork_url?: string | null
          categories?: string[]
          checksum?: string | null
          created_at?: string
          description?: string | null
          external_id?: string
          id?: string
          is_active?: boolean
          language?: string | null
          last_updated_at?: string | null
          owner?: string | null
          source_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcasts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "podcast_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      presenters: {
        Row: {
          avatar_url: string | null
          bio: string | null
          color: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rotation_rules: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_tracks_per_hour: number
          min_minutes_between_same_artist: number
          min_minutes_between_same_track: number
          name: string
          priority: number
          station_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_tracks_per_hour?: number
          min_minutes_between_same_artist?: number
          min_minutes_between_same_track?: number
          name: string
          priority?: number
          station_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_tracks_per_hour?: number
          min_minutes_between_same_artist?: number
          min_minutes_between_same_track?: number
          name?: string
          priority?: number
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotation_rules_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      rundown_items: {
        Row: {
          created_at: string
          duration_seconds: number
          episode_id: string
          id: string
          item_type: string
          media_file_id: string | null
          notes: string | null
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          episode_id: string
          id?: string
          item_type?: string
          media_file_id?: string | null
          notes?: string | null
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          episode_id?: string
          id?: string
          item_type?: string
          media_file_id?: string | null
          notes?: string | null
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      runtime_health_checks: {
        Row: {
          created_at: string
          details: Json
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          station_id: string
          status: Database["public"]["Enums"]["runtime_target_status"]
          target_id: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          station_id: string
          status?: Database["public"]["Enums"]["runtime_target_status"]
          target_id: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          station_id?: string
          status?: Database["public"]["Enums"]["runtime_target_status"]
          target_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runtime_health_checks_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "runtime_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      runtime_targets: {
        Row: {
          api_key_secret_name: string | null
          base_url: string | null
          created_at: string
          external_station_id: string | null
          id: string
          is_active: boolean
          last_checked_at: string | null
          last_error: string | null
          metadata: Json
          name: string
          station_id: string
          status: Database["public"]["Enums"]["runtime_target_status"]
          type: Database["public"]["Enums"]["runtime_target_type"]
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          base_url?: string | null
          created_at?: string
          external_station_id?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          metadata?: Json
          name: string
          station_id: string
          status?: Database["public"]["Enums"]["runtime_target_status"]
          type: Database["public"]["Enums"]["runtime_target_type"]
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          base_url?: string | null
          created_at?: string
          external_station_id?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          metadata?: Json
          name?: string
          station_id?: string
          status?: Database["public"]["Enums"]["runtime_target_status"]
          type?: Database["public"]["Enums"]["runtime_target_type"]
          updated_at?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          block_kind: Database["public"]["Enums"]["schedule_block_kind"]
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          is_active: boolean
          name: string
          playlist_id: string | null
          podcast_selector: Json | null
          rotation_rule_id: string | null
          start_time: string
          station_id: string
          updated_at: string
        }
        Insert: {
          block_kind?: Database["public"]["Enums"]["schedule_block_kind"]
          created_at?: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          playlist_id?: string | null
          podcast_selector?: Json | null
          rotation_rule_id?: string | null
          start_time: string
          station_id: string
          updated_at?: string
        }
        Update: {
          block_kind?: Database["public"]["Enums"]["schedule_block_kind"]
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          playlist_id?: string | null
          podcast_selector?: Json | null
          rotation_rule_id?: string | null
          start_time?: string
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_rotation_rule_id_fkey"
            columns: ["rotation_rule_id"]
            isOneToOne: false
            referencedRelation: "rotation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_health: {
        Row: {
          details: Json | null
          id: string
          message: string | null
          reported_at: string
          service: string
          station_id: string | null
          status: string
        }
        Insert: {
          details?: Json | null
          id?: string
          message?: string | null
          reported_at?: string
          service: string
          station_id?: string | null
          status?: string
        }
        Update: {
          details?: Json | null
          id?: string
          message?: string | null
          reported_at?: string
          service?: string
          station_id?: string | null
          status?: string
        }
        Relationships: []
      }
      shows: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          presenter_id: string | null
          station_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          presenter_id?: string | null
          station_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          presenter_id?: string | null
          station_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      song_requests: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          message: string | null
          requester_name: string | null
          station_id: string
          status: string
          track_text: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requester_name?: string | null
          station_id: string
          status?: string
          track_text: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requester_name?: string | null
          station_id?: string
          status?: string
          track_text?: string
        }
        Relationships: []
      }
      stack_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          purpose: string
          revoked_at: string | null
          station_id: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          purpose?: string
          revoked_at?: string | null
          station_id?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          purpose?: string
          revoked_at?: string | null
          station_id?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      station_podcast_subscriptions: {
        Row: {
          allow_explicit: boolean
          auto_import: boolean
          created_at: string
          id: string
          is_active: boolean
          manual_review: boolean
          max_episodes: number | null
          only_owned: boolean
          only_swedish: boolean
          podcast_id: string
          priority: number
          station_id: string
          updated_at: string
        }
        Insert: {
          allow_explicit?: boolean
          auto_import?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          manual_review?: boolean
          max_episodes?: number | null
          only_owned?: boolean
          only_swedish?: boolean
          podcast_id: string
          priority?: number
          station_id: string
          updated_at?: string
        }
        Update: {
          allow_explicit?: boolean
          auto_import?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          manual_review?: boolean
          max_episodes?: number | null
          only_owned?: boolean
          only_swedish?: boolean
          podcast_id?: string
          priority?: number
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_podcast_subscriptions_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "podcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_podcast_subscriptions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          account_id: string | null
          api_key_hash: string | null
          api_key_prefix: string | null
          azuracast_station_id: string | null
          created_at: string
          demo_artwork_url: string | null
          demo_mode: boolean
          demo_stream_url: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          api_key_hash?: string | null
          api_key_prefix?: string | null
          azuracast_station_id?: string | null
          created_at?: string
          demo_artwork_url?: string | null
          demo_mode?: boolean
          demo_stream_url?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          api_key_hash?: string | null
          api_key_prefix?: string | null
          azuracast_station_id?: string | null
          created_at?: string
          demo_artwork_url?: string | null
          demo_mode?: boolean
          demo_stream_url?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_health_checks: {
        Row: {
          created_at: string
          details: Json
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          station_id: string
          status: Database["public"]["Enums"]["storage_status"]
          target_id: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          station_id: string
          status?: Database["public"]["Enums"]["storage_status"]
          target_id: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          station_id?: string
          status?: Database["public"]["Enums"]["storage_status"]
          target_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_health_checks_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "storage_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_locations: {
        Row: {
          base_path: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          base_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          base_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      storage_objects: {
        Row: {
          bucket: string
          bucket_type: string
          content_type: string | null
          created_at: string
          id: string
          metadata: Json
          object_key: string
          public_url: string | null
          size_bytes: number | null
          station_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket: string
          bucket_type: string
          content_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          object_key: string
          public_url?: string | null
          size_bytes?: number | null
          station_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          bucket_type?: string
          content_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          object_key?: string
          public_url?: string | null
          size_bytes?: number | null
          station_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_objects_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_targets: {
        Row: {
          access_key_ref: string | null
          bucket: string | null
          created_at: string
          endpoint_url: string | null
          id: string
          is_active: boolean
          last_checked_at: string | null
          last_error: string | null
          metadata: Json
          name: string
          provider: Database["public"]["Enums"]["storage_provider"]
          public_base_url: string | null
          purpose: Database["public"]["Enums"]["storage_purpose"]
          region: string | null
          secret_key_ref: string | null
          station_id: string
          status: Database["public"]["Enums"]["storage_status"]
          updated_at: string
        }
        Insert: {
          access_key_ref?: string | null
          bucket?: string | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          metadata?: Json
          name: string
          provider: Database["public"]["Enums"]["storage_provider"]
          public_base_url?: string | null
          purpose?: Database["public"]["Enums"]["storage_purpose"]
          region?: string | null
          secret_key_ref?: string | null
          station_id: string
          status?: Database["public"]["Enums"]["storage_status"]
          updated_at?: string
        }
        Update: {
          access_key_ref?: string | null
          bucket?: string | null
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          metadata?: Json
          name?: string
          provider?: Database["public"]["Enums"]["storage_provider"]
          public_base_url?: string | null
          purpose?: Database["public"]["Enums"]["storage_purpose"]
          region?: string | null
          secret_key_ref?: string | null
          station_id?: string
          status?: Database["public"]["Enums"]["storage_status"]
          updated_at?: string
        }
        Relationships: []
      }
      stream_mounts: {
        Row: {
          bitrate: number
          created_at: string
          format: string
          id: string
          is_active: boolean
          is_default: boolean
          mount_path: string
          source_password: string | null
          station_id: string
          updated_at: string
        }
        Insert: {
          bitrate?: number
          created_at?: string
          format?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          mount_path: string
          source_password?: string | null
          station_id: string
          updated_at?: string
        }
        Update: {
          bitrate?: number
          created_at?: string
          format?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          mount_path?: string
          source_password?: string | null
          station_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      streaming_outputs: {
        Row: {
          bitrate: number
          channels: number
          codec: string
          config: Json
          created_at: string
          format: string
          health_status: string
          host: string
          id: string
          is_enabled: boolean
          is_public: boolean
          last_health_at: string | null
          last_listeners: number | null
          listener_stats_url: string | null
          mountpoint: string | null
          name: string
          notes: string | null
          password: string | null
          password_secret_name: string | null
          port: number
          priority: number
          proxy_url: string | null
          sample_rate: number
          station_id: string
          type: Database["public"]["Enums"]["streaming_output_type"]
          updated_at: string
          use_tls: boolean
          username: string | null
        }
        Insert: {
          bitrate?: number
          channels?: number
          codec?: string
          config?: Json
          created_at?: string
          format?: string
          health_status?: string
          host?: string
          id?: string
          is_enabled?: boolean
          is_public?: boolean
          last_health_at?: string | null
          last_listeners?: number | null
          listener_stats_url?: string | null
          mountpoint?: string | null
          name: string
          notes?: string | null
          password?: string | null
          password_secret_name?: string | null
          port?: number
          priority?: number
          proxy_url?: string | null
          sample_rate?: number
          station_id: string
          type?: Database["public"]["Enums"]["streaming_output_type"]
          updated_at?: string
          use_tls?: boolean
          username?: string | null
        }
        Update: {
          bitrate?: number
          channels?: number
          codec?: string
          config?: Json
          created_at?: string
          format?: string
          health_status?: string
          host?: string
          id?: string
          is_enabled?: boolean
          is_public?: boolean
          last_health_at?: string | null
          last_listeners?: number | null
          listener_stats_url?: string | null
          mountpoint?: string | null
          name?: string
          notes?: string | null
          password?: string | null
          password_secret_name?: string | null
          port?: number
          priority?: number
          proxy_url?: string | null
          sample_rate?: number
          station_id?: string
          type?: Database["public"]["Enums"]["streaming_output_type"]
          updated_at?: string
          use_tls?: boolean
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streaming_outputs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_messages: {
        Row: {
          body: string
          created_at: string
          from_name: string | null
          handled: boolean
          id: string
          kind: string
          station_id: string
        }
        Insert: {
          body: string
          created_at?: string
          from_name?: string | null
          handled?: boolean
          id?: string
          kind?: string
          station_id: string
        }
        Update: {
          body?: string
          created_at?: string
          from_name?: string | null
          handled?: boolean
          id?: string
          kind?: string
          station_id?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          job_type: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          message: string | null
          payload: Json | null
          result: Json | null
          scheduled_for: string
          started_at: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          job_type: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          message?: string | null
          payload?: Json | null
          result?: Json | null
          scheduled_for?: string
          started_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          job_type?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          message?: string | null
          payload?: Json | null
          result?: Json | null
          scheduled_for?: string
          started_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          level: Database["public"]["Enums"]["system_event_level"]
          message: string | null
          source: string
          station_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          level?: Database["public"]["Enums"]["system_event_level"]
          message?: string | null
          source?: string
          station_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          level?: Database["public"]["Enums"]["system_event_level"]
          message?: string | null
          source?: string
          station_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      track_metadata: {
        Row: {
          album: string | null
          artist: string | null
          created_at: string
          explicit_content: boolean
          genre: string | null
          id: string
          is_ai_generated: boolean
          is_local_music: boolean
          language: string | null
          media_file_id: string
          mood: string | null
          notes: string | null
          rights_status: Database["public"]["Enums"]["rights_status"]
          stim_status: string | null
          tempo: string | null
          title: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          album?: string | null
          artist?: string | null
          created_at?: string
          explicit_content?: boolean
          genre?: string | null
          id?: string
          is_ai_generated?: boolean
          is_local_music?: boolean
          language?: string | null
          media_file_id: string
          mood?: string | null
          notes?: string | null
          rights_status?: Database["public"]["Enums"]["rights_status"]
          stim_status?: string | null
          tempo?: string | null
          title?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          album?: string | null
          artist?: string | null
          created_at?: string
          explicit_content?: boolean
          genre?: string | null
          id?: string
          is_ai_generated?: boolean
          is_local_music?: boolean
          language?: string | null
          media_file_id?: string
          mood?: string | null
          notes?: string | null
          rights_status?: Database["public"]["Enums"]["rights_status"]
          stim_status?: string | null
          tempo?: string | null
          title?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "track_metadata_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: true
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voicetracks: {
        Row: {
          azuracast_media_id: string | null
          azuracast_path: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          presenter_id: string | null
          recorded_by: string | null
          station_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          azuracast_media_id?: string | null
          azuracast_path?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          presenter_id?: string | null
          recorded_by?: string | null
          station_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          azuracast_media_id?: string | null
          azuracast_path?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          presenter_id?: string | null
          recorded_by?: string | null
          station_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_sync_jobs: {
        Args: { _limit?: number; _worker?: string }
        Returns: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          job_type: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          message: string | null
          payload: Json | null
          result: Json | null
          scheduled_for: string
          started_at: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "sync_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_station_cascade: { Args: { sid: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_editor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      agent_status: "unknown" | "online" | "degraded" | "offline"
      app_role: "admin" | "editor" | "viewer"
      connection_status: "untested" | "ok" | "error"
      day_of_week: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
      media_status:
        | "imported"
        | "missing_metadata"
        | "ready"
        | "synced"
        | "error"
        | "paused"
      news_priority: "low" | "normal" | "high" | "breaking"
      news_status:
        | "draft"
        | "processing"
        | "ready_for_radio"
        | "broadcasted"
        | "archived"
        | "expired"
      playlist_type:
        | "rotation"
        | "jingle"
        | "sweeper"
        | "promo"
        | "special"
        | "paused"
      podcast_play_source: "schedule" | "manual" | "live"
      podcast_source_kind: "fablesh" | "rss"
      podcast_sync_status: "running" | "success" | "partial" | "error"
      rights_status:
        | "unknown"
        | "cleared"
        | "ai_generated"
        | "local_permission"
        | "creative_commons"
        | "needs_review"
        | "blocked"
      runtime_target_status: "unknown" | "ok" | "degraded" | "down" | "error"
      runtime_target_type:
        | "azuracast"
        | "icecast"
        | "liquidsoap"
        | "stereo_tool"
        | "custom"
      schedule_block_kind:
        | "music"
        | "jingle"
        | "ad"
        | "live"
        | "news"
        | "podcast"
      storage_provider: "r2" | "s3" | "local" | "azure_blob" | "external_url"
      storage_purpose: "media" | "artwork" | "cdn" | "backup" | "exports"
      storage_status: "unknown" | "online" | "warning" | "offline"
      streaming_output_type:
        | "icecast_kh"
        | "icecast"
        | "shoutcast"
        | "hls"
        | "relay"
        | "srt"
        | "rtmp"
        | "webrtc"
      sync_job_status: "pending" | "running" | "completed" | "failed"
      system_event_level: "info" | "warning" | "error" | "critical"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_status: ["unknown", "online", "degraded", "offline"],
      app_role: ["admin", "editor", "viewer"],
      connection_status: ["untested", "ok", "error"],
      day_of_week: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      media_status: [
        "imported",
        "missing_metadata",
        "ready",
        "synced",
        "error",
        "paused",
      ],
      news_priority: ["low", "normal", "high", "breaking"],
      news_status: [
        "draft",
        "processing",
        "ready_for_radio",
        "broadcasted",
        "archived",
        "expired",
      ],
      playlist_type: [
        "rotation",
        "jingle",
        "sweeper",
        "promo",
        "special",
        "paused",
      ],
      podcast_play_source: ["schedule", "manual", "live"],
      podcast_source_kind: ["fablesh", "rss"],
      podcast_sync_status: ["running", "success", "partial", "error"],
      rights_status: [
        "unknown",
        "cleared",
        "ai_generated",
        "local_permission",
        "creative_commons",
        "needs_review",
        "blocked",
      ],
      runtime_target_status: ["unknown", "ok", "degraded", "down", "error"],
      runtime_target_type: [
        "azuracast",
        "icecast",
        "liquidsoap",
        "stereo_tool",
        "custom",
      ],
      schedule_block_kind: ["music", "jingle", "ad", "live", "news", "podcast"],
      storage_provider: ["r2", "s3", "local", "azure_blob", "external_url"],
      storage_purpose: ["media", "artwork", "cdn", "backup", "exports"],
      storage_status: ["unknown", "online", "warning", "offline"],
      streaming_output_type: [
        "icecast_kh",
        "icecast",
        "shoutcast",
        "hls",
        "relay",
        "srt",
        "rtmp",
        "webrtc",
      ],
      sync_job_status: ["pending", "running", "completed", "failed"],
      system_event_level: ["info", "warning", "error", "critical"],
    },
  },
} as const
