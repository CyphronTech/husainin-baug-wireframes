import BookReview from "@/app/(app)/book/review/page";
import { Modal } from "@/lib/modal";
import type { SP } from "@/lib/ui";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const { c = "", from, to, hall, th } = await searchParams;
  const close = `/book/slots?${new URLSearchParams({ c, ...(from && { from }), ...(to && { to }), ...(hall && { hall }), ...(th && { th }) })}`;
  return <Modal label="Household and review" close={close}><BookReview searchParams={searchParams} /></Modal>;
}
