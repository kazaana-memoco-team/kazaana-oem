/**
 * Hand-written Database types for kazaana-oem.
 *
 * Replace with auto-generated types via Supabase CLI when ready:
 *   npx supabase gen types typescript --project-id <id> > lib/types/database.ts
 */

export type UserRole = "customer" | "craftsman" | "admin";

export type MessageSenderContext = "customer" | "admin";

export type OrderType = "product_customize" | "full_custom";

export type DocumentType = "quote" | "invoice" | "delivery" | "receipt";

export type OrderStatus =
  | "draft"
  | "awaiting_quote"
  | "quoted"
  | "paid"
  | "in_production"
  | "shipped"
  | "completed"
  | "cancelled";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          display_name: string | null;
          avatar_url: string | null;
          contact_info: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          display_name?: string | null;
          avatar_url?: string | null;
          contact_info?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      craftsmen: {
        Row: {
          profile_id: string;
          specialties: string[];
          bio: string | null;
          portfolio_urls: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          specialties?: string[];
          bio?: string | null;
          portfolio_urls?: string[];
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["craftsmen"]["Insert"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          assigned_craftsman_id: string | null;
          type: OrderType;
          status: OrderStatus;
          shopify_product_id: string | null;
          shopify_variant_id: string | null;
          reference_images: string[];
          customization: Json;
          estimated_price: number | null;
          final_price: number | null;
          shopify_draft_order_id: string | null;
          shopify_order_id: string | null;
          checkout_url: string | null;
          customer_notes: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          customer_id: string;
          assigned_craftsman_id?: string | null;
          type: OrderType;
          status?: OrderStatus;
          shopify_product_id?: string | null;
          shopify_variant_id?: string | null;
          reference_images?: string[];
          customization?: Json;
          estimated_price?: number | null;
          final_price?: number | null;
          shopify_draft_order_id?: string | null;
          shopify_order_id?: string | null;
          checkout_url?: string | null;
          customer_notes?: string | null;
          internal_notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          order_id: string;
          type: DocumentType;
          document_number: string;
          amount: number | null;
          notes: string | null;
          issued_by: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          type: DocumentType;
          document_number: string;
          amount?: number | null;
          notes?: string | null;
          issued_by?: string | null;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      system_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_settings"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          order_id: string;
          sender_id: string;
          body: string;
          attachments: string[];
          sender_context: MessageSenderContext;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          sender_id: string;
          body: string;
          attachments?: string[];
          sender_context?: MessageSenderContext;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          actor_id: string | null;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          actor_id?: string | null;
          event_type: string;
          payload?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["order_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      order_type: OrderType;
      order_status: OrderStatus;
      message_sender_context: MessageSenderContext;
      document_type: DocumentType;
    };
    CompositeTypes: Record<string, never>;
  };
}
