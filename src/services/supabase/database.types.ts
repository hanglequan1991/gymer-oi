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
      booking_health_notes: {
        Row: {
          booking_id: string
          created_at: string
          note: string
          shared_with_gymer: boolean
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          note: string
          shared_with_gymer?: boolean
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          note?: string
          shared_with_gymer?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_health_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          ends_at: string
          expires_at: string
          goal: string | null
          gymer_id: string
          id: string
          price_vnd: number
          responded_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id: string
          ends_at: string
          expires_at: string
          goal?: string | null
          gymer_id: string
          id?: string
          price_vnd: number
          responded_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string
          ends_at?: string
          expires_at?: string
          goal?: string | null
          gymer_id?: string
          id?: string
          price_vnd?: number
          responded_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_gymer_id_fkey"
            columns: ["gymer_id"]
            isOneToOne: false
            referencedRelation: "gymer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      certificates: {
        Row: {
          created_at: string
          gymer_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gymer_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gymer_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_gymer_id_fkey"
            columns: ["gymer_id"]
            isOneToOne: false
            referencedRelation: "gymer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gymer_day_overrides: {
        Row: {
          created_at: string
          day: string
          gymer_id: string
          is_open: boolean
          price_vnd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          gymer_id: string
          is_open?: boolean
          price_vnd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          gymer_id?: string
          is_open?: boolean
          price_vnd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gymer_day_overrides_gymer_id_fkey"
            columns: ["gymer_id"]
            isOneToOne: false
            referencedRelation: "gymer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gymer_locations: {
        Row: {
          created_at: string
          lat: number
          lng: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lat: number
          lng: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          lat?: number
          lng?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gymer_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "gymer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gymer_open_hours: {
        Row: {
          created_at: string
          gymer_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gymer_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gymer_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gymer_open_hours_gymer_id_fkey"
            columns: ["gymer_id"]
            isOneToOne: false
            referencedRelation: "gymer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gymer_profiles: {
        Row: {
          accepts_requests: boolean
          area_label: string
          avatar_url: string | null
          bio: string | null
          birth_year: number
          created_at: string
          display_name: string
          gender: Database["public"]["Enums"]["gender"]
          is_listed: boolean
          price_weekday_vnd: number
          price_weekend_vnd: number
          rating_avg: number
          rating_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accepts_requests?: boolean
          area_label: string
          avatar_url?: string | null
          bio?: string | null
          birth_year: number
          created_at?: string
          display_name: string
          gender: Database["public"]["Enums"]["gender"]
          is_listed?: boolean
          price_weekday_vnd: number
          price_weekend_vnd: number
          rating_avg?: number
          rating_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accepts_requests?: boolean
          area_label?: string
          avatar_url?: string | null
          bio?: string | null
          birth_year?: number
          created_at?: string
          display_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          is_listed?: boolean
          price_weekday_vnd?: number
          price_weekend_vnd?: number
          rating_avg?: number
          rating_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gymer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gymer_slot_overrides: {
        Row: {
          created_at: string
          day: string
          gymer_id: string
          is_open: boolean
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          gymer_id: string
          is_open: boolean
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          gymer_id?: string
          is_open?: boolean
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gymer_slot_overrides_gymer_id_fkey"
            columns: ["gymer_id"]
            isOneToOne: false
            referencedRelation: "gymer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gymer_specialties: {
        Row: {
          created_at: string
          gymer_id: string
          specialty_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gymer_id: string
          specialty_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gymer_id?: string
          specialty_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gymer_specialties_gymer_id_fkey"
            columns: ["gymer_id"]
            isOneToOne: false
            referencedRelation: "gymer_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gymer_specialties_specialty_name_fkey"
            columns: ["specialty_name"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["name"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_id: string
          author_name: string
          body: string | null
          booking_id: string
          created_at: string
          gymer_id: string
          id: string
          rating: number
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name: string
          body?: string | null
          booking_id: string
          created_at?: string
          gymer_id: string
          id?: string
          rating: number
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string | null
          booking_id?: string
          created_at?: string
          gymer_id?: string
          id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_parties_fkey"
            columns: ["booking_id", "gymer_id", "author_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "gymer_id", "customer_id"]
          },
          {
            foreignKeyName: "reviews_gymer_id_fkey"
            columns: ["gymer_id"]
            isOneToOne: false
            referencedRelation: "gymer_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      specialties: {
        Row: {
          created_at: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      zalo_identities: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          zalo_id: string
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
          zalo_id: string
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          zalo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zalo_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking: { Args: { p_booking_id: string }; Returns: undefined }
      create_booking: {
        Args: {
          p_expected_price: number
          p_goal: string
          p_gymer_id: string
          p_health_note: string
          p_share_health_note?: boolean
          p_starts_at: string
        }
        Returns: string
      }
      create_review: {
        Args: { p_body: string; p_booking_id: string; p_rating: number }
        Returns: string
      }
      get_day_slots: {
        Args: { p_day: string; p_gymer_id: string }
        Returns: {
          booked_by: string
          start_time: string
          state: string
        }[]
      }
      get_month_calendar: {
        Args: { p_gymer_id: string; p_month: number; p_year: number }
        Returns: {
          day: string
          has_booked: boolean
          is_open: boolean
          price_vnd: number
        }[]
      }
      respond_booking: {
        Args: { p_booking_id: string; p_decision: string }
        Returns: undefined
      }
      search_gymers: {
        Args: {
          p_age_max?: number
          p_age_min?: number
          p_gender?: Database["public"]["Enums"]["gender"]
          p_keyword?: string
          p_lat: number
          p_lng: number
          p_max_price?: number
          p_min_rating?: number
          p_radius_km: number
          p_specialty?: string
        }
        Returns: {
          age: number
          area_label: string
          avatar_url: string
          display_name: string
          distance_km: number
          gender: Database["public"]["Enums"]["gender"]
          price_weekday_vnd: number
          price_weekend_vnd: number
          rating_avg: number
          rating_count: number
          tags: string[]
          user_id: string
        }[]
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "confirmed"
        | "rejected"
        | "cancelled"
        | "expired"
      gender: "female" | "male"
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
      booking_status: [
        "pending",
        "confirmed",
        "rejected",
        "cancelled",
        "expired",
      ],
      gender: ["female", "male"],
    },
  },
} as const
