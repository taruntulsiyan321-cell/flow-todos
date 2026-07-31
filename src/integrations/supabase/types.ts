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
      accountability_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          excuse_tags: string[] | null
          id: string
          kept_promises: boolean | null
          promises_text: string | null
          user_id: string
          why_not: string | null
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          excuse_tags?: string[] | null
          id?: string
          kept_promises?: boolean | null
          promises_text?: string | null
          user_id: string
          why_not?: string | null
        }
        Update: {
          checkin_date?: string
          created_at?: string
          excuse_tags?: string[] | null
          id?: string
          kept_promises?: boolean | null
          promises_text?: string | null
          user_id?: string
          why_not?: string | null
        }
        Relationships: []
      }
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
      ai_memories: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          importance: number
          last_reinforced_at: string | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          importance?: number
          last_reinforced_at?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          importance?: number
          last_reinforced_at?: string | null
          source?: string | null
          updated_at?: string
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
      daily_todos: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          remind_at: string | null
          scheduled_date: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          remind_at?: string | null
          scheduled_date?: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          remind_at?: string | null
          scheduled_date?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          actual_outcome: string | null
          ai_evaluation: string | null
          confidence: number | null
          created_at: string
          decided_on: string
          decision: string
          expected_outcome: string | null
          id: string
          outcome_date: string | null
          quality_score: number | null
          reason: string | null
          risks: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_outcome?: string | null
          ai_evaluation?: string | null
          confidence?: number | null
          created_at?: string
          decided_on?: string
          decision: string
          expected_outcome?: string | null
          id?: string
          outcome_date?: string | null
          quality_score?: number | null
          reason?: string | null
          risks?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_outcome?: string | null
          ai_evaluation?: string | null
          confidence?: number | null
          created_at?: string
          decided_on?: string
          decision?: string
          expected_outcome?: string | null
          id?: string
          outcome_date?: string | null
          quality_score?: number | null
          reason?: string | null
          risks?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      energy_logs: {
        Row: {
          created_at: string
          energy: number
          id: string
          log_date: string
          logged_at: string
          mood: number | null
          motivation: number | null
          note: string | null
          sleep_hours: number | null
          stress: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          energy: number
          id?: string
          log_date?: string
          logged_at?: string
          mood?: number | null
          motivation?: number | null
          note?: string | null
          sleep_hours?: number | null
          stress?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number
          id?: string
          log_date?: string
          logged_at?: string
          mood?: number | null
          motivation?: number | null
          note?: string | null
          sleep_hours?: number | null
          stress?: number | null
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          actual_minutes: number | null
          ambient_sound: string | null
          completed: boolean
          created_at: string
          ended_at: string | null
          goal_id: string | null
          id: string
          interruptions: number
          mode: string
          notes: string | null
          planned_minutes: number
          started_at: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          ambient_sound?: string | null
          completed?: boolean
          created_at?: string
          ended_at?: string | null
          goal_id?: string | null
          id?: string
          interruptions?: number
          mode?: string
          notes?: string | null
          planned_minutes?: number
          started_at?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          ambient_sound?: string | null
          completed?: boolean
          created_at?: string
          ended_at?: string | null
          goal_id?: string | null
          id?: string
          interruptions?: number
          mode?: string
          notes?: string | null
          planned_minutes?: number
          started_at?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string
          current_value: number | null
          description: string | null
          horizon: string
          id: string
          life_area: string | null
          parent_id: string | null
          progress: number
          sort_order: number
          start_date: string | null
          status: string
          target_date: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          horizon: string
          id?: string
          life_area?: string | null
          parent_id?: string | null
          progress?: number
          sort_order?: number
          start_date?: string | null
          status?: string
          target_date?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          horizon?: string
          id?: string
          life_area?: string | null
          parent_id?: string | null
          progress?: number
          sort_order?: number
          start_date?: string | null
          status?: string
          target_date?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "goals"
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
          difficulty: number
          frequency: string
          icon: string
          id: string
          identity_statement: string | null
          is_keystone: boolean
          life_area: string | null
          name: string
          reminder_time: string | null
          stack_after_habit_id: string | null
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
          difficulty?: number
          frequency?: string
          icon?: string
          id?: string
          identity_statement?: string | null
          is_keystone?: boolean
          life_area?: string | null
          name: string
          reminder_time?: string | null
          stack_after_habit_id?: string | null
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
          difficulty?: number
          frequency?: string
          icon?: string
          id?: string
          identity_statement?: string | null
          is_keystone?: boolean
          life_area?: string | null
          name?: string
          reminder_time?: string | null
          stack_after_habit_id?: string | null
          target_per_period?: number
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "habits_stack_after_habit_id_fkey"
            columns: ["stack_after_habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          body: string | null
          category: string
          cluster_key: string | null
          created_at: string
          id: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          cluster_key?: string | null
          created_at?: string
          id?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          cluster_key?: string | null
          created_at?: string
          id?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      identity_statements: {
        Row: {
          active: boolean
          created_at: string
          evidence_count: number
          id: string
          linked_habit_id: string | null
          statement: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          evidence_count?: number
          id?: string
          linked_habit_id?: string | null
          statement: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          evidence_count?: number
          id?: string
          linked_habit_id?: string | null
          statement?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_statements_linked_habit_id_fkey"
            columns: ["linked_habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          ai_analysis: string | null
          content: string
          created_at: string
          entry_date: string
          entry_type: string
          id: string
          mood: number | null
          structured: Json
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          ai_analysis?: string | null
          content: string
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          mood?: number | null
          structured?: Json
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          ai_analysis?: string | null
          content?: string
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          mood?: number | null
          structured?: Json
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      knowledge_notes: {
        Row: {
          content: string
          created_at: string
          embedding_hint: string | null
          id: string
          source_id: string | null
          source_type: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding_hint?: string | null
          id?: string
          source_id?: string | null
          source_type?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding_hint?: string | null
          id?: string
          source_id?: string | null
          source_type?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_items: {
        Row: {
          author: string | null
          completed_on: string | null
          cover_url: string | null
          created_at: string
          id: string
          key_learnings: string | null
          kind: string
          progress: number
          started_on: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          author?: string | null
          completed_on?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          key_learnings?: string | null
          kind: string
          progress?: number
          started_on?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          author?: string | null
          completed_on?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          key_learnings?: string | null
          kind?: string
          progress?: number
          started_on?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      life_area_logs: {
        Row: {
          area_key: string
          created_at: string
          id: string
          logged_on: string
          note: string | null
          score: number
          user_id: string
        }
        Insert: {
          area_key: string
          created_at?: string
          id?: string
          logged_on?: string
          note?: string | null
          score: number
          user_id: string
        }
        Update: {
          area_key?: string
          created_at?: string
          id?: string
          logged_on?: string
          note?: string | null
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      life_areas: {
        Row: {
          area_key: string
          id: string
          label: string
          notes: string | null
          score: number
          target_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          area_key: string
          id?: string
          label: string
          notes?: string | null
          score?: number
          target_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          area_key?: string
          id?: string
          label?: string
          notes?: string | null
          score?: number
          target_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      life_reviews: {
        Row: {
          created_at: string
          id: string
          payload: Json
          period: string
          period_end: string
          period_start: string
          score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          period: string
          period_end: string
          period_start: string
          score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          period?: string
          period_end?: string
          period_start?: string
          score?: number | null
          user_id?: string
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
      okr_key_results: {
        Row: {
          created_at: string
          current_value: number
          id: string
          okr_id: string
          target_value: number
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          okr_id: string
          target_value?: number
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          okr_id?: string
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_results_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
        ]
      }
      okrs: {
        Row: {
          created_at: string
          id: string
          life_area: string | null
          objective: string
          progress: number
          quarter: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          life_area?: string | null
          objective: string
          progress?: number
          quarter: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          life_area?: string | null
          objective?: string
          progress?: number
          quarter?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operating_manual: {
        Row: {
          active: boolean
          confidence: number
          created_at: string
          evidence_count: number
          id: string
          insight: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          confidence?: number
          created_at?: string
          evidence_count?: number
          id?: string
          insight: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          confidence?: number
          created_at?: string
          evidence_count?: number
          id?: string
          insight?: string
          updated_at?: string
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
      reading_highlights: {
        Row: {
          action_item: string | null
          applied: boolean
          applied_at: string | null
          created_at: string
          id: string
          learning_item_id: string | null
          location: string | null
          note: string | null
          quote: string
          reminded_at: string | null
          user_id: string
        }
        Insert: {
          action_item?: string | null
          applied?: boolean
          applied_at?: string | null
          created_at?: string
          id?: string
          learning_item_id?: string | null
          location?: string | null
          note?: string | null
          quote: string
          reminded_at?: string | null
          user_id: string
        }
        Update: {
          action_item?: string | null
          applied?: boolean
          applied_at?: string | null
          created_at?: string
          id?: string
          learning_item_id?: string | null
          location?: string | null
          note?: string | null
          quote?: string
          reminded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_highlights_learning_item_id_fkey"
            columns: ["learning_item_id"]
            isOneToOne: false
            referencedRelation: "learning_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string | null
          estimated_minutes: number | null
          goal_id: string | null
          id: string
          last_postpone_reason: string | null
          life_area: string | null
          notes: string | null
          postponed_count: number
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
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          last_postpone_reason?: string | null
          life_area?: string | null
          notes?: string | null
          postponed_count?: number
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
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          last_postpone_reason?: string | null
          life_area?: string | null
          notes?: string | null
          postponed_count?: number
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          activity: string
          category: string | null
          context_switches: number
          created_at: string
          duration_minutes: number | null
          end_time: string | null
          energy_at_start: number | null
          focus_session_id: string | null
          id: string
          interruptions: number
          log_date: string
          notes: string | null
          start_time: string
          updated_at: string
          user_id: string
          work_depth: string | null
        }
        Insert: {
          activity: string
          category?: string | null
          context_switches?: number
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          energy_at_start?: number | null
          focus_session_id?: string | null
          id?: string
          interruptions?: number
          log_date?: string
          notes?: string | null
          start_time?: string
          updated_at?: string
          user_id: string
          work_depth?: string | null
        }
        Update: {
          activity?: string
          category?: string | null
          context_switches?: number
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          energy_at_start?: number | null
          focus_session_id?: string | null
          id?: string
          interruptions?: number
          log_date?: string
          notes?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
          work_depth?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_focus_session_id_fkey"
            columns: ["focus_session_id"]
            isOneToOne: false
            referencedRelation: "focus_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      community_moderation_log: {
        Args: { p_community: string; p_limit?: number }
        Returns: {
          cleaned_text: string
          community_id: string
          created_at: string
          id: string
          original_text: string
          severity: string
          surface: string
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
      lifeos_enable_owner_rls: { Args: { p_table: string }; Returns: undefined }
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
