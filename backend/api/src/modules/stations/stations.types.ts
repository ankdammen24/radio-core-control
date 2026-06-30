export interface Station {
  name: string;
  slug: string;
  apiDomain?: string;
  status: "active" | "inactive";
  createdAt?: Date;
  updatedAt?: Date;
}
