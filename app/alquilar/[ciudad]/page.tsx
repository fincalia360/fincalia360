import { cityPage } from "@/components/portal/cityPage";

export const dynamic = "force-dynamic";

const page = cityPage("HOME", "RENT");
export const generateMetadata = page.generateMetadata;
export default page.Page;
