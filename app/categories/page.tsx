import { redirect } from "next/navigation";

/** Categories moved under Settings; old links and bookmarks still arrive. */
export default function CategoriesMoved() {
  redirect("/settings/categories");
}
