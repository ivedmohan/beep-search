import { adapters } from "@/lib/sources";
import { listSources } from "@/lib/queries/admin";
import { SourcesTable, type SourceWithUrl } from "@/components/admin/SourcesTable";
import { AddSourceForm } from "@/components/admin/AddSourceForm";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const rows = await listSources();
  const sources: SourceWithUrl[] = rows.map((s) => ({ ...s, boardUrl: adapters[s.kind].boardUrl(s.token) }));
  const enabled = sources.filter((s) => s.enabled).length;
  const erroring = sources.filter((s) => s.enabled && s.lastStatus === "error").length;

  return (
    <div>
      <PageHeader title="Sources" subtitle={`${sources.length} boards · ${enabled} enabled · ${erroring} erroring`}>
        <AddSourceForm />
      </PageHeader>
      <SourcesTable sources={sources} />
    </div>
  );
}
