import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // A static site: the programme file is fetched in the browser and everything the student
  // does stays there, so no server is needed.
  output: "export",
  // This app sits inside the main project's folder; resolve modules from here, not from there.
  turbopack: { root: path.resolve(import.meta.dirname) },
  devIndicators: false,
}

export default nextConfig
