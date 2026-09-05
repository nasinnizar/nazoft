import { useId } from "react";
import { Field } from "@/components/ui/v-label-14-utils/field";
import { Input } from "@/components/ui/v-label-14-utils/input";
import { Label } from "@/components/ui/v-label-14-utils/label";

const fields: { key: string; label: string; placeholder: string; type?: string }[] = [
  { key: "first", label: "First name", placeholder: "Jane" },
  { key: "last", label: "Last name", placeholder: "Smith" },
  { key: "email", label: "Email", placeholder: "jane@example.com", type: "email" },
];

export function Pattern() {
  return <div className="w-full max-w-sm space-y-3">{fields.map(field => <HorizontalField key={field.key} {...field} />)}</div>;
}

function HorizontalField({ label, placeholder, type }: { label: string; placeholder: string; type?: string }) {
  const id = useId();
  return <Field className="grid grid-cols-[100px_1fr] items-center gap-4"><Label className="text-right" htmlFor={id}>{label}</Label><Input id={id} placeholder={placeholder} type={type} /></Field>;
}

export default Pattern;
