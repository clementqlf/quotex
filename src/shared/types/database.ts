/**
 * Squelette généré pour les types de base de données Supabase.
 * 
 * NOTE: Étant donné que vous n'avez pas le CLI Supabase configuré localement,
 * ceci est un fichier de remplacement (placeholder).
 * 
 * Pour obtenir vos vrais types :
 * 1. Allez sur le Dashboard Supabase (web) de votre projet.
 * 2. Allez dans "API Docs" > "Tables & Views" > "Generate TypeScript types".
 * 3. Copiez le contenu complet et collez-le dans ce fichier pour écraser ce squelette.
 * 
 * Ou, si vous installez le CLI plus tard, lancez : npm run types:generate
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      quotes: {
        Row: {
          id: number;
          text: string;
          book_id: number | null;
          author_id: number | null;
          user_id: string;
          created_at: string;
          updated_at: string;
          likes_count: number;
          // Ces types seront remplacés lors de la vraie génération
        };
        Insert: Partial<Database['public']['Tables']['quotes']['Row']>;
        Update: Partial<Database['public']['Tables']['quotes']['Row']>;
      };
      books: {
        Row: {
          id: number;
          title: string;
          author_id: number | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['books']['Row']>;
        Update: Partial<Database['public']['Tables']['books']['Row']>;
      };
      authors: {
        Row: {
          id: number;
          name: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['authors']['Row']>;
        Update: Partial<Database['public']['Tables']['authors']['Row']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
