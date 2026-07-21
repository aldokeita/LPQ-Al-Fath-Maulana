import { getServiceRoleClient } from "./supabaseAdmin.ts";

export type AppRole = "admin" | "guru" | "santri" | "pentashih";

export async function getUserRole(userId: string): Promise<AppRole | null> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("user_profiles")
    .select("role,status")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || data.status !== "active") return null;
  return data.role as AppRole;
}

export async function requireRole(userId: string, roles: AppRole[]): Promise<AppRole> {
  const role = await getUserRole(userId);
  if (!role || !roles.includes(role)) throw new Error("FORBIDDEN");
  return role;
}

export async function isGuruForSantri(guruId: string, santriId: string): Promise<boolean> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("class_memberships")
    .select("class_id, classes!inner(id_guru)")
    .eq("santri_id", santriId)
    .eq("status", "active");

  if (error || !data) return false;
  return data.some((row: any) => row.classes?.id_guru === guruId);
}
