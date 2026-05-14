// Recipe extracted from a chat response's ```recipe-json fenced block. Lives on
// the ChatMessage so the UI can offer a "Save to my recipes" action.
export interface ParsedChatRecipe {
  name: string;
  description: string;
  type: 'full_meal' | 'batch_week' | 'topper' | 'treat' | 'pantry';
  ingredients: Array<{
    name: string;
    grams: number;
    prepNote?: string;
  }>;
  instructions: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  parsedRecipe?: ParsedChatRecipe;
  savedRecipeId?: string;
}

export interface AssistantSession {
  id: string;
  dogProfileId?: string;
  messages: ChatMessage[];
  createdAt: string;
}

export type AssistantIntent =
  | 'food_question'
  | 'substitution'
  | 'calculation'
  | 'batch_scaling'
  | 'shopping'
  | 'supplement'
  | 'safety'
  | 'treat_idea'
  | 'cooking_help'
  | 'general';

export interface AssistantContext {
  dogName?: string;
  dogWeightLbs?: number;
  activeRecipeName?: string;
  recentMessages: ChatMessage[];
}
