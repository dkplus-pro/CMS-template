import { Button, Result } from "@arco-design/web-react";
import { useNavigate } from "@modern-js/runtime/router";

// 兜底 404 页面(Modern.js 约定:routes/$.page.tsx),样式对齐 arco-design-pro 的异常页。
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="抱歉,您访问的页面不存在"
      extra={
        <Button type="primary" onClick={() => navigate("/")}>
          返回首页
        </Button>
      }
    />
  );
}
