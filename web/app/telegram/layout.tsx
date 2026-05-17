import { Nav } from "@/components/nav";

export default async function TelegramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="max-w-[1200px] mx-auto" style={{ padding: "24px" }}>
        {children}
      </main>
    </>
  );
}
