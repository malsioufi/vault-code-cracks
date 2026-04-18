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
      daily_results: {
        Row: {
          allow_duplicates: boolean
          attempts_used: number
          code_length: number
          created_at: string
          guesses: Json
          max_tries: number
          puzzle_date: string
          user_id: string
          won: boolean
        }
        Insert: {
          allow_duplicates: boolean
          attempts_used: number
          code_length: number
          created_at?: string
          guesses?: Json
          max_tries: number
          puzzle_date: string
          user_id: string
          won: boolean
        }
        Update: {
          allow_duplicates?: boolean
          attempts_used?: number
          code_length?: number
          created_at?: string
          guesses?: Json
          max_tries?: number
          puzzle_date?: string
          user_id?: string
          won?: boolean
        }
        Relationships: []
      }
      guesses: {
        Row: {
          created_at: string
          glitches: number
          guess: number[]
          id: string
          matches: number
          player_id: string
          room_id: string
          round_number: number
          shifts: number
        }
        Insert: {
          created_at?: string
          glitches: number
          guess: number[]
          id?: string
          matches: number
          player_id: string
          room_id: string
          round_number?: number
          shifts: number
        }
        Update: {
          created_at?: string
          glitches?: number
          guess?: number[]
          id?: string
          matches?: number
          player_id?: string
          room_id?: string
          round_number?: number
          shifts?: number
        }
        Relationships: [
          {
            foreignKeyName: "guesses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          allow_duplicates: boolean
          code_length: number
          joined_at: string
          max_tries: number | null
          mode: Database["public"]["Enums"]["room_mode"]
          user_id: string
        }
        Insert: {
          allow_duplicates: boolean
          code_length: number
          joined_at?: string
          max_tries?: number | null
          mode: Database["public"]["Enums"]["room_mode"]
          user_id: string
        }
        Update: {
          allow_duplicates?: boolean
          code_length?: number
          joined_at?: string
          max_tries?: number | null
          mode?: Database["public"]["Enums"]["room_mode"]
          user_id?: string
        }
        Relationships: []
      }
      presence: {
        Row: {
          disconnected_at: string | null
          last_seen_at: string
          player_id: string
          room_id: string
        }
        Insert: {
          disconnected_at?: string | null
          last_seen_at?: string
          player_id: string
          room_id: string
        }
        Update: {
          disconnected_at?: string | null
          last_seen_at?: string
          player_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_guest: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          is_guest?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_guest?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      room_secrets: {
        Row: {
          created_at: string
          player_id: string
          room_id: string
          secret: number[]
        }
        Insert: {
          created_at?: string
          player_id: string
          room_id: string
          secret: number[]
        }
        Update: {
          created_at?: string
          player_id?: string
          room_id?: string
          secret?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "room_secrets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          allow_duplicates: boolean
          code: string
          code_length: number
          created_at: string
          current_turn: string | null
          finished_at: string | null
          guest_id: string | null
          host_id: string
          id: string
          is_quick_match: boolean
          max_tries: number | null
          mode: Database["public"]["Enums"]["room_mode"]
          status: Database["public"]["Enums"]["room_status"]
          turn_started_at: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          allow_duplicates?: boolean
          code: string
          code_length?: number
          created_at?: string
          current_turn?: string | null
          finished_at?: string | null
          guest_id?: string | null
          host_id: string
          id?: string
          is_quick_match?: boolean
          max_tries?: number | null
          mode?: Database["public"]["Enums"]["room_mode"]
          status?: Database["public"]["Enums"]["room_status"]
          turn_started_at?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          allow_duplicates?: boolean
          code?: string
          code_length?: number
          created_at?: string
          current_turn?: string | null
          finished_at?: string | null
          guest_id?: string | null
          host_id?: string
          id?: string
          is_quick_match?: boolean
          max_tries?: number | null
          mode?: Database["public"]["Enums"]["room_mode"]
          status?: Database["public"]["Enums"]["room_status"]
          turn_started_at?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_daily_leaderboard: {
        Args: { _date?: string }
        Returns: {
          attempts_used: number
          display_name: string
          finished_at: string
          is_guest: boolean
          rank: number
          user_id: string
        }[]
      }
      get_daily_streak: {
        Args: { _user_id: string }
        Returns: {
          best_streak: number
          current_streak: number
          total_played: number
          total_won: number
        }[]
      }
      is_room_participant: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      room_mode: "turn_based" | "simultaneous"
      room_status:
        | "waiting"
        | "setting_secrets"
        | "playing"
        | "finished"
        | "abandoned"
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
      room_mode: ["turn_based", "simultaneous"],
      room_status: [
        "waiting",
        "setting_secrets",
        "playing",
        "finished",
        "abandoned",
      ],
    },
  },
} as const
