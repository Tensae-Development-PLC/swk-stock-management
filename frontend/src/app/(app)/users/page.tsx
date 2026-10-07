"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableWrap, Td, Th, THead } from "@/components/ui/table";
import { usersApi } from "@/lib/api/endpoints";
import { displayRole, STAFF_ROLES } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { ApiRequestError } from "@/lib/api/client";

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => usersApi.list({ limit: 50 }) });
  const roles = useQuery({ queryKey: ["roles"], queryFn: usersApi.roles });
  const form = useForm({
    defaultValues: { email: "", password: "", firstName: "", lastName: "", roleId: "" },
  });
  const staffRoles = (roles.data ?? []).filter((r) =>
    (STAFF_ROLES as readonly string[]).includes(r.name),
  );

  return (
    <div>
      <PageHeader
        title="Users"
        description="Admin and storekeeper accounts. Receivers scan a public link — they do not need an account."
        actions={<Button onClick={() => setOpen(true)}>New user</Button>}
      />
      {users.isLoading ? (
        <TableSkeleton />
      ) : !users.data?.data.length ? (
        <EmptyState title="No users" body="Create an admin or storekeeper account." />
      ) : (
        <TableWrap minWidth="720px">
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Last login</Th>
              <Th>Status</Th>
            </tr>
          </THead>
          <tbody>
            {users.data.data.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <Td>
                  {u.firstName} {u.lastName}
                </Td>
                <Td>{u.email}</Td>
                <Td>
                  <StatusBadge value={u.role.name === "SUPER_ADMIN" ? "ADMIN" : u.role.name} />
                </Td>
                <Td>{formatDateTime(u.lastLoginAt)}</Td>
                <Td>{u.isActive ? "Active" : "Inactive"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="New user">
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await usersApi.create(v);
              toast.success("User created");
              await qc.invalidateQueries({ queryKey: ["users"] });
              setOpen(false);
            } catch (e) {
              toast.error(e instanceof ApiRequestError ? e.message : "Could not create user");
            }
          })}
        >
          <div>
            <Label>First name</Label>
            <Input {...form.register("firstName", { required: true })} />
          </div>
          <div>
            <Label>Last name</Label>
            <Input {...form.register("lastName", { required: true })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" {...form.register("email", { required: true })} />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" {...form.register("password", { required: true, minLength: 8 })} />
          </div>
          <div>
            <Label>Role</Label>
            <Select {...form.register("roleId", { required: true })}>
              <option value="">Select</option>
              {staffRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {displayRole(r.name)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button>Save</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
