export type ChangeStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflict";

export type ChangeItem = {
  path: string;
  status: ChangeStatus;
  oldPath?: string;
  hunks?: number;
};

export type DiffData = {
  diff: string;
  language?: string;
  added: number;
  deleted: number;
  message?: string;
};
