"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/ui/empty-state";
import { TransferInspect } from "@/components/transfers/transfer-inspect";
import { transfersApi } from "@/lib/api/endpoints";

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["transfer", id],
    queryFn: () => transfersApi.one(id),
  });

  if (isLoading || !data) return <TableSkeleton />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={data.referenceNumber}
        description={`${data.sourceLocation?.name} → ${data.destinationLocation?.name}`}
      />
      <TransferInspect transfer={data} showCancel />
    </div>
  );
}
