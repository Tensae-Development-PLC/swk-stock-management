"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { TableWrap, Td, Th, THead } from "@/components/ui/table";
import { locationsApi } from "@/lib/api/endpoints";
import { ApiRequestError } from "@/lib/api/client";

export default function LocationsPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["locations"], queryFn: () => locationsApi.list() });
  const form = useForm({
    defaultValues: { name: "", code: "", address: "", contactPerson: "", phone: "" },
  });

  return (
    <div>
      <PageHeader
        title="Locations"
        description="SWK warehouses and regions."
        actions={<Button onClick={() => setOpen(true)}>New location</Button>}
      />
      <TableWrap>
        <THead>
          <tr>
            <Th>Location</Th>
            <Th>Code</Th>
            <Th>Address</Th>
            <Th>Contact</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <tbody>
          {query.data?.data.map((l) => (
            <tr key={l.id} className="border-t border-line">
              <Td className="font-medium">{l.name}</Td>
              <Td className="font-mono">{l.code}</Td>
              <Td>{l.address ?? "—"}</Td>
              <Td>
                {l.contactPerson ?? "—"}
                {l.phone ? ` · ${l.phone}` : ""}
              </Td>
              <Td>{l.isActive ? "Active" : "Inactive"}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Dialog open={open} onClose={() => setOpen(false)} title="New location">
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await locationsApi.create(v);
              toast.success("Location created");
              await qc.invalidateQueries({ queryKey: ["locations"] });
              setOpen(false);
            } catch (e) {
              toast.error(e instanceof ApiRequestError ? e.message : "Failed");
            }
          })}
        >
          <div>
            <Label>Name</Label>
            <Input {...form.register("name", { required: true })} />
          </div>
          <div>
            <Label>Code</Label>
            <Input {...form.register("code", { required: true })} />
          </div>
          <div>
            <Label>Address</Label>
            <Input {...form.register("address")} />
          </div>
          <div>
            <Label>Contact person</Label>
            <Input {...form.register("contactPerson")} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input {...form.register("phone")} />
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
