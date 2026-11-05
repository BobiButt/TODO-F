import { apiRequest } from "@/api/client";
import { ActivityLog, Page } from "@/types";

export async function fetchLogs(params: { page?: number; page_size?: number; action?: string; entity_type?: string; all_users?: boolean } = {}): Promise<Page<ActivityLog>> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.page_size ?? 50));
  if (params.action) q.set("action", params.action);
  if (params.entity_type) q.set("entity_type", params.entity_type);
  if (params.all_users) q.set("all_users", "true");
  return apiRequest<Page<ActivityLog>>(`/logs?${q.toString()}`);
}

export async function deleteLog(id: number): Promise<void> {
  await apiRequest(`/logs/${id}`, { method: "DELETE" });
}

export async function clearLogs(allUsers = false): Promise<number> {
  const res = await apiRequest<{ deleted: number }>(`/logs?all_users=${allUsers ? "true" : "false"}`, { method: "DELETE" });
  return res.deleted ?? 0;
}
