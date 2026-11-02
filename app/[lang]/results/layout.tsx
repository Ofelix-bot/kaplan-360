import { Inter } from "next/font/google";
import { FinderFrame } from "@/components/finder/finder-frame";
import "../../ui.css";

// The Programme finder's three pages (questions, programmes, compare): Inter, on the finder's own skin.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export default function FinderLayout({ children }: LayoutProps<"/[lang]/results">) {
  return <FinderFrame font={inter.variable}>{children}</FinderFrame>;
}
