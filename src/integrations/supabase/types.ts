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
      schedule_blocks: {
        Row: {
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          is_active: boolean
          name: string
          playlist_id: string | null
          rotation_rule_id: string | null
          start_time: string
          station_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          playlist_id?: string | null
          rotation_rule_id?: string | null
          start_time: string
          station_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          playlist_id?: string | null
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
          station_id: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          station_id?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          station_id?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          account_id: string | null
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
      stereo_tool_configs: {
        Row: {
          active_preset_id: string | null
          binary_path: string | null
          bypass: boolean
          created_at: string
          custom_args: string | null
          docker_volume_path: string | null
          enabled: boolean
          id: string
          input_source: string | null
          integration_mode: string
          last_status_at: string | null
          latency_ms: number
          library_path: string | null
          license_key_secret_name: string | null
          output_target: string | null
          sample_rate: number
          station_id: string
          status: string
          status_message: string | null
          updated_at: string
        }
        Insert: {
          active_preset_id?: string | null
          binary_path?: string | null
          bypass?: boolean
          created_at?: string
          custom_args?: string | null
          docker_volume_path?: string | null
          enabled?: boolean
          id?: string
          input_source?: string | null
          integration_mode?: string
          last_status_at?: string | null
          latency_ms?: number
          library_path?: string | null
          license_key_secret_name?: string | null
          output_target?: string | null
          sample_rate?: number
          station_id: string
          status?: string
          status_message?: string | null
          updated_at?: string
        }
        Update: {
          active_preset_id?: string | null
          binary_path?: string | null
          bypass?: boolean
          created_at?: string
          custom_args?: string | null
          docker_volume_path?: string | null
          enabled?: boolean
          id?: string
          input_source?: string | null
          integration_mode?: string
          last_status_at?: string | null
          latency_ms?: number
          library_path?: string | null
          license_key_secret_name?: string | null
          output_target?: string | null
          sample_rate?: number
          station_id?: string
          status?: string
          status_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stereo_tool_configs_active_preset_fk"
            columns: ["active_preset_id"]
            isOneToOne: false
            referencedRelation: "stereo_tool_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stereo_tool_configs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: true
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stereo_tool_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          level: string
          message: string | null
          station_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          level?: string
          message?: string | null
          station_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          level?: string
          message?: string | null
          station_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stereo_tool_events_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stereo_tool_presets: {
        Row: {
          checksum: string | null
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          id: string
          is_default: boolean
          name: string
          station_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_default?: boolean
          name: string
          station_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          checksum?: string | null
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_default?: boolean
          name?: string
          station_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stereo_tool_presets_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
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
          created_at: string
          finished_at: string | null
          id: string
          job_type: string
          message: string | null
          payload: Json | null
          result: Json | null
          started_at: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          job_type: string
          message?: string | null
          payload?: Json | null
          result?: Json | null
          started_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          job_type?: string
          message?: string | null
          payload?: Json | null
          result?: Json | null
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
      playlist_type:
        | "rotation"
        | "jingle"
        | "sweeper"
        | "promo"
        | "special"
        | "paused"
      rights_status:
        | "unknown"
        | "cleared"
        | "ai_generated"
        | "local_permission"
        | "creative_commons"
        | "needs_review"
        | "blocked"
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
      playlist_type: [
        "rotation",
        "jingle",
        "sweeper",
        "promo",
        "special",
        "paused",
      ],
      rights_status: [
        "unknown",
        "cleared",
        "ai_generated",
        "local_permission",
        "creative_commons",
        "needs_review",
        "blocked",
      ],
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
    },
  },
} as const
