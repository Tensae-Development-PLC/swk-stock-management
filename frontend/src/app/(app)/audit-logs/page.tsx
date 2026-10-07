"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { TableWrap, Td, Th, THead } from "@/components/ui/table";
import { auditApi } from "@/lib/api/endpoints";
import { formatDateTime } from "@/lib/format";

export default function AuditPage() {
  const query = useQuery({ queryKey: ["audit"], queryFn: () => auditApi.list({ limit: 50 }) });
  return (
    <div>
      <PageHeader title="Audit log" description="Read-only trail of stock, auth, and user actions." />
      {query.isLoading ? (
        <TableSkeleton />
      ) : !query.data?.data.length ? (
        <EmptyState title="No audit events" body="Actions will appear here as the system is used." />
      ) : (
        <TableWrap minWidth="800px">
          <THead>
            <tr>
              <Th>When</Th>
              <Th>User</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>IP</Th>
            </tr>
          </THead>
          <tbody>
            {query.data.data.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <Td>{formatDateTime(a.createdAt)}</Td>
                <Td>{a.user ? `${a.user.firstName} ${a.user.lastName}` : "—"}</Td>
                <Td>{a.action}</Td>
                <Td>
                  {a.entity} {a.entityId ? `· ${a.entityId.slice(0, 8)}` : ""}
                </Td>
                <Td className="font-mono text-xs">{a.ipAddress ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
