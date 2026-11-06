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

export type WorkspaceProfile = {
  businessName: string;
  agentName: string;
  description: string;
  tone: string;
  contactEmail: string;
};

export type WorkspaceSource = Source & {
  question: string;
  approved: boolean;
};

export type Publication = {
  slug: string;
  status: "live" | "paused";
  publishedAt: string;
};

export type WorkspaceState = {
  profile: WorkspaceProfile | null;
  sources: WorkspaceSource[];
  publication: Publication | null;
  tested: boolean;
  modelConfigured: boolean;
  unpublishedChanges: boolean;
};

export type Session = { email: string };
export type AccountCreated = { account: Session; recoveryCode: string };

export type CustomerAgent = {
  businessName: string;
  agentName: string;
  contactEmail: string;
  status: "live" | "paused" | "demo";
  suggestions: string[];
};

export type Answer = { text: string; handoff: boolean };
export type PreviewAnswer = Answer & {
  source: { id: string; title: string } | null;
};
export type CustomerMessage = { role: Message["role"]; content: string };

export type Handoff = {
  email: string;
  status: "open" | "resolved";
  createdAt: string;
};

export type InboxItem = Conversation & { handoff: Handoff | null };
export type InboxThread = InboxItem & { messages: Message[] };
