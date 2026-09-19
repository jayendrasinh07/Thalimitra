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
      addresses: {
        Row: {
          area: string
          building_name: string | null
          city: string
          cluster_id: string | null
          created_at: string
          custom_label: string | null
          delivery_instructions: string | null
          floor: string | null
          formatted_address: string | null
          gps_accuracy: number | null
          house_flat_number: string | null
          id: string
          instruction_preset: string | null
          is_default: boolean
          is_serviceable: boolean
          is_verified: boolean
          label: string
          landmark: string | null
          latitude: number | null
          longitude: number | null
          pincode: string
          place_id: string | null
          recipient_name: string
          recipient_phone: string
          sector: string | null
          source: string
          state: string
          street: string | null
          updated_at: string
          user_id: string
          zone_id: string | null
        }
        Insert: {
          area: string
          building_name?: string | null
          city?: string
          cluster_id?: string | null
          created_at?: string
          custom_label?: string | null
          delivery_instructions?: string | null
          floor?: string | null
          formatted_address?: string | null
          gps_accuracy?: number | null
          house_flat_number?: string | null
          id?: string
          instruction_preset?: string | null
          is_default?: boolean
          is_serviceable?: boolean
          is_verified?: boolean
          label?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          pincode: string
          place_id?: string | null
          recipient_name: string
          recipient_phone: string
          sector?: string | null
          source?: string
          state?: string
          street?: string | null
          updated_at?: string
          user_id: string
          zone_id?: string | null
        }
        Update: {
          area?: string
          building_name?: string | null
          city?: string
          cluster_id?: string | null
          created_at?: string
          custom_label?: string | null
          delivery_instructions?: string | null
          floor?: string | null
          formatted_address?: string | null
          gps_accuracy?: number | null
          house_flat_number?: string | null
          id?: string
          instruction_preset?: string | null
          is_default?: boolean
          is_serviceable?: boolean
          is_verified?: boolean
          label?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          pincode?: string
          place_id?: string | null
          recipient_name?: string
          recipient_phone?: string
          sector?: string | null
          source?: string
          state?: string
          street?: string | null
          updated_at?: string
          user_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      area_waitlist: {
        Row: {
          area: string
          city: string
          contact: string
          created_at: string
          id: string
          name: string
          pincode: string | null
          segment: string | null
        }
        Insert: {
          area: string
          city?: string
          contact: string
          created_at?: string
          id?: string
          name: string
          pincode?: string | null
          segment?: string | null
        }
        Update: {
          area?: string
          city?: string
          contact?: string
          created_at?: string
          id?: string
          name?: string
          pincode?: string | null
          segment?: string | null
        }
        Relationships: []
      }
      delivery_slots: {
        Row: {
          created_at: string
          cutoff_time: string
          end_time: string
          id: string
          is_active: boolean
          max_orders: number
          meal_type: string
          name: string
          seed_key: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cutoff_time: string
          end_time: string
          id?: string
          is_active?: boolean
          max_orders?: number
          meal_type: string
          name: string
          seed_key?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cutoff_time?: string
          end_time?: string
          id?: string
          is_active?: boolean
          max_orders?: number
          meal_type?: string
          name?: string
          seed_key?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          boundary: Json | null
          breakfast_enabled: boolean
          created_at: string
          delivery_fee: number
          description: string | null
          dinner_enabled: boolean
          estimated_duration_minutes: number
          id: string
          is_active: boolean
          is_free_delivery: boolean
          lunch_enabled: boolean
          min_order_amount: number
          name: string
          pincodes: string[]
          priority: number
          published_at: string | null
          published_by: string | null
          sectors: string[]
          status: string
          tagline: string | null
          updated_at: string
          version: number
          waitlist_enabled: boolean
        }
        Insert: {
          boundary?: Json | null
          breakfast_enabled?: boolean
          created_at?: string
          delivery_fee?: number
          description?: string | null
          dinner_enabled?: boolean
          estimated_duration_minutes?: number
          id: string
          is_active?: boolean
          is_free_delivery?: boolean
          lunch_enabled?: boolean
          min_order_amount?: number
          name: string
          pincodes?: string[]
          priority?: number
          published_at?: string | null
          published_by?: string | null
          sectors?: string[]
          status?: string
          tagline?: string | null
          updated_at?: string
          version?: number
          waitlist_enabled?: boolean
        }
        Update: {
          boundary?: Json | null
          breakfast_enabled?: boolean
          created_at?: string
          delivery_fee?: number
          description?: string | null
          dinner_enabled?: boolean
          estimated_duration_minutes?: number
          id?: string
          is_active?: boolean
          is_free_delivery?: boolean
          lunch_enabled?: boolean
          min_order_amount?: number
          name?: string
          pincodes?: string[]
          priority?: number
          published_at?: string | null
          published_by?: string | null
          sectors?: string[]
          status?: string
          tagline?: string | null
          updated_at?: string
          version?: number
          waitlist_enabled?: boolean
        }
        Relationships: []
      }
      kitchen_order_signals: {
        Row: {
          changed_at: string
          meal_type: string
          order_date: string
          order_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          meal_type: string
          order_date: string
          order_id: string
          status: string
        }
        Update: {
          changed_at?: string
          meal_type?: string
          order_date?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_order_signals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_customizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          meal_id: string | null
          name: string
          price: number
          seed_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          meal_id?: string | null
          name: string
          price?: number
          seed_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          meal_id?: string | null
          name?: string
          price?: number
          seed_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_customizations_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          archived_at: string | null
          base_price: number
          created_at: string
          description: string | null
          diet_type: string | null
          id: string
          image_url: string | null
          is_active: boolean
          meal_type: string
          name: string
          seed_key: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          base_price?: number
          created_at?: string
          description?: string | null
          diet_type?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meal_type?: string
          name: string
          seed_key?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          base_price?: number
          created_at?: string
          description?: string | null
          diet_type?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meal_type?: string
          name?: string
          seed_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      menu_days: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          menu_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          menu_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          menu_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          availability: boolean
          created_at: string
          display_order: number
          id: string
          meal_id: string
          menu_day_id: string
          updated_at: string
        }
        Insert: {
          availability?: boolean
          created_at?: string
          display_order?: number
          id?: string
          meal_id: string
          menu_day_id: string
          updated_at?: string
        }
        Update: {
          availability?: boolean
          created_at?: string
          display_order?: number
          id?: string
          meal_id?: string
          menu_day_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_day_id_fkey"
            columns: ["menu_day_id"]
            isOneToOne: false
            referencedRelation: "menu_days"
            referencedColumns: ["id"]
          },
        ]
      }
      order_customizations: {
        Row: {
          created_at: string
          customization_id: string | null
          customization_name_snapshot: string
          id: string
          line_total: number
          order_item_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          customization_id?: string | null
          customization_name_snapshot: string
          id?: string
          line_total?: number
          order_item_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          customization_id?: string | null
          customization_name_snapshot?: string
          id?: string
          line_total?: number
          order_item_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_customizations_customization_id_fkey"
            columns: ["customization_id"]
            isOneToOne: false
            referencedRelation: "meal_customizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_customizations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          meal_id: string | null
          meal_name_snapshot: string
          order_id: string
          preparation_preferences: Json
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          meal_id?: string | null
          meal_name_snapshot: string
          order_id: string
          preparation_preferences?: Json
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          meal_id?: string | null
          meal_name_snapshot?: string
          order_id?: string
          preparation_preferences?: Json
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          address_snapshot: Json
          cancellation_note: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          customization_total: number
          delivery_fee: number
          delivery_slot_id: string | null
          discount: number
          grand_total: number
          id: string
          idempotency_key: string
          meal_type: string
          notes: string | null
          order_date: string
          order_number: string
          payment_status: string
          request_payload: Json
          status: string
          subtotal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address_id?: string | null
          address_snapshot?: Json
          cancellation_note?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customization_total?: number
          delivery_fee?: number
          delivery_slot_id?: string | null
          discount?: number
          grand_total?: number
          id?: string
          idempotency_key: string
          meal_type: string
          notes?: string | null
          order_date: string
          order_number: string
          payment_status?: string
          request_payload: Json
          status?: string
          subtotal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address_id?: string | null
          address_snapshot?: Json
          cancellation_note?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customization_total?: number
          delivery_fee?: number
          delivery_slot_id?: string | null
          discount?: number
          grand_total?: number
          id?: string
          idempotency_key?: string
          meal_type?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          payment_status?: string
          request_payload?: Json
          status?: string
          subtotal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_slot_id_fkey"
            columns: ["delivery_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_portion: string | null
          diet_preference: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          segment: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_portion?: string | null
          diet_preference?: string | null
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          segment?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_portion?: string | null
          diet_preference?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          segment?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_kitchen_meal: { Args: { p_meal_id: string }; Returns: Json }
      cancel_customer_order: {
        Args: { p_note: string | null; p_order_id: string; p_reason: string }
        Returns: Json
      }
      create_support_request: {
        Args: { p_category: string; p_message: string; p_order_id: string | null }
        Returns: Json
      }
      get_delivery_slot_availability: {
        Args: { p_meal_type: string; p_order_date: string }
        Returns: {
          booked_portions: number
          cutoff_time: string
          end_time: string
          id: string
          is_active: boolean
          max_orders: number
          meal_type: string
          name: string
          start_time: string
        }[]
      }
      get_kitchen_catalog: { Args: never; Returns: Json }
      get_kitchen_business_analytics: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      check_delivery_serviceability: {
        Args: {
          p_latitude: number
          p_longitude: number
          p_pincode?: string | null
          p_area?: string | null
          p_sector?: string | null
          p_meal_type?: string | null
        }
        Returns: Json
      }
      get_delivery_areas: { Args: never; Returns: Json }
      get_client_error_summary: { Args: never; Returns: Json }
      get_kitchen_management: { Args: never; Returns: Json }
      get_kitchen_menu: { Args: { p_menu_date: string }; Returns: Json }
      get_kitchen_orders: {
        Args: { p_meal_type: string; p_order_date: string }
        Returns: Json
      }
      get_kitchen_shift_brief: {
        Args: { p_meal_type: string; p_service_date: string }
        Returns: Json
      }
      get_kitchen_support_requests: { Args: never; Returns: Json }
      get_my_support_requests: { Args: never; Returns: Json }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      place_order_secure: {
        Args: {
          p_address_id: string
          p_customizations?: Json
          p_delivery_slot_id: string
          p_idempotency_key?: string
          p_meal_id: string
          p_meal_type: string
          p_notes?: string
          p_order_date: string
          p_preferences?: Json
          p_quantity: number
        }
        Returns: Json
      }
      report_client_error: {
        Args: { p_event_id: string; p_surface: string; p_error_kind?: string }
        Returns: undefined
      }
      quote_delivery_address: { Args: { p_address_id: string }; Returns: Json }
      grant_kitchen_access: { Args: { p_email: string }; Returns: Json }
      revoke_kitchen_access: { Args: { p_user_id: string }; Returns: Json }
      save_kitchen_delivery_slot: {
        Args: { p_is_active: boolean; p_max_portions: number; p_slot_id: string }
        Returns: Json
      }
      save_delivery_area: {
        Args: {
          p_area_id: string | null
          p_name: string
          p_status: string
          p_boundary: Json | null
          p_breakfast_enabled: boolean
          p_lunch_enabled: boolean
          p_dinner_enabled: boolean
          p_delivery_fee: number
          p_min_order_amount: number
          p_estimated_duration_minutes: number
          p_waitlist_enabled: boolean
          p_priority: number
        }
        Returns: Json
      }
      save_kitchen_meal: {
        Args: {
          p_base_price: number
          p_description: string
          p_diet_type: string
          p_image_url: string
          p_is_active: boolean
          p_meal_id: string
          p_meal_type: string
          p_name: string
        }
        Returns: Json
      }
      save_kitchen_menu: {
        Args: { p_meal_ids: string[]; p_menu_date: string; p_publish: boolean }
        Returns: Json
      }
      save_kitchen_shift_handover: {
        Args: {
          p_expected_updated_at?: string | null
          p_meal_type: string
          p_note: string
          p_service_date: string
        }
        Returns: Json
      }
      update_kitchen_order_status: {
        Args: {
          p_expected_status: string
          p_next_status: string
          p_order_id: string
        }
        Returns: Json
      }
      update_kitchen_support_request: {
        Args: { p_request_id: string; p_status: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const


