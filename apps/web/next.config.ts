import type { NextConfig } from "next";

function buildRemotePatterns() {
  const cmsUrl = process.env.NEXT_PUBLIC_CMS_URL ?? process.env.CMS_URL;
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

  if (cmsUrl) {
    try {
      const url = new URL(cmsUrl);
      patterns.push({
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port || undefined,
        pathname: "/uploads/**",
      });
    } catch {
      // Ignore invalid CMS URL configuration here and let runtime config fail loudly.
    }
  } else if (process.env.NODE_ENV !== "production") {
    patterns.push({
      protocol: "http",
      hostname: "localhost",
      port: "1338",
      pathname: "/uploads/**",
    });
  }

  return patterns;
}

const remotePatterns = buildRemotePatterns();
const allowsLocalDevelopmentImages = remotePatterns.some((pattern) =>
  ["localhost", "127.0.0.1"].includes(pattern.hostname)
);

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    dangerouslyAllowLocalIP: allowsLocalDevelopmentImages,
    remotePatterns,
  },
};

export default nextConfig;
