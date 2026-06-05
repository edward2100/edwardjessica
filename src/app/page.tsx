import { HomePage } from "@/components/site/home-page";
import { getPublishedContent } from "@/lib/data-store";

export default async function Page() {
  const content = await getPublishedContent();
  return <HomePage content={content} />;
}
