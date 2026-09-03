"use client";

import { FormEvent, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

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

type OrganizationAccessManagerProps = {
  organizationId: string;
  organizationName: string;
  canManage: boolean;
  initialMembers: Member[];
  initialInvitations: Invitation[];
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

function roleLabel(roleCode: string | null) {
  if (!roleCode) return "Colaborador";
  return roleLabels[roleCode] ?? roleCode;
}

export function OrganizationAccessManager({
  organizationId,
  organizationName,
  canManage,
  initialMembers,
  initialInvitations,
}: OrganizationAccessManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const [members] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [generatedLink, setGeneratedLink] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) return;

    setMessage("");
    setErrorMessage("");
    setGeneratedLink("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Informe o e-mail da pessoa que receberá o acesso.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("create_organization_invitation", {
        p_organization_id: organizationId,
        p_email: normalizedEmail,
        p_role_code: role,
        p_expires_hours: 168,
      });

      if (error) {
        const normalized = error.message.toLowerCase();
        if (normalized.includes("already_member")) {
          setErrorMessage("Este e-mail já possui acesso ativo à organização.");
        } else if (normalized.includes("only_owner")) {
          setErrorMessage("Somente o proprietário pode conceder perfil de administrador.");
        } else {
          setErrorMessage("Não foi possível gerar o convite. Verifique sua permissão e tente novamente.");
        }
        return;
      }

      const created = Array.isArray(data) ? data[0] : data;
      const token = created?.invitation_token;
      const invitationId = created?.invitation_id;
      const expiresAt = created?.invitation_expires_at;

      if (!token || !invitationId || !expiresAt) {
        setErrorMessage("O convite foi processado sem retornar um link válido.");
        return;
      }

      const link = `${window.location.origin}/convite?token=${encodeURIComponent(token)}`;
      setGeneratedLink(link);
      setMessage("Convite criado. Copie o link abaixo e envie somente para o e-mail informado.");
      setInvitations((current) => [
        {
          invitation_id: invitationId,
          email: normalizedEmail,
          invitation_status: "pending",
          role_code: role,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        },
        ...current.filter(
          (item) =>
            !(
              item.email.toLowerCase() === normalizedEmail &&
              item.invitation_status === "pending"
            ),
        ),
      ]);
      setEmail("");
    } catch {
      setErrorMessage("Ocorreu um erro inesperado ao gerar o convite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyInvitation() {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setMessage("Link copiado. Ele expira em 7 dias e funciona apenas para o e-mail convidado.");
    } catch {
      setErrorMessage("Não foi possível copiar automaticamente. Selecione o link e copie manualmente.");
    }
  }

  async function cancelInvitation(invitationId: string) {
    if (!canManage) return;

    setMessage("");
    setErrorMessage("");

    const { error } = await supabase.rpc("cancel_organization_invitation", {
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

  const pendingInvitations = invitations.filter(
    (item) => item.invitation_status === "pending",
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Governança de acesso
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Usuários e acessos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Compartilhe o acesso da {organizationName} sem compartilhar senhas. Cada convite fica vinculado ao e-mail, ao perfil e à organização correta.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-600">
            <span className="block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Usuários ativos
            </span>
            <strong className="mt-1 block text-2xl text-slate-950">
              {members.filter((member) => member.member_status === "active").length}
            </strong>
          </div>
        </div>
      </section>

      {canManage ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">Convidar pessoa</h2>
            <p className="mt-1 text-sm text-slate-500">
              O link é exibido uma única vez após a criação. Se ele for perdido, gere um novo convite para o mesmo e-mail.
            </p>
          </header>

          <form className="grid gap-4 p-6 lg:grid-cols-[1fr_220px_auto] lg:items-end" onSubmit={createInvitation}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="invite-email">
                E-mail
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
                disabled={isSubmitting}
                id="invite-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com.br"
                required
                type="email"
                value={email}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="invite-role">
                Perfil
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-700 focus:ring-4 focus:ring-slate-100"
                disabled={isSubmitting}
                id="invite-role"
                onChange={(event) => setRole(event.target.value)}
                value={role}
              >
                <option value="member">Colaborador</option>
                <option value="manager">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <button
              className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Gerando..." : "Gerar convite"}
            </button>
          </form>

          {generatedLink ? (
            <div className="mx-6 mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                Link de acesso
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700"
                  readOnly
                  value={generatedLink}
                />
                <button
                  className="rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                  onClick={copyInvitation}
                  type="button"
                >
                  Copiar link
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Você pode consultar os acessos, mas seu perfil não possui permissão para convidar ou cancelar usuários.
        </section>
      )}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col justify-between gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Pessoas com acesso</h2>
            <p className="mt-1 text-sm text-slate-500">Membros vinculados exclusivamente a esta organização.</p>
          </div>
          <span className="text-sm font-semibold text-slate-500">{members.length} cadastrados</span>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Pessoa</th>
                <th className="px-6 py-3">Perfil</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => {
                const roles = member.is_owner
                  ? ["Proprietário"]
                  : (member.role_codes ?? []).map((code) => roleLabel(code));

                return (
                  <tr key={member.member_id}>
                    <td className="px-6 py-4">
                      <strong className="block text-slate-950">
                        {member.full_name || member.email || "Usuário"}
                      </strong>
                      <span className="mt-1 block text-xs text-slate-500">
                        {member.email || "E-mail indisponível"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {roles.length ? roles.join(", ") : "Colaborador"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        {member.member_status === "active" ? "Ativo" : member.member_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col justify-between gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Convites pendentes</h2>
            <p className="mt-1 text-sm text-slate-500">Links ainda não utilizados.</p>
          </div>
          <span className="text-sm font-semibold text-slate-500">{pendingInvitations.length} pendentes</span>
        </header>

        {pendingInvitations.length ? (
          <div className="divide-y divide-slate-100">
            {pendingInvitations.map((invitation) => (
              <div className="flex flex-col justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center" key={invitation.invitation_id}>
                <div>
                  <strong className="text-slate-950">{invitation.email}</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {roleLabel(invitation.role_code)} · expira em {formatDate(invitation.expires_at)}
                  </p>
                </div>
                {canManage ? (
                  <button
                    className="self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:self-auto"
                    onClick={() => cancelInvitation(invitation.invitation_id)}
                    type="button"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            Nenhum convite pendente.
          </div>
        )}
      </section>
    </div>
  );
}
