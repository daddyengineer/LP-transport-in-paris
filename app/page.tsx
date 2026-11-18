import HomePage from "@/components/HomePage";
import MobileHome from "@/components/MobileHome";

export default function Page() {
  return (
    <>
      <div className="desktop-home">
        <HomePage textUsNumber="" />
      </div>
      <MobileHome />
    </>
  );
}
