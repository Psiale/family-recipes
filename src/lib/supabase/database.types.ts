export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          platform_role: Database["public"]["Enums"]["platform_role"]
          preferred_locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          platform_role?: Database["public"]["Enums"]["platform_role"]
          preferred_locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          platform_role?: Database["public"]["Enums"]["platform_role"]
          preferred_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string
          id: string
          metadata: Json
          occurred_at: string
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id: string
          id?: string
          metadata?: Json
          occurred_at?: string
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      branch_memberships: {
        Row: {
          branch_id: string
          created_at: string
          created_by_user_id: string | null
          family_id: string
          person_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by_user_id?: string | null
          family_id: string
          person_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by_user_id?: string | null
          family_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_memberships_branch_id_family_id_fkey"
            columns: ["branch_id", "family_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "branch_memberships_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_memberships_family_id_person_id_fkey"
            columns: ["family_id", "person_id"]
            isOneToOne: false
            referencedRelation: "family_memberships"
            referencedColumns: ["family_id", "person_id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          family_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          family_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          family_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          custom_name: string | null
          description: string | null
          family_id: string
          id: string
          localization_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          custom_name?: string | null
          description?: string | null
          family_id: string
          id?: string
          localization_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          custom_name?: string | null
          description?: string | null
          family_id?: string
          id?: string
          localization_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          family_id: string
          id: string
          intended_role: Database["public"]["Enums"]["family_role"]
          invited_by_user_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          email: string
          expires_at: string
          family_id: string
          id?: string
          intended_role?: Database["public"]["Enums"]["family_role"]
          invited_by_user_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          intended_role?: Database["public"]["Enums"]["family_role"]
          invited_by_user_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invitations_accepted_by_user_id_fkey"
            columns: ["accepted_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invitations_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_memberships: {
        Row: {
          created_by_user_id: string | null
          ended_at: string | null
          family_id: string
          joined_at: string
          person_id: string
          role: Database["public"]["Enums"]["family_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          created_by_user_id?: string | null
          ended_at?: string | null
          family_id: string
          joined_at?: string
          person_id: string
          role: Database["public"]["Enums"]["family_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          created_by_user_id?: string | null
          ended_at?: string | null
          family_id?: string
          joined_at?: string
          person_id?: string
          role?: Database["public"]["Enums"]["family_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_memberships_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_memberships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          biography: string | null
          created_at: string
          created_by_user_id: string | null
          display_name: string
          id: string
          profile_photo_path: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          biography?: string | null
          created_at?: string
          created_by_user_id?: string | null
          display_name: string
          id?: string
          profile_photo_path?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          biography?: string | null
          created_at?: string
          created_by_user_id?: string | null
          display_name?: string
          id?: string
          profile_photo_path?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      person_managers: {
        Row: {
          created_at: string
          granted_by_user_id: string | null
          manager_user_id: string
          person_id: string
        }
        Insert: {
          created_at?: string
          granted_by_user_id?: string | null
          manager_user_id: string
          person_id: string
        }
        Update: {
          created_at?: string
          granted_by_user_id?: string | null
          manager_user_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_managers_granted_by_user_id_fkey"
            columns: ["granted_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_managers_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_managers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_collections: {
        Row: {
          added_by_user_id: string
          collection_id: string
          created_at: string
          family_id: string
          recipe_id: string
        }
        Insert: {
          added_by_user_id: string
          collection_id: string
          created_at?: string
          family_id: string
          recipe_id: string
        }
        Update: {
          added_by_user_id?: string
          collection_id?: string
          created_at?: string
          family_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_collections_added_by_user_id_fkey"
            columns: ["added_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_collections_collection_id_family_id_fkey"
            columns: ["collection_id", "family_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "recipe_collections_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient: string
          position: number
          preparation_note: string | null
          quantity: string | null
          recipe_id: string
          section_name: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient: string
          position: number
          preparation_note?: string | null
          quantity?: string | null
          recipe_id: string
          section_name?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient?: string
          position?: number
          preparation_note?: string | null
          quantity?: string | null
          recipe_id?: string
          section_name?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_media: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          position: number
          recipe_id: string
          storage_path: string
          updated_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          position?: number
          recipe_id: string
          storage_path: string
          updated_at?: string
          uploaded_by_user_id: string
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          position?: number
          recipe_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_media_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_media_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_revisions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by_user_id: string
          id: string
          recipe_id: string
          revision_number: number
          snapshot: Json
          snapshot_schema_version: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          recipe_id: string
          revision_number: number
          snapshot: Json
          snapshot_schema_version?: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          recipe_id?: string
          revision_number?: number
          snapshot?: Json
          snapshot_schema_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_revisions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_revisions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          created_at: string
          duration_minutes: number | null
          id: string
          instruction: string
          position: number
          recipe_id: string
          section_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          instruction: string
          position: number
          recipe_id: string
          section_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          instruction?: string
          position?: number
          recipe_id?: string
          section_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_suggestions: {
        Row: {
          base_revision_id: string
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          decision_note: string | null
          id: string
          note: string | null
          outcome_recipe_id: string | null
          recipe_id: string
          status: Database["public"]["Enums"]["suggestion_status"]
          submitted_by_user_id: string
          suggested_changes: Json
          updated_at: string
        }
        Insert: {
          base_revision_id: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decision_note?: string | null
          id?: string
          note?: string | null
          outcome_recipe_id?: string | null
          recipe_id: string
          status?: Database["public"]["Enums"]["suggestion_status"]
          submitted_by_user_id: string
          suggested_changes: Json
          updated_at?: string
        }
        Update: {
          base_revision_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          decision_note?: string | null
          id?: string
          note?: string | null
          outcome_recipe_id?: string | null
          recipe_id?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
          submitted_by_user_id?: string
          suggested_changes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_suggestions_base_revision_id_recipe_id_fkey"
            columns: ["base_revision_id", "recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_revisions"
            referencedColumns: ["id", "recipe_id"]
          },
          {
            foreignKeyName: "recipe_suggestions_decided_by_user_id_fkey"
            columns: ["decided_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_suggestions_outcome_recipe_id_fkey"
            columns: ["outcome_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_suggestions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_suggestions_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_visibilities: {
        Row: {
          branch_id: string | null
          created_at: string
          family_id: string
          granted_by_user_id: string
          id: string
          recipe_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          family_id: string
          granted_by_user_id: string
          id?: string
          recipe_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          family_id?: string
          granted_by_user_id?: string
          id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_visibilities_branch_id_family_id_fkey"
            columns: ["branch_id", "family_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "recipe_visibilities_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_visibilities_granted_by_user_id_fkey"
            columns: ["granted_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_visibilities_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          archived_at: string | null
          cook_time_minutes: number | null
          created_at: string
          description: string | null
          entered_by_user_id: string
          id: string
          origin_location: string | null
          origin_year: number | null
          original_creator_person_id: string
          owner_person_id: string
          prep_time_minutes: number | null
          preservation_status: Database["public"]["Enums"]["preservation_status"]
          preserved_at: string | null
          preserved_by_user_id: string | null
          rest_time_minutes: number | null
          servings: string | null
          source_recipe_id: string | null
          story: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          entered_by_user_id: string
          id?: string
          origin_location?: string | null
          origin_year?: number | null
          original_creator_person_id: string
          owner_person_id: string
          prep_time_minutes?: number | null
          preservation_status?: Database["public"]["Enums"]["preservation_status"]
          preserved_at?: string | null
          preserved_by_user_id?: string | null
          rest_time_minutes?: number | null
          servings?: string | null
          source_recipe_id?: string | null
          story?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          entered_by_user_id?: string
          id?: string
          origin_location?: string | null
          origin_year?: number | null
          original_creator_person_id?: string
          owner_person_id?: string
          prep_time_minutes?: number | null
          preservation_status?: Database["public"]["Enums"]["preservation_status"]
          preserved_at?: string | null
          preserved_by_user_id?: string | null
          rest_time_minutes?: number | null
          servings?: string | null
          source_recipe_id?: string | null
          story?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_entered_by_user_id_fkey"
            columns: ["entered_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_original_creator_person_id_fkey"
            columns: ["original_creator_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_preserved_by_user_id_fkey"
            columns: ["preserved_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_source_recipe_id_fkey"
            columns: ["source_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_managed_person: { Args: { p_token: string }; Returns: string }
      create_family: {
        Args: { p_description?: string; p_name: string }
        Returns: string
      }
      create_managed_person: {
        Args: {
          p_biography?: string
          p_display_name: string
          p_family_id: string
        }
        Returns: string
      }
      issue_person_claim: {
        Args: { p_email: string; p_person_id: string }
        Returns: string
      }
      onboard_person: {
        Args: { p_biography?: string; p_display_name: string }
        Returns: string
      }
    }
    Enums: {
      family_role: "OWNER" | "ADMIN" | "MEMBER" | "READ_ONLY"
      invitation_status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
      media_kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"
      membership_status: "ACTIVE" | "INACTIVE" | "REMOVED"
      platform_role: "USER" | "SUPER_ADMIN"
      preservation_status: "EDITABLE" | "PRESERVED"
      suggestion_status: "PENDING" | "ACCEPTED" | "REJECTED"
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
      family_role: ["OWNER", "ADMIN", "MEMBER", "READ_ONLY"],
      invitation_status: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"],
      media_kind: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
      membership_status: ["ACTIVE", "INACTIVE", "REMOVED"],
      platform_role: ["USER", "SUPER_ADMIN"],
      preservation_status: ["EDITABLE", "PRESERVED"],
      suggestion_status: ["PENDING", "ACCEPTED", "REJECTED"],
    },
  },
} as const

