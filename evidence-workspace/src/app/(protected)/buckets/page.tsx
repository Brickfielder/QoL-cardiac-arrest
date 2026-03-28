import { redirect } from "next/navigation";

export default function BucketsRedirectPage() {
  redirect("/categories");
}
