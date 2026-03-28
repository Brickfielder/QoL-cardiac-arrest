import { redirect } from "next/navigation";

export default async function BucketRedirectPage(props: {
  params: Promise<{ bucket: string }>;
}) {
  const params = await props.params;
  redirect(`/categories/${params.bucket}`);
}
