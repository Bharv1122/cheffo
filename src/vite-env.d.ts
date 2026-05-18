/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Opt-in flag for AI recipe image generation. Non-secret. Set to "true" only
  // when the server-side LLM proxy (api/llm.ts) targets an image-capable
  // backend. The LLM key itself is server-side only — never a VITE_ var.
  readonly VITE_IMAGE_GEN_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
