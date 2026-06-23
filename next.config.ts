import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs", "node-cron"],
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
