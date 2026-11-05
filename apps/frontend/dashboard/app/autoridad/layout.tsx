import { MarcoPanel } from "@/components/autoridad/marco-panel";

export default function LayoutAutoridad({ children }: LayoutProps<"/autoridad">) {
  return <MarcoPanel>{children}</MarcoPanel>;
}
