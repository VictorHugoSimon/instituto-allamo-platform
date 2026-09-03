import { redirect } from "next/navigation";

import { OrganizationAccessManager } from "@/components/access/organization-access-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AccessPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=%2Fdashboard%2Facessos");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const organizationId = membership.organization_id;

  const [{ data: organization }, { data: canRead }, { data: canManage }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("id", organizationId)
        .single(),
      supabase.rpc("has_organization_permission", {
        p_organization_id: organizationId,
        p_permission_code: "members.read",
      }),
      supabase.rpc("has_organization_permission", {
        p_organization_id: organizationId,
        p_permission_code: "members.manage",
      }),
    ]);

  if (!organization) {
    redirect("/onboarding");
  }

  if (!canRead && !canManage) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Acesso restrito
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Usuários e acessos
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Seu perfil não possui permissão para consultar a gestão de usuários desta organização.
        </p>
      </section>
    );
  }

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.rpc("list_organization_members", {
      p_organization_id: organizationId,
    }),
    supabase.rpc("list_organization_invitations", {
      p_organization_id: organizationId,
    }),
  ]);

  return (
    <OrganizationAccessManager
      canManage={Boolean(canManage)}
      initialInvitations={invitations ?? []}
      initialMembers={members ?? []}
      organizationId={organizationId}
      organizationName={organization.name}
    />
  );
}
