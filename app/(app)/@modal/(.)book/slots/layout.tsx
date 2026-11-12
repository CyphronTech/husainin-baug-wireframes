import { Modal } from "@/lib/modal";

// In a layout, not the page, so the popup stays outside the part that reloads on every slot click.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Modal label="Choose date and halls" close="/book" keepQuery>{children}</Modal>;
}
