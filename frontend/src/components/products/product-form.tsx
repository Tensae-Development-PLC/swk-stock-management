"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { categoriesApi, productsApi } from "@/lib/api/endpoints";
import { ApiRequestError } from "@/lib/api/client";

const schema = z.object({
  itemName: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  unit: z.string().min(1, "Required"),
  brand: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid("Select a category"),
  isSerialized: z.boolean(),
});

export function ProductForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { isSerialized: true, unit: "PCS" },
  });

  return (
    <Dialog open={open} onClose={onClose} title="New product">
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (v) => {
          try {
            await productsApi.create({
              ...v,
              bcNumber: `P${Date.now().toString(36).toUpperCase()}`,
            });
            toast.success("Product created");
            await qc.invalidateQueries({ queryKey: ["products"] });
            onClose();
          } catch (e) {
            toast.error(e instanceof ApiRequestError ? e.message : "Could not create product");
          }
        })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Item name</Label>
            <Input {...form.register("itemName")} />
            <FieldError message={form.formState.errors.itemName?.message} />
          </div>
          <div>
            <Label>Model</Label>
            <Input {...form.register("model")} />
            <FieldError message={form.formState.errors.model?.message} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Unit</Label>
            <Input {...form.register("unit")} />
          </div>
          <div>
            <Label>Brand</Label>
            <Input {...form.register("brand")} />
          </div>
        </div>
        <div>
          <Label>Category</Label>
          <Select {...form.register("categoryId")}>
            <option value="">Select</option>
            {cats.data?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <FieldError message={form.formState.errors.categoryId?.message} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea {...form.register("description")} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("isSerialized")} /> Serialized
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={form.formState.isSubmitting}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
