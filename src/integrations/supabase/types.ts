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
      achievements: {
        Row: {
          badge_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          current_streak: number
          joined_at: string
          last_log_date: string | null
          longest_streak: number
          total_progress: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          current_streak?: number
          joined_at?: string
          last_log_date?: string | null
          longest_streak?: number
          total_progress?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          current_streak?: number
          joined_at?: string
          last_log_date?: string | null
          longest_streak?: number
          total_progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_progress_logs: {
        Row: {
          amount: number
          challenge_id: string
          created_at: string
          id: string
          log_date: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          challenge_id: string
          created_at?: string
          id?: string
          log_date?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          challenge_id?: string
          created_at?: string
          id?: string
          log_date?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_logs_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          cadence: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          goal_per_period: number
          goal_unit: string
          id: string
          invite_code: string
          is_public: boolean
          max_participants: number | null
          name: string
          participant_count: number
          start_date: string
          updated_at: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          goal_per_period?: number
          goal_unit?: string
          id?: string
          invite_code?: string
          is_public?: boolean
          max_participants?: number | null
          name: string
          participant_count?: number
          start_date: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          goal_per_period?: number
          goal_unit?: string
          id?: string
          invite_code?: string
          is_public?: boolean
          max_participants?: number | null
          name?: string
          participant_count?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          banner_url: string | null
          category: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string
          is_private: boolean
          member_count: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string
          is_private?: boolean
          member_count?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_private?: boolean
          member_count?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_challenge_participants: {
        Row: {
          challenge_id: string
          joined_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          challenge_id: string
          joined_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          challenge_id?: string
          joined_at?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "community_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      community_challenges: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          description: string | null
          ends_on: string
          id: string
          starts_on: string
          target_xp: number
          title: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          description?: string | null
          ends_on: string
          id?: string
          starts_on: string
          target_xp?: number
          title: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          ends_on?: string
          id?: string
          starts_on?: string
          target_xp?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_challenges_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          joined_at: string
          role: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Insert: {
          community_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Update: {
          community_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          body: string
          community_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          community_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          community_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_mutes: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          muted_until: string
          reason: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          muted_until: string
          reason?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          muted_until?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      community_post_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          body: string
          community_id: string
          created_at: string
          id: string
          like_count: number
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          community_id: string
          created_at?: string
          id?: string
          like_count?: number
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          community_id?: string
          created_at?: string
          id?: string
          like_count?: number
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          auto_kind: string | null
          body: string
          community_id: string
          created_at: string
          id: string
          like_count: number
          title: string | null
          user_id: string
        }
        Insert: {
          auto_kind?: string | null
          body: string
          community_id: string
          created_at?: string
          id?: string
          like_count?: number
          title?: string | null
          user_id: string
        }
        Update: {
          auto_kind?: string | null
          body?: string
          community_id?: string
          created_at?: string
          id?: string
          like_count?: number
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_checkins: {
        Row: {
          completed_on: string
          created_at: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_on?: string
          created_at?: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed_on?: string
          created_at?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_checkins_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          description: string | null
          frequency: string
          icon: string
          id: string
          name: string
          target_per_period: number
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string | null
          frequency?: string
          icon?: string
          id?: string
          name: string
          target_per_period?: number
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string | null
          frequency?: string
          icon?: string
          id?: string
          name?: string
          target_per_period?: number
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          mood: number | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      moderation_blocked_words: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          pattern: string
          severity: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          pattern: string
          severity?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          pattern?: string
          severity?: string
        }
        Relationships: []
      }
      moderation_log: {
        Row: {
          cleaned_text: string | null
          community_id: string | null
          created_at: string
          id: string
          matched_terms: string[]
          original_text: string
          severity: string
          surface: string
          user_id: string
        }
        Insert: {
          cleaned_text?: string | null
          community_id?: string | null
          created_at?: string
          id?: string
          matched_terms?: string[]
          original_text: string
          severity: string
          surface: string
          user_id: string
        }
        Update: {
          cleaned_text?: string | null
          community_id?: string | null
          created_at?: string
          id?: string
          matched_terms?: string[]
          original_text?: string
          severity?: string
          surface?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_invites: {
        Row: {
          created_at: string
          from_user: string
          id: string
          message: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["partner_invite_status"]
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["partner_invite_status"]
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["partner_invite_status"]
          to_user?: string
        }
        Relationships: []
      }
      partnerships: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      planner_events: {
        Row: {
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          end_time: string | null
          event_date: string
          id: string
          notes: string | null
          start_time: string | null
          title: string
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          end_time?: string | null
          event_date?: string
          id?: string
          notes?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          end_time?: string | null
          event_date?: string
          id?: string
          notes?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          granted_at: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_streak: number
          display_name: string | null
          id: string
          last_active_date: string | null
          level: number
          longest_streak: number
          updated_at: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          id: string
          last_active_date?: string | null
          level?: number
          longest_streak?: number
          updated_at?: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          id?: string
          last_active_date?: string | null
          level?: number
          longest_streak?: number
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          priority: string
          title: string
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          title: string
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      xp_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          occurred_on: string
          source_id: string
          source_table: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          occurred_on?: string
          source_id: string
          source_table: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          occurred_on?: string
          source_id?: string
          source_table?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      community_member_stats: {
        Row: {
          avatar_url: string | null
          community_id: string | null
          current_streak: number | null
          display_name: string | null
          joined_at: string | null
          level: number | null
          longest_streak: number | null
          role: Database["public"]["Enums"]["community_role"] | null
          user_id: string | null
          xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_partner_invite: { Args: { p_invite: string }; Returns: string }
      award_xp: {
        Args: { p_amount: number; p_user: string }
        Returns: undefined
      }
      calc_level: { Args: { p_xp: number }; Returns: number }
      challenge_leaderboard: {
        Args: { p_challenge: string }
        Returns: {
          current_streak: number
          display_name: string
          last_log_date: string
          longest_streak: number
          total_progress: number
          user_id: string
        }[]
      }
      get_challenge_invite_code: {
        Args: { p_challenge: string }
        Returns: string
      }
      get_community_invite_code: {
        Args: { p_community: string }
        Returns: string
      }
      get_moderation_matched_terms: {
        Args: { p_log_id: string }
        Returns: string[]
      }
      get_public_profiles: {
        Args: { p_ids: string[] }
        Returns: {
          current_streak: number
          display_name: string
          id: string
          level: number
          xp: number
        }[]
      }
      is_challenge_participant: {
        Args: { _challenge: string; _user: string }
        Returns: boolean
      }
      is_community_admin: {
        Args: { _community: string; _user: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { _community: string; _user: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user: string }; Returns: boolean }
      join_challenge_by_code: { Args: { p_code: string }; Returns: string }
      join_community_by_code: {
        Args: { p_code: string }
        Returns: {
          id: string
          slug: string
        }[]
      }
      moderation_normalize: { Args: { p: string }; Returns: string }
      moderation_repeat_offenders: {
        Args: { p_days?: number }
        Returns: {
          blocked_count: number
          censored_count: number
          display_name: string
          last_at: string
          user_id: string
        }[]
      }
      moderation_scan: {
        Args: { p: string }
        Returns: {
          cleaned: string
          matched: string[]
          severity: string
        }[]
      }
      moderation_word_regex: { Args: { p_word: string }; Returns: string }
      recompute_user_stats: { Args: { p_user: string }; Returns: undefined }
      search_users: {
        Args: { p_query: string }
        Returns: {
          current_streak: number
          display_name: string
          id: string
          level: number
          xp: number
        }[]
      }
    }
    Enums: {
      community_role: "member" | "moderator" | "admin"
      partner_invite_status: "pending" | "accepted" | "declined" | "cancelled"
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
      community_role: ["member", "moderator", "admin"],
      partner_invite_status: ["pending", "accepted", "declined", "cancelled"],
    },
  },
} as const
