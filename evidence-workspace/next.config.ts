import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/buckets",
        destination: "/categories",
        permanent: true,
      },
      {
        source: "/buckets/:bucket",
        destination: "/categories/:bucket",
        permanent: true,
      },
      {
        source: "/api/exports/buckets/:bucket/csv",
        destination: "/api/exports/categories/:bucket/csv",
        permanent: true,
      },
      {
        source: "/api/exports/buckets/:bucket/xlsx",
        destination: "/api/exports/categories/:bucket/xlsx",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
