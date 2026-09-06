import { useAuthStore } from "../store/auth";
import { useEffect, useState } from "react";

// 带鉴权的文件内容加载:文件内容端点需要 Bearer token,<img>/<video> 的 src 无法携带
// 请求头,因此用 fetch 取 blob 再生成 objectURL 供媒体组件使用(用完即释放)。
export function useFileURL(fileId: number | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    let revoked = false;
    let objectURL: string | null = null;

    const token = useAuthStore.getState().token;
    fetch(`/api/files/${fileId}/content`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`load file ${fileId}: ${res.status}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (revoked) {
          return;
        }
        objectURL = URL.createObjectURL(blob);
        setUrl(objectURL);
      })
      .catch(() => {
        if (!revoked) {
          setUrl(null);
        }
      });

    return () => {
      revoked = true;
      if (objectURL) {
        URL.revokeObjectURL(objectURL);
      }
    };
  }, [fileId]);

  return url;
}
