"use client";

import { FormEvent, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Tenant = {
  organization_id: string;
  name: string;
  slug: string;
  organization_status: string;
  logo_url: string | null;
  metadata: Record<string, unknown> | null;
  member_count: number;
  created_at: string;
};

type Member = {
  member_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  member_status: string;
  is_owner: boolean;
  role_codes: string[] | null;
};

type Invitation = {
  invitation_id: string;
  email: string;
  invitation_status: string;
  role_code: string | null;
  expires_at: string;
  created_at: string;
};

type Props = {
  initialIsPlatformAdmin: boolean;
  initialTenants: Tenant[];
};

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  member: "Colaborador",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function tenantProductLabel(tenant: Tenant) {
  const value = tenant.metadata?.productLabel;
  return typeof value === "string" && value.trim() ? value : "Plataforma Enterprise";
}

export function PlatformControlCenter({
  initialIsPlatformAdmin,
  initialTenants,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(initialIsPlatformAdmin);
  const [tenants, setTenants] = useState(initialTenants);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(
    initialTenants.find((tenant) => tenant.slug === "semeali") ?? initialTenants[0] ?? null,
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [productLabel, setProductLabel] = useState("Plataforma Enterprise");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [generatedLink, setGeneratedLink] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function refreshTenants() {
    const { data, error } = await supabase.rpc("list_platform_tenants");
    if (error) throw error;
    const next = (data ?? []) as Tenant[];
    setTenants(next);
    return next;
  }

  async function bootstrap() {
    setMessage("");
    setErrorMessage("");
    setIsWorking(true);

    try {
      const { data, error } = await supabase.rpc("bootstrap_platform_owner");
      if (error || !data) {
        setErrorMessage("Não foi possível ativar o Control Center. O usuário precisa ser proprietário da organização Államo.");
        return;
      }
      setIsPlatformAdmin(true);
      const next = await refreshTenants();
      setSelectedTenant(next.find((tenant) => tenant.slug === "semeali") ?? next[0] ?? null);
      setMessage("Control Center Államo ativado para este usuário.");
    } catch {
      setErrorMessage("Ocorreu um erro ao ativar o Control Center.");
    } finally {
      setIsWorking(false);
    }
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setGeneratedLink("");
    setIsWorking(true);

    try {
      const { data, error } = await supabase.rpc("platform_create_tenant", {
        p_name: tenantName.trim(),
        p_slug: tenantSlug.trim().toLowerCase(),
        p_segment: "empresa",
        p_product_label: productLabel.trim() || "Plataforma Enterprise",
      });

      if (error || !data) {
        setErrorMessage("Não foi possível criar a empresa. Verifique nome, slug e se o identificador já existe.");
        return;
      }

      const next = await refreshTenants();
      const created = next.find((tenant) => tenant.organization_id === data) ?? null;
      setSelectedTenant(created);
      setTenantName("");
      setTenantSlug("");
      setProductLabel("Plataforma Enterprise");
      setMembers([]);
      setInvitations([]);
      setMessage("Empresa criada no Control Center. Agora você pode liberar os acessos do cliente.");
    } catch {
      setErrorMessage("Ocorreu um erro inesperado ao criar a empresa.");
    } finally {
      setIsWorking(false);
    }
  }

  async function loadTenantAccess(tenant: Tenant) {
    setSelectedTenant(tenant);
    setGeneratedLink("");
    setMessage("");
    setErrorMessage("");
    setIsWorking(true);

    try {
      const [{ data: memberData, error: memberError }, { data: invitationData, error: invitationError }] =
        await Promise.all([
          supabase.rpc("platform_list_organization_members", {
            p_organization_id: tenant.organization_id,
          }),
          supabase.rpc("platform_list_organization_invitations", {
            p_organization_id: tenant.organization_id,
          }),
        ]);

      if (memberError || invitationError) {
        setErrorMessage("Não foi possível carregar os acessos desta empresa.");
        return;
      }

      setMembers((memberData ?? []) as Member[]);
      setInvitations((invitationData ?? []) as Invitation[]);
    } catch {
      setErrorMessage("Ocorreu um erro ao carregar os acessos.");
    } finally {
      setIsWorking(false);
    }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenant) return;

    setMessage("");
    setErrorMessage("");
    setGeneratedLink("");
    setIsWorking(true);

    const normalizedEmail = inviteEmail.trim().toLowerCase();

    try {
      const { data, error } = await supabase.rpc("platform_create_organization_invitation", {
        p_organization_id: selectedTenant.organization_id,
        p_email: normalizedEmail,
        p_role_code: inviteRole,
        p_expires_hours: 168,
      });

      if (error) {
        if (error.message.toLowerCase().includes("already_member")) {
          setErrorMessage("Este e-mail já possui acesso ativo à empresa.");
        } else {
          setErrorMessage("Não foi possível gerar o convite para esta empresa.");
        }
        return;
      }

      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.invitation_token) {
        setErrorMessage("O convite foi criado sem retornar um token utilizável.");
        return;
      }

      const link = `${window.location.origin}/convite?token=${encodeURIComponent(created.invitation_token)}`;
      setGeneratedLink(link);
      setInviteEmail("");
      setMessage(`Acesso da ${selectedTenant.name} criado. Copie o link e envie somente para ${normalizedEmail}.`);
      await loadTenantAccess(selectedTenant);
      setGeneratedLink(link);
      setMessage(`Acesso da ${selectedTenant.name} criado. Copie o link e envie somente para ${normalizedEmail}.`);
    } catch {
      setErrorMessage("Ocorreu um erro ao gerar o acesso do cliente.");
    } finally {
      setIsWorking(false);
    }
  }

  async function copyLink() {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setMessage("Link copiado. Ele expira em 7 dias e funciona apenas para o e-mail convidado.");
    } catch {
      setErrorMessage("Não foi possível copiar automaticamente. Selecione e copie o link manualmente.");
    }
  }

  async function cancelInvitation(invitationId: string) {
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase.rpc("platform_cancel_organization_invitation", {
      p_invitation_id: invitationId,
    });

    if (error) {
      setErrorMessage("Não foi possível cancelar o convite.");
      return;
    }

    setInvitations((current) =>
      current.map((item) =>
        item.invitation_id === invitationId
          ? { ...item, invitation_status: "cancelled" }
          : item,
      ),
    );
    setMessage("Convite cancelado.");
  }

  if (!isPlatformAdmin) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Államo Control Center</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Ativar administração da plataforma</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          A ativação inicial é permitida somente ao proprietário da organização Államo e só funciona enquanto ainda não existe um administrador da plataforma.
        </p>
        {errorMessage ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
        <button
          className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={isWorking}
          onClick={bootstrap}
          type="button"
        >
          {isWorking ? "Ativando..." : "Ativar Control Center"}
        </button>
      </section>
    );
  }

  const pendingInvitations = invitations.filter((item) => item.invitation_status === "pending");

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Államo Control Center</p>
        <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Empresas white-label</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Cadastre clientes, escolha a experiência contratada e libere acessos individuais sem compartilhar credenciais.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Tenants cadastrados</span>
            <strong className="mt-1 block text-3xl">{tenants.length}</strong>
          </div>
        </div>
      </section>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {errorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-950">Cadastrar nova empresa</h2>
          <p className="mt-1 text-sm text-slate-500">Cria o tenant sem misturar dados ou usuários com outras organizações.</p>
        </header>
        <form className="grid gap-4 p-6 xl:grid-cols-[1fr_220px_260px_auto] xl:items-end" onSubmit={createTenant}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="tenant-name">Empresa</label>
            <input className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-700 focus:ring-4 focus:ring-slate-100" id="tenant-name" onChange={(event) => setTenantName(event.target.value)} placeholder="Ex.: Semeali" required value={tenantName} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="tenant-slug">Identificador</label>
            <input className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-700 focus:ring-4 focus:ring-slate-100" id="tenant-slug" onChange={(event) => setTenantSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="semeali" required value={tenantSlug} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="tenant-product">Produto</label>
            <input className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-700 focus:ring-4 focus:ring-slate-100" id="tenant-product" onChange={(event) => setProductLabel(event.target.value)} value={productLabel} />
          </div>
          <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isWorking} type="submit">Criar empresa</button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-950">Empresas</h2>
          <p className="mt-1 text-sm text-slate-500">Selecione uma empresa para administrar os acessos.</p>
        </header>
        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {tenants.map((tenant) => (
            <button
              className={[
                "rounded-2xl border p-5 text-left transition",
                selectedTenant?.organization_id === tenant.organization_id
                  ? "border-slate-950 bg-slate-50 ring-1 ring-slate-950"
                  : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50",
              ].join(" ")}
              key={tenant.organization_id}
              onClick={() => loadTenantAccess(tenant)}
              type="button"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">{tenant.name.slice(0, 2).toUpperCase()}</div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{tenant.organization_status}</span>
              </div>
              <h3 className="mt-4 font-bold text-slate-950">{tenant.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{tenant.slug} · {tenantProductLabel(tenant)}</p>
              <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500"><strong className="text-slate-800">{tenant.member_count}</strong> usuários ativos</div>
            </button>
          ))}
        </div>
      </section>

      {selectedTenant ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Empresa selecionada</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedTenant.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Crie um link individual para a equipe do cliente.</p>
          </header>

          <form className="grid gap-4 p-6 lg:grid-cols-[1fr_220px_auto] lg:items-end" onSubmit={createInvitation}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="platform-invite-email">E-mail do cliente</label>
              <input className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-700 focus:ring-4 focus:ring-slate-100" id="platform-invite-email" onChange={(event) => setInviteEmail(event.target.value)} placeholder="nome@cliente.com.br" required type="email" value={inviteEmail} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="platform-invite-role">Perfil</label>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-700 focus:ring-4 focus:ring-slate-100" id="platform-invite-role" onChange={(event) => setInviteRole(event.target.value)} value={inviteRole}>
                <option value="admin">Administrador</option>
                <option value="manager">Gestor</option>
                <option value="member">Colaborador</option>
              </select>
            </div>
            <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60" disabled={isWorking} type="submit">Gerar acesso</button>
          </form>

          {generatedLink ? (
            <div className="mx-6 mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Link para compartilhar</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700" readOnly value={generatedLink} />
                <button className="rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100" onClick={copyLink} type="button">Copiar link</button>
              </div>
            </div>
          ) : null}

          <div className="grid border-t border-slate-200 xl:grid-cols-2">
            <div className="border-b border-slate-200 p-6 xl:border-b-0 xl:border-r">
              <h3 className="font-bold text-slate-950">Usuários ativos</h3>
              <div className="mt-4 space-y-3">
                {members.length ? members.map((member) => (
                  <div className="rounded-xl border border-slate-200 p-4" key={member.member_id}>
                    <strong className="text-sm text-slate-950">{member.full_name || member.email || "Usuário"}</strong>
                    <p className="mt-1 text-xs text-slate-500">{member.email || "E-mail indisponível"}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-600">{member.is_owner ? "Proprietário" : (member.role_codes ?? []).map((code) => roleLabels[code] ?? code).join(", ") || "Colaborador"}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">Selecione a empresa para carregar os usuários.</p>}
              </div>
            </div>

            <div className="p-6">
              <h3 className="font-bold text-slate-950">Convites pendentes</h3>
              <div className="mt-4 space-y-3">
                {pendingInvitations.length ? pendingInvitations.map((invitation) => (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4" key={invitation.invitation_id}>
                    <div><strong className="text-sm text-slate-950">{invitation.email}</strong><p className="mt-1 text-xs text-slate-500">{roleLabels[invitation.role_code ?? ""] ?? invitation.role_code ?? "Colaborador"} · expira {formatDate(invitation.expires_at)}</p></div>
                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600" onClick={() => cancelInvitation(invitation.invitation_id)} type="button">Cancelar</button>
                  </div>
                )) : <p className="text-sm text-slate-500">Nenhum convite pendente.</p>}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
