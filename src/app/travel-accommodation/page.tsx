import { TravelAccommodationPage } from "@/components/site/travel-accommodation-page";
import { getPublishedContent } from "@/lib/data-store";
import { resolveGuestFlowContext } from "@/lib/guest-flow";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; flow?: string }>;
}) {
  const params = await searchParams;
  const content = await getPublishedContent();
  const { invitation, normalizedCode, requestedFlow, codeFoundButWrongFlow } =
    await resolveGuestFlowContext(params, { expandedOnly: true });

  return (
    <TravelAccommodationPage
      content={content}
      flow={requestedFlow}
      invitation={invitation}
      requestedCode={normalizedCode || undefined}
      codeFoundButWrongFlow={codeFoundButWrongFlow}
    />
  );
}
