import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@paypal/agent-toolkit",
    "@modelcontextprotocol/sdk",
    "@paypal/paypal-server-sdk",
    "axios",
  ],
};

export default nextConfig;
