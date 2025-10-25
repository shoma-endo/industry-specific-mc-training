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
  created_by: string;
  created_at: string;
}

export interface CreatePromptTemplateInput {
  name: string;
  display_name: string;
  content: string;
  variables: PromptVariable[];
  created_by: string;
}

export interface UpdatePromptTemplateInput {
  name?: string;
  display_name?: string;
  content?: string;
  variables?: PromptVariable[];
  updated_by: string;
}

export interface PromptTemplateWithVersions extends PromptTemplate {
  versions: PromptVersion[];
}
