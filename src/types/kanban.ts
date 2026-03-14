export type Role = "agency" | "client";

export type User = {
  id: string;
  first_name: string;
  last_name: string;
  profile_pic: string | null;
  role: Role;
};

export type TaskAssignee = {
  user: User;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  column_id: string;
  position: number;
  created_by: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assignees: TaskAssignee[];
  created_at: string;
  updated_at: string;
};

export type Column = {
  id: string;
  title: string;
  position: number;
};
