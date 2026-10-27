import { createFileRoute } from "@tanstack/react-router";
import { LifeGame } from "@/components/life/LifeGame";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LifeGame />;
}
