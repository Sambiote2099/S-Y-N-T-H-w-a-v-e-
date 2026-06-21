import { Toolbar } from "@/components/Toolbar";
import { ViewToggle } from "@/components/ViewToggle";
import { MainView } from "@/components/MainView";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Toolbar />
      <div className="mt-16"> 
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex gap-1">
          <Image src='https://res.cloudinary.com/diasvvkil/image/upload/v1782070366/favicon_-_Copy_sfvp4u.png' alt='sadson' height={56} width={56} className="rounded-4xl"/>
        <h3 className="text-3xl mt-2 font-semibold text-white">S Y N T H | w a v e</h3>
        </div>
        
        <ViewToggle />
      </div>

      <MainView />
    </div>
    </div>
  );
}