export type Page =
  | "overview"
  | "agents"
  | "knowledge"
  | "business"
  | "chat"
  | "settings";
export type Agent = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  icon: string;
  color: string;
  model: string;
  sourceIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Source = {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};
export type Business = {
  name: string;
  industry: string;
  description: string;
  audience: string;
  products: string;
  tone: string;
  website: string;
};
export type Conversation = {
  id: string;
  agentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
export type Settings = {
  configured: boolean;
  keySource: "environment" | "local" | "none";
  model: string;
};
export type AppState = {
  agents: Agent[];
  sources: Source[];
  business: Business;
  conversations: Conversation[];
  settings: Settings;
};
