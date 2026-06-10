import { DiscoverMedanPage } from "@/components/site/discover-medan-page";
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
  const { invitation, requestedFlow } = await resolveGuestFlowContext(params);

  return (
    <DiscoverMedanPage
      content={content}
      flow={requestedFlow}
      invitation={invitation}
    />
  );
}
