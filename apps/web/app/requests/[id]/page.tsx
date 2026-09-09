import { notFound } from "next/navigation";
import { Market } from "../../../components/Market";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9][0-9]{0,19}$/.test(id)) notFound();
  return (
    <main>
      <Market mode="request" id={id} />
    </main>
  );
}
