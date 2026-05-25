export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LifeStage = 'puppy' | 'adult' | 'senior';
export type ActivityLevel = 'low' | 'moderate' | 'active' | 'very_active';
export type TexturePreference = 'soft' | 'chunky' | 'brothy' | 'dry_topper';
export type ParentSkillLevel = 'beginner' | 'some_experience' | 'very_comfortable';
export type RecipeType = 'topper' | 'full_meal' | 'batch_week' | 'pantry' | 'treat';
export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'approved_with_notes'
  | 'declined'
  | 'expired';

export type Database = {
  public: {
    Tables: {
      dog_profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          breed: string;
          age_years: number;
          age_months: number;
          weight_lbs: number;
          ideal_weight_lbs: number | null;
          life_stage: LifeStage;
          activity_level: ActivityLevel;
          meals_per_day: number;
          allergies: string[];
          avoid_foods: string[];
          medications: string[];
          favorite_proteins: string[];
          picky_eater: boolean;
          texture_preference: TexturePreference;
          parent_skill_level: ParentSkillLevel;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          breed: string;
          age_years: number;
          age_months: number;
          weight_lbs: number;
          ideal_weight_lbs?: number | null;
          life_stage: LifeStage;
          activity_level: ActivityLevel;
          meals_per_day: number;
          allergies?: string[];
          avoid_foods?: string[];
          medications?: string[];
          favorite_proteins?: string[];
          picky_eater?: boolean;
          texture_preference: TexturePreference;
          parent_skill_level: ParentSkillLevel;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          breed?: string;
          age_years?: number;
          age_months?: number;
          weight_lbs?: number;
          ideal_weight_lbs?: number | null;
          life_stage?: LifeStage;
          activity_level?: ActivityLevel;
          meals_per_day?: number;
          allergies?: string[];
          avoid_foods?: string[];
          medications?: string[];
          favorite_proteins?: string[];
          picky_eater?: boolean;
          texture_preference?: TexturePreference;
          parent_skill_level?: ParentSkillLevel;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          active_profile_id: string | null;
          preferred_units: 'imperial' | 'metric';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          active_profile_id?: string | null;
          preferred_units?: 'imperial' | 'metric';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          active_profile_id?: string | null;
          preferred_units?: 'imperial' | 'metric';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      approvals: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          dog_profile_id: string;
          recipe_snapshot: Json;
          nutrition_envelope: Json;
          vet_email: string;
          vet_name: string | null;
          vet_practice: string | null;
          vet_state: string | null;
          vet_signature_confirmed: boolean;
          status: ApprovalStatus;
          notes: string | null;
          supplement_doses: Json | null;
          recipe_updated_by_vet: boolean;
          token_hash: string;
          token_expires_at: string;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          dog_profile_id: string;
          recipe_snapshot: Json;
          nutrition_envelope: Json;
          vet_email: string;
          vet_name?: string | null;
          vet_practice?: string | null;
          vet_state?: string | null;
          vet_signature_confirmed?: boolean;
          status?: ApprovalStatus;
          notes?: string | null;
          supplement_doses?: Json | null;
          recipe_updated_by_vet?: boolean;
          token_hash: string;
          token_expires_at: string;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recipe_id?: string;
          dog_profile_id?: string;
          recipe_snapshot?: Json;
          nutrition_envelope?: Json;
          vet_email?: string;
          vet_name?: string | null;
          vet_practice?: string | null;
          vet_state?: string | null;
          vet_signature_confirmed?: boolean;
          status?: ApprovalStatus;
          notes?: string | null;
          supplement_doses?: Json | null;
          recipe_updated_by_vet?: boolean;
          token_hash?: string;
          token_expires_at?: string;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_recipes: {
        Row: {
          id: string;
          user_id: string;
          dog_profile_id: string;
          name: string;
          description: string;
          type: RecipeType;
          recipe_data: Json;
          is_favorite: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          dog_profile_id: string;
          name: string;
          description: string;
          type: RecipeType;
          recipe_data: Json;
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          dog_profile_id?: string;
          name?: string;
          description?: string;
          type?: RecipeType;
          recipe_data?: Json;
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_and_increment_llm_usage: {
        Args: { p_user_id: string; p_daily_limit: number };
        Returns: { allowed: boolean; current_count: number }[];
      };
      check_and_increment_ip_rate_limit: {
        Args: {
          p_ip_hash: string;
          p_scope: string;
          p_window_seconds: number;
          p_limit: number;
        };
        Returns: { allowed: boolean; current_count: number }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type DogProfileRow = Database['public']['Tables']['dog_profiles']['Row'];
export type DogProfileInsert = Database['public']['Tables']['dog_profiles']['Insert'];
export type DogProfileUpdate = Database['public']['Tables']['dog_profiles']['Update'];

export type UserPreferenceRow = Database['public']['Tables']['user_preferences']['Row'];
export type UserPreferenceInsert = Database['public']['Tables']['user_preferences']['Insert'];

export type SavedRecipeRow = Database['public']['Tables']['saved_recipes']['Row'];
export type SavedRecipeInsert = Database['public']['Tables']['saved_recipes']['Insert'];

export type ApprovalRow = Database['public']['Tables']['approvals']['Row'];
export type ApprovalInsert = Database['public']['Tables']['approvals']['Insert'];
export type ApprovalUpdate = Database['public']['Tables']['approvals']['Update'];
