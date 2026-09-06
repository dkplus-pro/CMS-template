import { Tag, Typography } from "@arco-design/web-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { SystemController } from "../api/controllers";
import { queryKeys } from "../api/queryKeys";

const highlights = [
  "Modern.js React app shell",
  "Application-local type-check, lint, and test scripts",
  "Ready to compose with shared packages from the monorepo"
];

type ApiStatus = "loading" | "online" | "offline";

const apiStatusConfig: Record<ApiStatus, { text: string; color: string }> = {
  loading: { text: "检测中", color: "gray" },
  online: { text: "在线", color: "green" },
  offline: { text: "离线", color: "red" }
};

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { isPending, error } = useQuery({
    queryKey: queryKeys.system.healthz,
    queryFn: () => SystemController.healthz(),
    enabled: mounted
  });

  const apiStatus: ApiStatus = isPending ? "loading" : error ? "offline" : "online";
  const status = apiStatusConfig[apiStatus];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="eyebrow">Turborepo + pnpm template</p>
      <Typography.Title heading={1} id="hero-title" style={{ marginTop: 0 }}>
        Hello from the admin app.
      </Typography.Title>
      <p className="lede">
        Use this application as the first runnable workspace while packages, CI, and deployment
        support are added around it.
      </p>
      <p className="api-status" aria-label="API service status">
        API 服务状态:
        <Tag color={status.color}>{status.text}</Tag>
      </p>
      <ul className="highlights" aria-label="admin app capabilities">
        {highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
