export type TenantModuleCode =
  | "overview"
  | "commercial"
  | "projects"
  | "crm"
  | "agenda"
  | "finance"
  | "documents"
  | "intelligence"
  | "access";

export type TenantExperience = {
  slug: string;
  productLabel: string;
  segmentLabel: string;
  modules: TenantModuleCode[];
};

const defaultExperience: TenantExperience = {
  slug: "default",
  productLabel: "Plataforma Enterprise",
  segmentLabel: "Gestão estratégica",
  modules: ["overview", "projects", "crm", "agenda", "finance", "documents", "intelligence", "access"],
};

const experiences: Record<string, TenantExperience> = {
  semeali: {
    slug: "semeali",
    productLabel: "Sales Intelligence",
    segmentLabel: "Inteligência comercial para o agronegócio",
    modules: ["overview", "commercial", "crm", "agenda", "documents", "intelligence", "access"],
  },
};

export function getTenantExperience(slug: string | null | undefined) {
  const normalized = slug?.trim().toLowerCase() || "default";
  return experiences[normalized] ?? defaultExperience;
}

export function tenantHasModule(
  slug: string | null | undefined,
  module: TenantModuleCode,
) {
  return getTenantExperience(slug).modules.includes(module);
}
