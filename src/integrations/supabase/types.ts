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
          category: string
          coin_reward: number
          created_at: string
          criteria_kind: string | null
          criteria_value: number
          description: string
          icon: string
          key: string
          tier: string
          title: string
          xp: number
        }
        Insert: {
          category?: string
          coin_reward?: number
          created_at?: string
          criteria_kind?: string | null
          criteria_value?: number
          description: string
          icon?: string
          key: string
          tier?: string
          title: string
          xp?: number
        }
        Update: {
          category?: string
          coin_reward?: number
          created_at?: string
          criteria_kind?: string | null
          criteria_value?: number
          description?: string
          icon?: string
          key?: string
          tier?: string
          title?: string
          xp?: number
        }
        Relationships: []
      }
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          created_at: string
          detail: string | null
          id: number
          ip_hash: string | null
          kind: string
          success: boolean
          user_id: string | null
          username_key: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: number
          ip_hash?: string | null
          kind: string
          success?: boolean
          user_id?: string | null
          username_key?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: number
          ip_hash?: string | null
          kind?: string
          success?: boolean
          user_id?: string | null
          username_key?: string | null
        }
        Relationships: []
      }
      blocked_username_patterns: {
        Row: {
          created_at: string
          id: string
          kind: string
          pattern: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          pattern: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          pattern?: string
          reason?: string | null
        }
        Relationships: []
      }
      box_openings: {
        Row: {
          box_id: string
          created_at: string
          id: string
          reward: Json
          user_id: string
        }
        Insert: {
          box_id: string
          created_at?: string
          id?: string
          reward: Json
          user_id: string
        }
        Update: {
          box_id?: string
          created_at?: string
          id?: string
          reward?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_openings_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "reward_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string | null
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          active: boolean
          created_at: string
          description: string
          ends_at: string | null
          goal: number
          id: string
          kind: string
          starts_at: string
          title: string
          xp_reward: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          ends_at?: string | null
          goal?: number
          id?: string
          kind?: string
          starts_at?: string
          title: string
          xp_reward?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          ends_at?: string | null
          goal?: number
          id?: string
          kind?: string
          starts_at?: string
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      confessions: {
        Row: {
          author_id: string
          content: string
          created_at: string
          flagged_terms: string[]
          id: string
          likes_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          risk_score: number
          school_slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          flagged_terms?: string[]
          id?: string
          likes_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number
          school_slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          flagged_terms?: string[]
          id?: string
          likes_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number
          school_slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "school_events"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      gift_catalog: {
        Row: {
          active: boolean
          created_at: string
          emoji: string
          id: string
          name: string
          price: number
          rarity: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji: string
          id: string
          name: string
          price: number
          rarity?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          price?: number
          rarity?: string
        }
        Relationships: []
      }
      gifts: {
        Row: {
          coins: number
          created_at: string
          gift_id: string
          id: string
          message: string | null
          post_id: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          coins?: number
          created_at?: string
          gift_id: string
          id?: string
          message?: string | null
          post_id?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          gift_id?: string
          id?: string
          message?: string | null
          post_id?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gifts_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gift_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gifts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          color: string
          created_at: string
          emoji: string
          motto: string
          name: string
          points: number
          slug: string
        }
        Insert: {
          color: string
          created_at?: string
          emoji: string
          motto?: string
          name: string
          points?: number
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string
          motto?: string
          name?: string
          points?: number
          slug?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          code: string
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          id: string
          invitee_email: string | null
          invitee_id: string | null
          inviter_id: string
        }
        Insert: {
          code?: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id: string
        }
        Update: {
          code?: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          invitee_email?: string | null
          invitee_id?: string | null
          inviter_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_progress: {
        Row: {
          claimed: boolean
          mission_id: string
          period_start: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed?: boolean
          mission_id: string
          period_start?: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed?: boolean
          mission_id?: string
          period_start?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          active: boolean
          cadence: string
          coin_reward: number
          created_at: string
          description: string
          goal: number
          id: string
          kind: string
          title: string
          xp_reward: number
        }
        Insert: {
          active?: boolean
          cadence?: string
          coin_reward?: number
          created_at?: string
          description: string
          goal?: number
          id?: string
          kind: string
          title: string
          xp_reward?: number
        }
        Update: {
          active?: boolean
          cadence?: string
          coin_reward?: number
          created_at?: string
          description?: string
          goal?: number
          id?: string
          kind?: string
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "school_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_interactions: {
        Row: {
          created_at: string
          dwell_ms: number
          id: string
          post_id: string
          user_id: string
          watch_ms: number
        }
        Insert: {
          created_at?: string
          dwell_ms?: number
          id?: string
          post_id: string
          user_id: string
          watch_ms?: number
        }
        Update: {
          created_at?: string
          dwell_ms?: number
          id?: string
          post_id?: string
          user_id?: string
          watch_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_interactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
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
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
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
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          post_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          post_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          post_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comments_count: number
          content: string | null
          created_at: string
          hashtags: string[]
          id: string
          likes_count: number
          media_urls: string[]
          post_type: string
          saves_count: number
          shares_count: number
          trending_score: number
          updated_at: string
          user_id: string
          views_count: number
          watch_ms: number
        }
        Insert: {
          comments_count?: number
          content?: string | null
          created_at?: string
          hashtags?: string[]
          id?: string
          likes_count?: number
          media_urls?: string[]
          post_type?: string
          saves_count?: number
          shares_count?: number
          trending_score?: number
          updated_at?: string
          user_id: string
          views_count?: number
          watch_ms?: number
        }
        Update: {
          comments_count?: number
          content?: string | null
          created_at?: string
          hashtags?: string[]
          id?: string
          likes_count?: number
          media_urls?: string[]
          post_type?: string
          saves_count?: number
          shares_count?: number
          trending_score?: number
          updated_at?: string
          user_id?: string
          views_count?: number
          watch_ms?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          age_verified: boolean
          avatar_url: string | null
          ban_reason: string | null
          banned: boolean
          bio: string | null
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          gender: string | null
          grade_class: string | null
          graduation_year: number | null
          id: string
          is_online: boolean | null
          last_seen_at: string | null
          onboarded: boolean
          phone: string | null
          region: string | null
          school_name: string | null
          school_slug: string | null
          school_type: Database["public"]["Enums"]["school_type"] | null
          security_setup: boolean
          suspended_until: string | null
          updated_at: string
          username: string | null
          verification_tier: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          age?: number | null
          age_verified?: boolean
          avatar_url?: string | null
          ban_reason?: string | null
          banned?: boolean
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          grade_class?: string | null
          graduation_year?: number | null
          id: string
          is_online?: boolean | null
          last_seen_at?: string | null
          onboarded?: boolean
          phone?: string | null
          region?: string | null
          school_name?: string | null
          school_slug?: string | null
          school_type?: Database["public"]["Enums"]["school_type"] | null
          security_setup?: boolean
          suspended_until?: string | null
          updated_at?: string
          username?: string | null
          verification_tier?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          age?: number | null
          age_verified?: boolean
          avatar_url?: string | null
          ban_reason?: string | null
          banned?: boolean
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          grade_class?: string | null
          graduation_year?: number | null
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          onboarded?: boolean
          phone?: string | null
          region?: string | null
          school_name?: string | null
          school_slug?: string | null
          school_type?: Database["public"]["Enums"]["school_type"] | null
          security_setup?: boolean
          suspended_until?: string | null
          updated_at?: string
          username?: string | null
          verification_tier?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      reward_boxes: {
        Row: {
          active: boolean
          cost_coins: number
          created_at: string
          description: string
          id: string
          name: string
          rewards: Json
        }
        Insert: {
          active?: boolean
          cost_coins?: number
          created_at?: string
          description?: string
          id: string
          name: string
          rewards?: Json
        }
        Update: {
          active?: boolean
          cost_coins?: number
          created_at?: string
          description?: string
          id?: string
          name?: string
          rewards?: Json
        }
        Relationships: []
      }
      school_events: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          school_slug: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          school_slug?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          school_slug?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_polls: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          options: string[]
          question: string
          school_slug: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          options: string[]
          question: string
          school_slug?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          options?: string[]
          question?: string
          school_slug?: string | null
        }
        Relationships: []
      }
      school_war_scores: {
        Row: {
          points: number
          school_slug: string
          updated_at: string
          war_id: string
        }
        Insert: {
          points?: number
          school_slug: string
          updated_at?: string
          war_id: string
        }
        Update: {
          points?: number
          school_slug?: string
          updated_at?: string
          war_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_war_scores_war_id_fkey"
            columns: ["war_id"]
            isOneToOne: false
            referencedRelation: "school_wars"
            referencedColumns: ["id"]
          },
        ]
      }
      school_wars: {
        Row: {
          active: boolean
          created_at: string
          description: string
          ends_at: string
          id: string
          starts_at: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          starts_at?: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          active: boolean
          created_at: string
          description: string
          ends_at: string | null
          id: string
          name: string
          starts_at: string
          theme: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string
          theme?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string
          theme?: string
        }
        Relationships: []
      }
      security_answers: {
        Row: {
          answer_hash: string
          created_at: string
          q_index: number
          user_id: string
        }
        Insert: {
          answer_hash: string
          created_at?: string
          q_index: number
          user_id: string
        }
        Update: {
          answer_hash?: string
          created_at?: string
          q_index?: number
          user_id?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          id: string
          min_level: number
          name: string
          price: number
          rarity: string
          unlock_badge: string | null
          value: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string
          id: string
          min_level?: number
          name: string
          price?: number
          rarity?: string
          unlock_badge?: string | null
          value: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          min_level?: number
          name?: string
          price?: number
          rarity?: string
          unlock_badge?: string | null
          value?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      spin_results: {
        Row: {
          created_at: string
          id: string
          label: string
          reward_amount: number
          reward_kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          reward_amount?: number
          reward_kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          reward_amount?: number
          reward_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          background: string | null
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string | null
          user_id: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          user_id: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_replies_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          story_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          story_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      student_questionnaire: {
        Row: {
          career_goal: string | null
          class_grade: string | null
          clubs_activities: string | null
          created_at: string
          favorite_subjects: string | null
          hobbies: string | null
          inspiration: string | null
          level: string | null
          message_to_students: string | null
          reconnect_classmates: boolean | null
          school: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          career_goal?: string | null
          class_grade?: string | null
          clubs_activities?: string | null
          created_at?: string
          favorite_subjects?: string | null
          hobbies?: string | null
          inspiration?: string | null
          level?: string | null
          message_to_students?: string | null
          reconnect_classmates?: boolean | null
          school?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          career_goal?: string | null
          class_grade?: string | null
          clubs_activities?: string | null
          created_at?: string
          favorite_subjects?: string | null
          hobbies?: string | null
          inspiration?: string | null
          level?: string | null
          message_to_students?: string | null
          reconnect_classmates?: boolean | null
          school?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_key: string
          earned_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          earned_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_key_fkey"
            columns: ["achievement_key"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["key"]
          },
        ]
      }
      user_gamification: {
        Row: {
          boxes_available: number
          coins: number
          created_at: string
          equipped_bubble: string | null
          equipped_chat_theme: string | null
          equipped_effect: string | null
          equipped_frame: string | null
          equipped_name_color: string | null
          equipped_sticker: string | null
          equipped_theme: string | null
          equipped_title: string | null
          house_slug: string | null
          last_login_date: string | null
          last_spin_date: string | null
          level: number
          longest_streak: number
          reputation: number
          streak_days: number
          theme: string | null
          updated_at: string
          user_id: string
          week_start: string
          weekly_xp: number
          xp: number
        }
        Insert: {
          boxes_available?: number
          coins?: number
          created_at?: string
          equipped_bubble?: string | null
          equipped_chat_theme?: string | null
          equipped_effect?: string | null
          equipped_frame?: string | null
          equipped_name_color?: string | null
          equipped_sticker?: string | null
          equipped_theme?: string | null
          equipped_title?: string | null
          house_slug?: string | null
          last_login_date?: string | null
          last_spin_date?: string | null
          level?: number
          longest_streak?: number
          reputation?: number
          streak_days?: number
          theme?: string | null
          updated_at?: string
          user_id: string
          week_start?: string
          weekly_xp?: number
          xp?: number
        }
        Update: {
          boxes_available?: number
          coins?: number
          created_at?: string
          equipped_bubble?: string | null
          equipped_chat_theme?: string | null
          equipped_effect?: string | null
          equipped_frame?: string | null
          equipped_name_color?: string | null
          equipped_sticker?: string | null
          equipped_theme?: string | null
          equipped_title?: string | null
          house_slug?: string | null
          last_login_date?: string | null
          last_spin_date?: string | null
          level?: number
          longest_streak?: number
          reputation?: number
          streak_days?: number
          theme?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
          weekly_xp?: number
          xp?: number
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          created_at: string
          interest: string
          user_id: string
        }
        Insert: {
          created_at?: string
          interest: string
          user_id: string
        }
        Update: {
          created_at?: string
          interest?: string
          user_id?: string
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          created_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
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
      verification_requests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          route: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_house_points: { Args: { _points: number }; Returns: undefined }
      add_war_points: {
        Args: { _points: number; _school_slug: string }
        Returns: undefined
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      auth_throttle_state: {
        Args: { _ip_hash: string; _username_key: string }
        Returns: Json
      }
      award_coins: { Args: { _amount: number }; Returns: number }
      award_xp: { Args: { _amount: number; _reason?: string }; Returns: Json }
      buy_shop_item: { Args: { _item_id: string }; Returns: Json }
      claim_invite: { Args: { _code: string }; Returns: Json }
      claim_mission: { Args: { _mission_id: string }; Returns: Json }
      confirm_invite: {
        Args: { _code: string; _confirm: boolean }
        Returns: Json
      }
      daily_spin: { Args: never; Returns: Json }
      equip_item: { Args: { _item_id: string }; Returns: Json }
      evaluate_achievements: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_username_blocked: { Args: { _u: string }; Returns: boolean }
      join_house: { Args: { _slug: string }; Returns: Json }
      mission_period: { Args: { _cadence: string }; Returns: string }
      mutual_friends_count: {
        Args: { _me: string; _other: string }
        Returns: number
      }
      normalize_school: { Args: { _name: string }; Returns: string }
      normalize_username: { Args: { _u: string }; Returns: string }
      open_box: { Args: { _box_id: string }; Returns: Json }
      progress_mission: {
        Args: { _amount?: number; _kind: string }
        Returns: undefined
      }
      recompute_post_trending: {
        Args: { _post_id: string }
        Returns: undefined
      }
      send_gift: {
        Args: {
          _gift_id: string
          _message?: string
          _post_id?: string
          _recipient: string
        }
        Returns: Json
      }
      set_security_answers: {
        Args: { _answers: Json; _user_id: string }
        Returns: number
      }
      signup_rank: { Args: { _user_id: string }; Returns: number }
      touch_streak: { Args: never; Returns: Json }
      user_badge_stats: { Args: { _user_id: string }; Returns: Json }
      username_available: { Args: { _u: string }; Returns: boolean }
      verification_eligibility: { Args: { _user_id: string }; Returns: Json }
      verify_security_answers: {
        Args: { _answers: Json; _user_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      friendship_status: "pending" | "accepted" | "blocked"
      school_type:
        | "primary"
        | "jhs"
        | "shs"
        | "technical"
        | "university"
        | "alumni"
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
      app_role: ["admin", "moderator", "user"],
      friendship_status: ["pending", "accepted", "blocked"],
      school_type: [
        "primary",
        "jhs",
        "shs",
        "technical",
        "university",
        "alumni",
      ],
    },
  },
} as const
