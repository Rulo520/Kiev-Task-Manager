export type Role = "agency" | "client";

export type User = {
  id: string;
  first_name: string;
  last_name: string;
  profile_pic: string | null;
  role: Role;
  location_id: string | null;
  company_name: string | null;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  location_id: string | null;
  created_by?: string | null;
  created_by_role?: string | null;
};

export type TaskLabel = {
  label: Label;
};

export type TaskAssignee = {
  user: User;
};

export type ChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
};

export type Attachment = {
  id: string;
  task_id: string;
  name: string;
  url: string;
  type: string;
  created_by: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  task_id: string;
  user_id: string | null;
  user?: User;
  content: string;
  type: "internal" | "external";
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  column_id: string;
  previous_column_id?: string | null;
  position: number;
  created_by: string;
  location_id: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assignees: TaskAssignee[];
  labels: TaskLabel[];
  checklists?: ChecklistItem[];
  attachments?: Attachment[];
  comments?: Comment[];
  creator?: User;
  created_at: string;
  updated_at: string;
};

export type Column = {
  id: string;
  title: string;
  position: number;
  is_visible_to_client?: boolean;
  location_id: string | null;
};
