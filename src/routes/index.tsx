import { createFileRoute } from "@tanstack/react-router";
import { Flow } from "@/components/Flow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Todos | Flow" },
      {
        name: "description",
        content: "Flow — a calm, focused todo app for what matters today.",
      },
      { property: "og:title", content: "Todos | Flow" },
      {
        property: "og:description",
        content: "Flow — a calm, focused todo app for what matters today.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <Flow />;
}
