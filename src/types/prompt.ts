export interface PromptVariable {
  name: string;
  description: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  display_name: string;
  content: string;
  variables: PromptVariable[];
  version: number;
  is_active: boolean;
  created_by: string;
  updated_by?: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  template_id: string;
  version: number;
  content: string;
  change_summary?: string;
  created_by: string;
  created_at: string;
}

export interface CreatePromptTemplateInput {
  name: string;
  display_name: string;
  content: string;
  variables: PromptVariable[];
  is_active?: boolean;
  created_by: string;
}

export interface UpdatePromptTemplateInput {
  name?: string;
  display_name?: string;
  content?: string;
  variables?: PromptVariable[];
  is_active?: boolean;
  updated_by: string;
  change_summary?: string | undefined;
}

export interface PromptTemplateWithVersions extends PromptTemplate {
  versions: PromptVersion[];
}


export interface PromptCacheEntry {
  template: PromptTemplate;
  cached_at: string;
  expires_at: string;
}