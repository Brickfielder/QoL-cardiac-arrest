import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getStudyDetail } from "@/lib/server/repository";

export default async function PdfViewerPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const detail = await getStudyDetail(params.id);

  if (!detail) {
    notFound();
  }

  if (!detail.study.pdfId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="PDF viewer"
          title={detail.study.title}
          description="This study does not currently have an active PDF attached."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PDF viewer"
        title={detail.study.title}
        description="The PDF is streamed through an authenticated route backed by private Blob storage."
      />
      <div className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-white/78">
        <iframe
          title={detail.study.title}
          src={`/api/studies/${detail.study.id}/pdf-assets`}
          className="h-[78vh] w-full bg-white"
        />
      </div>
    </div>
  );
}
