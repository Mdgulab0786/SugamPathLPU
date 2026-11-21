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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_bootstrap_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          demo_mode: boolean
          id: number
          lift_status_freshness_hours: number
          updated_at: string
          updated_by: string | null
          verification_freshness_days: number
        }
        Insert: {
          demo_mode?: boolean
          id?: number
          lift_status_freshness_hours?: number
          updated_at?: string
          updated_by?: string | null
          verification_freshness_days?: number
        }
        Update: {
          demo_mode?: boolean
          id?: number
          lift_status_freshness_hours?: number
          updated_at?: string
          updated_by?: string | null
          verification_freshness_days?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: number
        }
        Relationships: []
      }
      barrier_reports: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["report_category"]
          code: string
          created_at: string
          description: string
          edge_id: string | null
          id: string
          is_anonymous: boolean
          lat: number | null
          lift_id: string | null
          lng: number | null
          location_text: string | null
          node_id: string | null
          occurred_at: string
          priority: Database["public"]["Enums"]["report_priority"] | null
          reporter_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["report_category"]
          code?: string
          created_at?: string
          description: string
          edge_id?: string | null
          id?: string
          is_anonymous?: boolean
          lat?: number | null
          lift_id?: string | null
          lng?: number | null
          location_text?: string | null
          node_id?: string | null
          occurred_at?: string
          priority?: Database["public"]["Enums"]["report_priority"] | null
          reporter_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["report_category"]
          code?: string
          created_at?: string
          description?: string
          edge_id?: string | null
          id?: string
          is_anonymous?: boolean
          lat?: number | null
          lift_id?: string | null
          lng?: number | null
          location_text?: string | null
          node_id?: string | null
          occurred_at?: string
          priority?: Database["public"]["Enums"]["report_priority"] | null
          reporter_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barrier_reports_edge_id_fkey"
            columns: ["edge_id"]
            isOneToOne: false
            referencedRelation: "route_edges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barrier_reports_lift_id_fkey"
            columns: ["lift_id"]
            isOneToOne: false
            referencedRelation: "lifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barrier_reports_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "campus_entrances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barrier_reports_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "campus_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barrier_reports_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "route_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      lift_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          issue: string | null
          lift_id: string
          new_status: Database["public"]["Enums"]["lift_status"]
          old_status: Database["public"]["Enums"]["lift_status"] | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          issue?: string | null
          lift_id: string
          new_status: Database["public"]["Enums"]["lift_status"]
          old_status?: Database["public"]["Enums"]["lift_status"] | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          issue?: string | null
          lift_id?: string
          new_status?: Database["public"]["Enums"]["lift_status"]
          old_status?: Database["public"]["Enums"]["lift_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lift_status_history_lift_id_fkey"
            columns: ["lift_id"]
            isOneToOne: false
            referencedRelation: "lifts"
            referencedColumns: ["id"]
          },
        ]
      }
      lifts: {
        Row: {
          alternative_info: string | null
          created_at: string
          id: string
          is_demo: boolean
          issue: string | null
          label: string
          location_description: string | null
          node_id: string | null
          status: Database["public"]["Enums"]["lift_status"]
          status_updated_at: string | null
          status_updated_by: string | null
          updated_at: string
        }
        Insert: {
          alternative_info?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          issue?: string | null
          label: string
          location_description?: string | null
          node_id?: string | null
          status?: Database["public"]["Enums"]["lift_status"]
          status_updated_at?: string | null
          status_updated_by?: string | null
          updated_at?: string
        }
        Update: {
          alternative_info?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          issue?: string | null
          label?: string
          location_description?: string | null
          node_id?: string | null
          status?: Database["public"]["Enums"]["lift_status"]
          status_updated_at?: string | null
          status_updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifts_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "campus_entrances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifts_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "campus_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifts_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "route_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          id: string
          report_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          report_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_assignments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "barrier_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_attachments: {
        Row: {
          created_at: string
          id: string
          kind: string
          report_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          report_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          report_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "barrier_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          report_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          report_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_notes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "barrier_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_rate_limits: {
        Row: {
          created_at: string
          id: number
          ip_hash: string
        }
        Insert: {
          created_at?: string
          id?: number
          ip_hash: string
        }
        Update: {
          created_at?: string
          id?: number
          ip_hash?: string
        }
        Relationships: []
      }
      report_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["report_status"]
          old_status: Database["public"]["Enums"]["report_status"] | null
          report_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["report_status"]
          old_status?: Database["public"]["Enums"]["report_status"] | null
          report_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["report_status"]
          old_status?: Database["public"]["Enums"]["report_status"] | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "barrier_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      route_edges: {
        Row: {
          barrier_note: string | null
          barrier_status: Database["public"]["Enums"]["barrier_state"]
          classification: Database["public"]["Enums"]["access_class"]
          clear_width_m: number | null
          created_at: string
          created_by: string | null
          distance_m: number
          evidence_ref: string | null
          from_node_id: string
          has_kerb: boolean | null
          has_ramp: boolean
          has_steps: boolean | null
          id: string
          is_demo: boolean
          last_verified_at: string | null
          lift_id: string | null
          name: string | null
          notes: string | null
          ramp_verified: boolean
          slope_percent: number | null
          step_count: number | null
          surface: Database["public"]["Enums"]["surface_type"]
          to_node_id: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_state"]
        }
        Insert: {
          barrier_note?: string | null
          barrier_status?: Database["public"]["Enums"]["barrier_state"]
          classification?: Database["public"]["Enums"]["access_class"]
          clear_width_m?: number | null
          created_at?: string
          created_by?: string | null
          distance_m: number
          evidence_ref?: string | null
          from_node_id: string
          has_kerb?: boolean | null
          has_ramp?: boolean
          has_steps?: boolean | null
          id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          lift_id?: string | null
          name?: string | null
          notes?: string | null
          ramp_verified?: boolean
          slope_percent?: number | null
          step_count?: number | null
          surface?: Database["public"]["Enums"]["surface_type"]
          to_node_id: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Update: {
          barrier_note?: string | null
          barrier_status?: Database["public"]["Enums"]["barrier_state"]
          classification?: Database["public"]["Enums"]["access_class"]
          clear_width_m?: number | null
          created_at?: string
          created_by?: string | null
          distance_m?: number
          evidence_ref?: string | null
          from_node_id?: string
          has_kerb?: boolean | null
          has_ramp?: boolean
          has_steps?: boolean | null
          id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          lift_id?: string | null
          name?: string | null
          notes?: string | null
          ramp_verified?: boolean
          slope_percent?: number | null
          step_count?: number | null
          surface?: Database["public"]["Enums"]["surface_type"]
          to_node_id?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Relationships: [
          {
            foreignKeyName: "route_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "campus_entrances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "campus_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "route_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_edges_lift_id_fkey"
            columns: ["lift_id"]
            isOneToOne: false
            referencedRelation: "lifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "campus_entrances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "campus_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "route_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_nodes: {
        Row: {
          accessible_entrance: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_demo: boolean
          is_destination: boolean
          kind: Database["public"]["Enums"]["node_kind"]
          last_verified_at: string | null
          lat: number
          lng: number
          name: string
          ref: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_state"]
        }
        Insert: {
          accessible_entrance?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          is_destination?: boolean
          kind?: Database["public"]["Enums"]["node_kind"]
          last_verified_at?: string | null
          lat: number
          lng: number
          name: string
          ref?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Update: {
          accessible_entrance?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          is_destination?: boolean
          kind?: Database["public"]["Enums"]["node_kind"]
          last_verified_at?: string | null
          lat?: number
          lng?: number
          name?: string
          ref?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Relationships: []
      }
      route_verifications: {
        Row: {
          created_at: string
          edge_id: string | null
          evidence_ref: string
          id: string
          node_id: string | null
          observations: string | null
          recorded_by: string | null
          verified_by: string
          verified_on: string
        }
        Insert: {
          created_at?: string
          edge_id?: string | null
          evidence_ref: string
          id?: string
          node_id?: string | null
          observations?: string | null
          recorded_by?: string | null
          verified_by: string
          verified_on: string
        }
        Update: {
          created_at?: string
          edge_id?: string | null
          evidence_ref?: string
          id?: string
          node_id?: string | null
          observations?: string | null
          recorded_by?: string | null
          verified_by?: string
          verified_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_verifications_edge_id_fkey"
            columns: ["edge_id"]
            isOneToOne: false
            referencedRelation: "route_edges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_verifications_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "campus_entrances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_verifications_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "campus_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_verifications_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "route_nodes"
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
    }
    Views: {
      campus_entrances: {
        Row: {
          accessible_entrance: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          is_demo: boolean | null
          is_destination: boolean | null
          kind: Database["public"]["Enums"]["node_kind"] | null
          last_verified_at: string | null
          lat: number | null
          lng: number | null
          name: string | null
          ref: string | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_state"]
            | null
        }
        Insert: {
          accessible_entrance?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_demo?: boolean | null
          is_destination?: boolean | null
          kind?: Database["public"]["Enums"]["node_kind"] | null
          last_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          ref?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_state"]
            | null
        }
        Update: {
          accessible_entrance?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_demo?: boolean | null
          is_destination?: boolean | null
          kind?: Database["public"]["Enums"]["node_kind"] | null
          last_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          ref?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_state"]
            | null
        }
        Relationships: []
      }
      campus_locations: {
        Row: {
          accessible_entrance: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          is_demo: boolean | null
          is_destination: boolean | null
          kind: Database["public"]["Enums"]["node_kind"] | null
          last_verified_at: string | null
          lat: number | null
          lng: number | null
          name: string | null
          ref: string | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_state"]
            | null
        }
        Insert: {
          accessible_entrance?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_demo?: boolean | null
          is_destination?: boolean | null
          kind?: Database["public"]["Enums"]["node_kind"] | null
          last_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          ref?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_state"]
            | null
        }
        Update: {
          accessible_entrance?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          is_demo?: boolean | null
          is_destination?: boolean | null
          kind?: Database["public"]["Enums"]["node_kind"] | null
          last_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          ref?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_state"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_lifts: { Args: { _user_id: string }; Returns: boolean }
      get_public_barriers: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          edge_id: string
          id: string
          lat: number
          lift_id: string
          lng: number
          location_text: string
          node_id: string
          status: Database["public"]["Enums"]["report_status"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      list_staff: {
        Args: never
        Returns: {
          display_name: string
          email: string
          id: string
        }[]
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
        }[]
      }
      track_report: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      access_class: "accessible" | "limited" | "inaccessible" | "unknown"
      app_role: "student" | "estate_staff" | "lift_operator" | "admin"
      barrier_state: "clear" | "caution" | "blocked"
      lift_status:
        | "operational"
        | "out_of_service"
        | "under_maintenance"
        | "unknown"
      node_kind:
        | "building"
        | "entrance"
        | "junction"
        | "lift"
        | "ramp"
        | "checkpoint"
        | "destination"
        | "other"
      report_category:
        | "broken_ramp"
        | "ramp_ends_at_step"
        | "blocked_pathway"
        | "damaged_pavement"
        | "locked_entrance"
        | "lift_not_working"
        | "missing_signage"
        | "narrow_pathway"
        | "other"
      report_priority: "critical" | "high" | "medium" | "low"
      report_status:
        | "new"
        | "under_review"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "rejected"
        | "duplicate"
      surface_type:
        | "smooth_paved"
        | "paved"
        | "paving_blocks"
        | "gravel"
        | "rough"
        | "grass"
        | "indoor"
        | "unknown"
      verification_state: "unverified" | "verified"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      access_class: ["accessible", "limited", "inaccessible", "unknown"],
      app_role: ["student", "estate_staff", "lift_operator", "admin"],
      barrier_state: ["clear", "caution", "blocked"],
      lift_status: [
        "operational",
        "out_of_service",
        "under_maintenance",
        "unknown",
      ],
      node_kind: [
        "building",
        "entrance",
        "junction",
        "lift",
        "ramp",
        "checkpoint",
        "destination",
        "other",
      ],
      report_category: [
        "broken_ramp",
        "ramp_ends_at_step",
        "blocked_pathway",
        "damaged_pavement",
        "locked_entrance",
        "lift_not_working",
        "missing_signage",
        "narrow_pathway",
        "other",
      ],
      report_priority: ["critical", "high", "medium", "low"],
      report_status: [
        "new",
        "under_review",
        "assigned",
        "in_progress",
        "resolved",
        "rejected",
        "duplicate",
      ],
      surface_type: [
        "smooth_paved",
        "paved",
        "paving_blocks",
        "gravel",
        "rough",
        "grass",
        "indoor",
        "unknown",
      ],
      verification_state: ["unverified", "verified"],
    },
  },
} as const
