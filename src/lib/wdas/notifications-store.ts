import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { ApiNotificationDto } from "@/lib/api/types";

export type NotificationType =
  | "new_request"
  | "sla_reminder"
  | "escalation"
  | "rejected"
  | "returned"
  | "cancelled"
  | "finalized"
  | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  docId: string;
}

function mapEventType(eventType: string): NotificationType {
  switch (eventType) {
    case "SubmittedForApproval":
      return "new_request";
    case "SlaBreach":
      return "sla_reminder";
    case "Rejected":
      return "rejected";
    case "ReturnedForCorrection":
      return "returned";
    case "Cancelled":
      return "cancelled";
    case "Finalized":
      return "finalized";
    default:
      return "system";
  }
}

function mapNotification(dto: ApiNotificationDto): AppNotification {
  return {
    id: dto.id,
    type: mapEventType(dto.eventType),
    title: dto.subject,
    description: dto.body,
    createdAt: dto.createdAtUtc,
    read: !!dto.readAtUtc,
    docId: dto.documentId ?? "",
  };
}

const cache: Record<string, AppNotification[]> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function refresh(userId: string) {
  try {
    const rows = await api.get<ApiNotificationDto[]>("/api/notifications?take=50");
    cache[userId] = rows.map(mapNotification);
    emit();
  } catch {
    if (!cache[userId]) cache[userId] = [];
  }
}

export function useUserNotifications(userId: string) {
  const [, tick] = useState(0);

  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    void refresh(userId);
    const interval = setInterval(() => void refresh(userId), 60_000);
    return () => {
      listeners.delete(listener);
      clearInterval(interval);
    };
  }, [userId]);

  return cache[userId] ?? [];
}

export async function markAllRead(_userId: string) {
  await api.post("/api/notifications/read-all");
  Object.keys(cache).forEach((k) => {
    cache[k] = (cache[k] ?? []).map((n) => ({ ...n, read: true }));
  });
  emit();
}

export async function markRead(_userId: string, id: string) {
  await api.post(`/api/notifications/${id}/read`);
  Object.keys(cache).forEach((k) => {
    cache[k] = (cache[k] ?? []).map((n) => (n.id === id ? { ...n, read: true } : n));
  });
  emit();
}

export function useRefreshNotifications() {
  return useCallback((userId: string) => refresh(userId), []);
}
