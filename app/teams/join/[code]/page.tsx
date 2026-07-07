import { JoinPage } from "@/components/join-page";

export default async function TeamsJoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinPage prefilledCode={code} />;
}
