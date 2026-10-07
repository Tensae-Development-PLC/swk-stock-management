"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/field";
import { TableWrap, Td, Th, THead } from "@/components/ui/table";
import { categoriesApi } from "@/lib/api/endpoints";
import { ApiRequestError } from "@/lib/api/client";

export default function CategoriesPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const form = useForm({ defaultValues: { name: "", code: "", description: "" } });

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Loaded from the backend — not hard-coded."
        actions={<Button onClick={() => setOpen(true)}>New category</Button>}
      />
      <TableWrap>
        <THead>
          <tr>
            <Th>Category</Th>
            <Th>Code</Th>
            <Th>Description</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <tbody>
          {query.data?.data.map((c) => (
            <tr key={c.id} className="border-t border-line">
              <Td className="font-medium">{c.name}</Td>
              <Td className="font-mono">{c.code}</Td>
              <Td>{c.description ?? "—"}</Td>
              <Td>{c.isActive ? "Active" : "Inactive"}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Dialog open={open} onClose={() => setOpen(false)} title="New category">
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await categoriesApi.create(v);
              toast.success("Category created");
              await qc.invalidateQueries({ queryKey: ["categories"] });
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
            <Label>Description</Label>
            <Textarea {...form.register("description")} />
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
