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
      _SimilarAuthors: {
        Row: {
          A: number
          B: number
        }
        Insert: {
          A: number
          B: number
        }
        Update: {
          A?: number
          B?: number
        }
        Relationships: []
      }
      _SimilarBooks: {
        Row: {
          A: number
          B: number
        }
        Insert: {
          A: number
          B: number
        }
        Update: {
          A?: number
          B?: number
        }
        Relationships: []
      }
      Author: {
        Row: {
          birthDate: string | null
          description: string | null
          id: number
          image: string | null
          inventaireUri: string | null
          isEnriching: boolean
          lastDiscoveredAt: string | null
          lastEnrichedAt: string | null
          name: string
          nationality: string | null
        }
        Insert: {
          birthDate?: string | null
          description?: string | null
          id?: number
          image?: string | null
          inventaireUri?: string | null
          isEnriching?: boolean
          lastDiscoveredAt?: string | null
          lastEnrichedAt?: string | null
          name: string
          nationality?: string | null
        }
        Update: {
          birthDate?: string | null
          description?: string | null
          id?: number
          image?: string | null
          inventaireUri?: string | null
          isEnriching?: boolean
          lastDiscoveredAt?: string | null
          lastEnrichedAt?: string | null
          name?: string
          nationality?: string | null
        }
        Relationships: []
      }
      Book: {
        Row: {
          authorId: number | null
          buyLinks: string | null
          cover: string | null
          description: string | null
          genre: string | null
          googleId: string | null
          id: number
          inventaireUri: string | null
          isEnriching: boolean
          lastDiscoveredAt: string | null
          lastEnrichedAt: string | null
          openLibraryId: string | null
          pages: number | null
          rating: number | null
          title: string
          year: number | null
        }
        Insert: {
          authorId?: number | null
          buyLinks?: string | null
          cover?: string | null
          description?: string | null
          genre?: string | null
          googleId?: string | null
          id?: number
          inventaireUri?: string | null
          isEnriching?: boolean
          lastDiscoveredAt?: string | null
          lastEnrichedAt?: string | null
          openLibraryId?: string | null
          pages?: number | null
          rating?: number | null
          title: string
          year?: number | null
        }
        Update: {
          authorId?: number | null
          buyLinks?: string | null
          cover?: string | null
          description?: string | null
          genre?: string | null
          googleId?: string | null
          id?: number
          inventaireUri?: string | null
          isEnriching?: boolean
          lastDiscoveredAt?: string | null
          lastEnrichedAt?: string | null
          openLibraryId?: string | null
          pages?: number | null
          rating?: number | null
          title?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Book_authorId_fkey"
            columns: ["authorId"]
            isOneToOne: false
            referencedRelation: "Author"
            referencedColumns: ["id"]
          },
        ]
      }
      Edition: {
        Row: {
          bookId: number
          cover: string | null
          createdAt: string
          id: number
          inventaireUri: string
          isbn: string | null
          languageUri: string | null
          pages: number | null
          publishDate: string | null
          publisherName: string | null
          publisherUri: string | null
          title: string | null
        }
        Insert: {
          bookId: number
          cover?: string | null
          createdAt?: string
          id?: number
          inventaireUri: string
          isbn?: string | null
          languageUri?: string | null
          pages?: number | null
          publishDate?: string | null
          publisherName?: string | null
          publisherUri?: string | null
          title?: string | null
        }
        Update: {
          bookId?: number
          cover?: string | null
          createdAt?: string
          id?: number
          inventaireUri?: string
          isbn?: string | null
          languageUri?: string | null
          pages?: number | null
          publishDate?: string | null
          publisherName?: string | null
          publisherUri?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Edition_bookId_fkey"
            columns: ["bookId"]
            isOneToOne: false
            referencedRelation: "Book"
            referencedColumns: ["id"]
          },
        ]
      }
      ForbiddenWord: {
        Row: {
          createdAt: string
          id: number
          word: string
        }
        Insert: {
          createdAt?: string
          id?: number
          word: string
        }
        Update: {
          createdAt?: string
          id?: number
          word?: string
        }
        Relationships: []
      }
      Laureate: {
        Row: {
          authorId: number
          bookId: number | null
          id: number
          prizeId: number
          year: number
        }
        Insert: {
          authorId: number
          bookId?: number | null
          id?: number
          prizeId: number
          year: number
        }
        Update: {
          authorId?: number
          bookId?: number | null
          id?: number
          prizeId?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "Laureate_authorId_fkey"
            columns: ["authorId"]
            isOneToOne: false
            referencedRelation: "Author"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Laureate_bookId_fkey"
            columns: ["bookId"]
            isOneToOne: false
            referencedRelation: "Book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Laureate_prizeId_fkey"
            columns: ["prizeId"]
            isOneToOne: false
            referencedRelation: "LiteraryPrize"
            referencedColumns: ["id"]
          },
        ]
      }
      Like: {
        Row: {
          createdAt: string
          id: number
          quoteId: number
          userId: string
        }
        Insert: {
          createdAt?: string
          id?: number
          quoteId: number
          userId: string
        }
        Update: {
          createdAt?: string
          id?: number
          quoteId?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Like_quoteId_fkey"
            columns: ["quoteId"]
            isOneToOne: false
            referencedRelation: "Quote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Like_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      LiteraryPrize: {
        Row: {
          description: string | null
          id: number
          image: string | null
          inventaireUri: string | null
          name: string
          wikipediaTitle: string | null
        }
        Insert: {
          description?: string | null
          id?: number
          image?: string | null
          inventaireUri?: string | null
          name: string
          wikipediaTitle?: string | null
        }
        Update: {
          description?: string | null
          id?: number
          image?: string | null
          inventaireUri?: string | null
          name?: string
          wikipediaTitle?: string | null
        }
        Relationships: []
      }
      Profile: {
        Row: {
          bio: string | null
          expoPushToken: string | null
          followers: number
          following: number
          id: string
          image: string | null
          isAdmin: boolean | null
          isPublic: boolean | null
          name: string | null
          notifyOnFollow: boolean
          notifyOnLike: boolean
          username: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          expoPushToken?: string | null
          followers?: number
          following?: number
          id: string
          image?: string | null
          isAdmin?: boolean | null
          isPublic?: boolean | null
          name?: string | null
          notifyOnFollow?: boolean
          notifyOnLike?: boolean
          username: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          expoPushToken?: string | null
          followers?: number
          following?: number
          id?: string
          image?: string | null
          isAdmin?: boolean | null
          isPublic?: boolean | null
          name?: string | null
          notifyOnFollow?: boolean
          notifyOnLike?: boolean
          username?: string
          website?: string | null
        }
        Relationships: []
      }
      Quote: {
        Row: {
          aiInterpretation: string | null
          authorId: number | null
          blockData: string | null
          bookId: number | null
          date: string
          id: number
          isPublic: boolean | null
          likesCount: number
          text: string
          theme: string | null
          userId: string | null
        }
        Insert: {
          aiInterpretation?: string | null
          authorId?: number | null
          blockData?: string | null
          bookId?: number | null
          date?: string
          id?: number
          isPublic?: boolean | null
          likesCount?: number
          text: string
          theme?: string | null
          userId?: string | null
        }
        Update: {
          aiInterpretation?: string | null
          authorId?: number | null
          blockData?: string | null
          bookId?: number | null
          date?: string
          id?: number
          isPublic?: boolean | null
          likesCount?: number
          text?: string
          theme?: string | null
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Quote_authorId_fkey"
            columns: ["authorId"]
            isOneToOne: false
            referencedRelation: "Author"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Quote_bookId_fkey"
            columns: ["bookId"]
            isOneToOne: false
            referencedRelation: "Book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Quote_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      Report: {
        Row: {
          createdAt: string
          id: number
          reason: string
          reporterId: string
          reviewId: number | null
          status: string | null
        }
        Insert: {
          createdAt?: string
          id?: number
          reason: string
          reporterId: string
          reviewId?: number | null
          status?: string | null
        }
        Update: {
          createdAt?: string
          id?: number
          reason?: string
          reporterId?: string
          reviewId?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Report_reporterId_fkey"
            columns: ["reporterId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Report_reviewId_fkey"
            columns: ["reviewId"]
            isOneToOne: false
            referencedRelation: "Review"
            referencedColumns: ["id"]
          },
        ]
      }
      Review: {
        Row: {
          bookId: number
          comment: string | null
          createdAt: string
          id: number
          rating: number
          userId: string
        }
        Insert: {
          bookId: number
          comment?: string | null
          createdAt?: string
          id?: number
          rating: number
          userId: string
        }
        Update: {
          bookId?: number
          comment?: string | null
          createdAt?: string
          id?: number
          rating?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Review_bookId_fkey"
            columns: ["bookId"]
            isOneToOne: false
            referencedRelation: "Book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Review_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      SearchCache: {
        Row: {
          createdAt: string
          expiresAt: string
          id: number
          query: string
          results: string
          type: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id?: number
          query: string
          results: string
          type: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: number
          query?: string
          results?: string
          type?: string
        }
        Relationships: []
      }
      UserAuthor: {
        Row: {
          addedAt: string
          authorId: number
          userId: string
        }
        Insert: {
          addedAt?: string
          authorId: number
          userId: string
        }
        Update: {
          addedAt?: string
          authorId?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "UserAuthor_authorId_fkey"
            columns: ["authorId"]
            isOneToOne: false
            referencedRelation: "Author"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UserAuthor_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      UserBlock: {
        Row: {
          blockedId: string
          blockerId: string
          createdAt: string
          id: number
        }
        Insert: {
          blockedId: string
          blockerId: string
          createdAt?: string
          id?: number
        }
        Update: {
          blockedId?: string
          blockerId?: string
          createdAt?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "UserBlock_blockedId_fkey"
            columns: ["blockedId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UserBlock_blockerId_fkey"
            columns: ["blockerId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      UserBook: {
        Row: {
          addedAt: string
          addedViaQuote: boolean | null
          bookId: number
          status: string | null
          userId: string
        }
        Insert: {
          addedAt?: string
          addedViaQuote?: boolean | null
          bookId: number
          status?: string | null
          userId: string
        }
        Update: {
          addedAt?: string
          addedViaQuote?: boolean | null
          bookId?: number
          status?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "UserBook_bookId_fkey"
            columns: ["bookId"]
            isOneToOne: false
            referencedRelation: "Book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UserBook_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      UserFollow: {
        Row: {
          createdAt: string
          followerId: string
          followingId: string
          id: number
        }
        Insert: {
          createdAt?: string
          followerId: string
          followingId: string
          id?: number
        }
        Update: {
          createdAt?: string
          followerId?: string
          followingId?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "UserFollow_followerId_fkey"
            columns: ["followerId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UserFollow_followingId_fkey"
            columns: ["followingId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      UserQuote: {
        Row: {
          addedAt: string
          quoteId: number
          userId: string
        }
        Insert: {
          addedAt?: string
          quoteId: number
          userId: string
        }
        Update: {
          addedAt?: string
          quoteId?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "UserQuote_quoteId_fkey"
            columns: ["quoteId"]
            isOneToOne: false
            referencedRelation: "Quote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UserQuote_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      immutable_unaccent: { Args: { text: string }; Returns: string }
      seed_quotex_static_content: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unicode_translate: {
        Args: { from_text: string; text: string; to_text: string }
        Returns: string
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
