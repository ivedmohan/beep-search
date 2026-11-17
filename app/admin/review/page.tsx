import { REVIEW_SAMPLE_SIZE, getReviewSample } from "@/lib/queries/admin";
import { ReviewList } from "@/components/admin/ReviewList";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  const rows = await getReviewSample();
  return (
    <div>
      <PageHeader
        title="Review"
        subtitle={`Stable random sample of ${rows.length}/${REVIEW_SAMPLE_SIZE} open canonical fresher jobs (seeded by md5(id), so the set does not shuffle between visits)`}
      >
        <a href="/api/admin/reviews/export" className="btn-ghost">
          Export CSV
        </a>
      </PageHeader>
      <ReviewList rows={rows} />
    </div>
  );
}
