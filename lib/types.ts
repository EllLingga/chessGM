export type Provider = "gemini" | "anthropic" | "openai" | "deepseek" | "custom";
export const PROVIDERS: Provider[] = ["gemini", "anthropic", "openai", "deepseek", "custom"];
export const PROVIDER_LABEL: Record<Provider, string> = {
  gemini: "Google Gemini", anthropic: "Anthropic Claude", openai: "OpenAI", deepseek: "DeepSeek", custom: "Custom (OpenAI-compatible)",
};
export type ProfilePublic = {
  id: string; name: string; provider: Provider; model: string; base_url: string | null;
  temperature: number | null; max_tokens: number; thinking_budget: number | null;
  system_prompt: string | null; timeout_s: number; max_retries: number; key_hint: string | null; created_at: string;
};
export type MoveRec = { san: string; uci: string; ms?: number; comment?: string; confidence?: number; tokens?: number };
export type ClsRec = { category: string; cpLoss: number; winLoss: number; bestUci: string; bestSan: string; reason: string };
export type AnalysisRec = {
  depth: number; evals: number[]; classes: ClsRec[];
  acc: { w: number; b: number }; acpl: { w: number; b: number };
  counts: { w: Record<string, number>; b: Record<string, number> };
};
