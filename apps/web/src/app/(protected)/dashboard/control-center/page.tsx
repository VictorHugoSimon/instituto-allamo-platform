import { PlatformControlCenter } from "@/components/platform/platform-control-center";
import { createClient } from "@/lib/supabase/server";

export default async function ControlCenterPage() {
  const supabase = await createClient();

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

  let tenants = [];

  if (isPlatformAdmin) {
    const { data } = await supabase.rpc("list_platform_tenants");
    tenants = data ?? [];
  }

  return (
    <PlatformControlCenter
      initialIsPlatformAdmin={Boolean(isPlatformAdmin)}
      initialTenants={tenants}
    />
  );
}
