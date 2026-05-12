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
      account_movements: {
        Row: {
          budget_id: string | null
          client_id: string
          company_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          movement_date: string
          movement_type: string
          payment_id: string | null
          payment_method: string | null
          payment_type: string | null
        }
        Insert: {
          budget_id?: string | null
          client_id: string
          company_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          movement_date?: string
          movement_type: string
          payment_id?: string | null
          payment_method?: string | null
          payment_type?: string | null
        }
        Update: {
          budget_id?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          payment_id?: string | null
          payment_method?: string | null
          payment_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_movements_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_movements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_account_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "account_movements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          category: string | null
          company_id: string
          created_at: string
          discount_str: string | null
          id: string
          product_code: string | null
          product_id: string | null
          product_name: string
          quantity: number
          total: number | null
          unit_price: number
        }
        Insert: {
          budget_id: string
          category?: string | null
          company_id: string
          created_at?: string
          discount_str?: string | null
          id?: string
          product_code?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          total?: number | null
          unit_price?: number
        }
        Update: {
          budget_id?: string
          category?: string | null
          company_id?: string
          created_at?: string
          discount_str?: string | null
          id?: string
          product_code?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          total?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_code: string | null
          budget_date: string
          budget_number: number
          client_id: string
          company_id: string
          created_at: string
          id: string
          notes: string | null
          paid_amount: number
          paid_at: string | null
          payment_status: string
          pdf_path: string | null
          seller_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          budget_code?: string | null
          budget_date?: string
          budget_number: number
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_status?: string
          pdf_path?: string | null
          seller_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          budget_code?: string | null
          budget_date?: string
          budget_number?: number
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_status?: string
          pdf_path?: string | null
          seller_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_account_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cascade_payment_plans: {
        Row: {
          client_id: string
          company_id: string
          created_at: string | null
          id: string
          items: Json
          mp_payment_id: string | null
          mp_preference_id: string | null
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string | null
          id?: string
          items?: Json
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          status?: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          items?: Json
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cascade_payment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_account_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cascade_payment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cascade_payment_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          client_number: number
          company_id: string
          created_at: string
          cuit: string
          email: string | null
          id: string
          name: string
          phone: string | null
          seller_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          client_number?: number
          company_id: string
          created_at?: string
          cuit: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          seller_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          client_number?: number
          company_id?: string
          created_at?: string
          cuit?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          seller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          cuit: string | null
          default_notes: string | null
          email: string | null
          enable_cascading_discounts: boolean | null
          id: string
          logo_url: string | null
          name: string
          payment_methods: Json | null
          phone: string | null
          plan_type: string | null
          tax_rate: number | null
          website: string | null
          enable_stock_module: boolean | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          cuit?: string | null
          default_notes?: string | null
          email?: string | null
          enable_cascading_discounts?: boolean | null
          id?: string
          logo_url?: string | null
          name: string
          payment_methods?: Json | null
          phone?: string | null
          plan_type?: string | null
          tax_rate?: number | null
          website?: string | null
          enable_stock_module?: boolean | null
        }
        Update: {
          address?: string | null
          created_at?: string
          cuit?: string | null
          default_notes?: string | null
          email?: string | null
          enable_cascading_discounts?: boolean | null
          id?: string
          logo_url?: string | null
          name?: string
          payment_methods?: Json | null
          phone?: string | null
          plan_type?: string | null
          tax_rate?: number | null
          website?: string | null
        }
        Relationships: []
      }
      company_messages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message: string
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_order_items: {
        Row: {
          created_at: string
          id: string
          internal_code: string | null
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          internal_code?: string | null
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          internal_code?: string | null
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          company_id: string
          created_at: string
          customer_user_id: string
          id: string
          notes: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_user_id: string
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_user_id?: string
          id?: string
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "customer_users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_users: {
        Row: {
          active: boolean
          auth_user_id: string
          client_id: string | null
          company_id: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          client_id?: string | null
          company_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          client_id?: string | null
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_account_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "customer_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          budget_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          file_name: string
          file_type: string
          id: string
          storage_path: string
        }
        Insert: {
          budget_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          file_name: string
          file_type: string
          id?: string
          storage_path: string
        }
        Update: {
          budget_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_account_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_accounts: {
        Row: {
          access_token: string
          company_id: string
          connected: boolean
          connected_at: string | null
          created_at: string
          expires_at: string | null
          expires_in: number | null
          id: string
          mp_user_id: string
          public_key: string | null
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          company_id: string
          connected?: boolean
          connected_at?: string | null
          created_at?: string
          expires_at?: string | null
          expires_in?: number | null
          id?: string
          mp_user_id: string
          public_key?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          company_id?: string
          connected?: boolean
          connected_at?: string | null
          created_at?: string
          expires_at?: string | null
          expires_in?: number | null
          id?: string
          mp_user_id?: string
          public_key?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mp_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          discount_str: string | null
          id: string
          order_id: string
          product_code: string | null
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          discount_str?: string | null
          id?: string
          order_id: string
          product_code?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          discount_str?: string | null
          id?: string
          order_id?: string
          product_code?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string
          order_id: string
          sender_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message: string
          order_id: string
          sender_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          budget_id: string | null
          client_id: string
          company_id: string
          created_at: string
          id: string
          notes: string | null
          order_code: string | null
          order_date: string
          order_number: number
          seller_id: string | null
          source: string | null
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          budget_id?: string | null
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_code?: string | null
          order_date?: string
          order_number: number
          seller_id?: string | null
          source?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          budget_id?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_code?: string | null
          order_date?: string
          order_number?: number
          seller_id?: string | null
          source?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_account_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          budget_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          id: string
          mp_external_reference: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          budget_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_account_balances"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_update_logs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          new_price: number | null
          old_price: number | null
          percentage: number
          product_id: string | null
          supplier: string | null
          update_type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          new_price?: number | null
          old_price?: number | null
          percentage: number
          product_id?: string | null
          supplier?: string | null
          update_type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          new_price?: number | null
          old_price?: number | null
          percentage?: number
          product_id?: string | null
          supplier?: string | null
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_update_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_update_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          id: string
          company_id: string
          parent_id: string
          component_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          parent_id: string
          component_id: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          parent_id?: string
          component_id?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          company_id: string
          product_id: string
          user_id: string | null
          type: string
          quantity: number
          reason: string
          reference_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          product_id: string
          user_id?: string | null
          type: string
          quantity: number
          reason: string
          reference_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          product_id?: string
          user_id?: string | null
          type?: string
          quantity?: number
          reason?: string
          reference_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          company_id: string
          cost_price: number
          created_at: string
          id: string
          internal_code: string | null
          last_price_update: string | null
          name: string
          supplier: string | null
          updated_at: string
          stock_quantity: number | null
          min_stock_level: number | null
          track_stock: boolean | null
          is_bundle: boolean | null
          sale_price: number | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          id?: string
          internal_code?: string | null
          last_price_update?: string | null
          name: string
          supplier?: string | null
          updated_at?: string
          stock_quantity?: number | null
          min_stock_level?: number | null
          track_stock?: boolean | null
          is_bundle?: boolean | null
        }
        Update: {
          active?: boolean
          category?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          id?: string
          internal_code?: string | null
          last_price_update?: string | null
          name?: string
          supplier?: string | null
          updated_at?: string
          stock_quantity?: number | null
          min_stock_level?: number | null
          track_stock?: boolean | null
          is_bundle?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profiles: {
        Row: {
          accepted_terms_version: number | null
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string | null
        }
        Insert: {
          accepted_terms_version?: number | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string | null
        }
        Update: {
          accepted_terms_version?: number | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_account_balances: {
        Row: {
          balance: number | null
          client_id: string | null
          client_name: string | null
          company_id: string | null
          cuit: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_company_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
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
    Enums: {},
  },
} as const
