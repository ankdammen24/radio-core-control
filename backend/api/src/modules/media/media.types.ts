export type MediaStatus = "active" | "archived";

export interface MediaFile {
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  fileUrl: string;
  storageKey: string;
  type: string;
  status: MediaStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateMediaInput {
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  fileUrl: string;
  storageKey: string;
  type: string;
  status?: MediaStatus;
}

export interface UpdateMediaInput {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  fileUrl?: string;
  storageKey?: string;
  type?: string;
  status?: MediaStatus;
}
