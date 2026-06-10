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
      bookmarks: {
        Row: {
          created_at: string
          id: string
          user_id: string
          writeup_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          writeup_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          writeup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_writeup_id_fkey"
            columns: ["writeup_id"]
            isOneToOne: false
            referencedRelation: "writeups"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_attempts: {
        Row: {
          category: Database["public"]["Enums"]["category"]
          challenge_name: string
          claimed_by: string | null
          created_at: string
          event_id: string
          id: string
          points: number | null
          status: Database["public"]["Enums"]["challenge_status"]
          team_id: string
          updated_at: string
          writeup_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["category"]
          challenge_name: string
          claimed_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          points?: number | null
          status?: Database["public"]["Enums"]["challenge_status"]
          team_id: string
          updated_at?: string
          writeup_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["category"]
          challenge_name?: string
          claimed_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          points?: number | null
          status?: Database["public"]["Enums"]["challenge_status"]
          team_id?: string
          updated_at?: string
          writeup_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_attempts_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ctf_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_attempts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_attempts_writeup_id_fkey"
            columns: ["writeup_id"]
            isOneToOne: false
            referencedRelation: "writeups"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          writeup_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          writeup_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          writeup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_writeup_id_fkey"
            columns: ["writeup_id"]
            isOneToOne: false
            referencedRelation: "writeups"
            referencedColumns: ["id"]
          },
        ]
      }
      ctf_events: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          team_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          team_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          team_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          user_id: string
          writeup_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          user_id: string
          writeup_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
          writeup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_writeup_id_fkey"
            columns: ["writeup_id"]
            isOneToOne: false
            referencedRelation: "writeups"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          slug?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          provider: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          provider: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          provider?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      writeup_tags: {
        Row: {
          tag_id: string
          writeup_id: string
        }
        Insert: {
          tag_id: string
          writeup_id: string
        }
        Update: {
          tag_id?: string
          writeup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "writeup_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writeup_tags_writeup_id_fkey"
            columns: ["writeup_id"]
            isOneToOne: false
            referencedRelation: "writeups"
            referencedColumns: ["id"]
          },
        ]
      }
      writeups: {
        Row: {
          author_id: string
          body_md: string
          category: Database["public"]["Enums"]["category"]
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          event_id: string | null
          flag: string | null
          id: string
          is_published: boolean
          points: number
          publish_at: string | null
          search_tsv: unknown
          slug: string
          summary: string | null
          tags: string[]
          team_id: string | null
          title: string
          tools_used: string[]
          updated_at: string
        }
        Insert: {
          author_id: string
          body_md?: string
          category?: Database["public"]["Enums"]["category"]
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          event_id?: string | null
          flag?: string | null
          id?: string
          is_published?: boolean
          points?: number
          publish_at?: string | null
          search_tsv?: unknown
          slug: string
          summary?: string | null
          tags?: string[]
          team_id?: string | null
          title: string
          tools_used?: string[]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body_md?: string
          category?: Database["public"]["Enums"]["category"]
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          event_id?: string | null
          flag?: string | null
          id?: string
          is_published?: boolean
          points?: number
          publish_at?: string | null
          search_tsv?: unknown
          slug?: string
          summary?: string | null
          tags?: string[]
          team_id?: string | null
          title?: string
          tools_used?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "writeups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ctf_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writeups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_team_id: { Args: never; Returns: string }
      is_team_member: { Args: { _team_id: string }; Returns: boolean }
      join_team_by_code: { Args: { _code: string }; Returns: string }
      remove_team_member: { Args: { _target: string }; Returns: boolean }
    }
    Enums: {
      category:
        | "web"
        | "pwn"
        | "crypto"
        | "forensics"
        | "rev"
        | "misc"
        | "osint"
      challenge_status: "unsolved" | "attempting" | "solved"
      difficulty: "easy" | "medium" | "hard" | "insane"
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
      category: ["web", "pwn", "crypto", "forensics", "rev", "misc", "osint"],
      challenge_status: ["unsolved", "attempting", "solved"],
      difficulty: ["easy", "medium", "hard", "insane"],
    },
  },
} as const
