"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { ApiRequestError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean(),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between p-12 xl:p-16">
        <BrandMark />
        <div className="enter max-w-md">
          <p className="text-xs font-medium tracking-[0.08em] text-ink-muted">
            Serialized inventory platform
          </p>
          <h1 className="display mt-4 text-5xl font-semibold leading-[1.05]">
            Precision stock control for SWK-HVACR
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-ink-muted">
            Track every compressor, spare, and installation unit by serial — from warehouse
            receipt through regional transfer and sale.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3 text-sm">
            {["Addis Ababa", "Mekele", "Bahir Dar", "Hawassa"].map((city) => (
              <div key={city} className="rounded-md border border-line px-3 py-2.5 text-ink-muted">
                {city}
              </div>
            ))}
          </div>
        </div>
        <p className="font-mono text-[11px] tracking-[0.12em] text-ink-muted">
          UNIT-LEVEL · ETHIOPIAN BIRR · AUDITABLE
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="enter w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <BrandMark />
          </div>
          <h2 className="display text-3xl font-semibold">Welcome back</h2>
          <p className="mt-2 text-sm text-ink-muted">Sign in to manage your inventory.</p>
          <form
            className="mt-8 space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              setServerError(null);
              try {
                await login(values.email, values.password, values.remember);
              } catch (err) {
                setServerError(
                  err instanceof ApiRequestError ? err.message : "Unable to sign in.",
                );
              }
            })}
          >
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              <FieldError message={form.formState.errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-10"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={form.formState.errors.password?.message} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" {...form.register("remember")} />
              Remember this device
            </label>
            {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}
            <Button className="w-full" loading={form.formState.isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
