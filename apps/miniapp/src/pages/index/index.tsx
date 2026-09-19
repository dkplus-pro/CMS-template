import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import { AppController } from "../../api/controllers.gen";
import "./index.css";

type PingState = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

const initialState: PingState = { loading: true, message: null, error: null };

// hello world 薄切片:挂载后经 orval 生成物(mutator 链路)调用 /api/app/ping,
// 渲染服务端返回的 message,带 loading 与失败降级;禁止绕过生成物手写请求。
export default function Index() {
  const [state, setState] = useState<PingState>(initialState);

  useEffect(() => {
    let active = true;
    AppController.ping()
      .then((result) => {
        if (active) setState({ loading: false, message: result.message, error: null });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            loading: false,
            message: null,
            error: error instanceof Error ? error.message : "请求失败"
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View className="index">
      <Text className="index-title">CMS miniapp</Text>
      {state.loading && <Text>加载中…</Text>}
      {!state.loading && state.message !== null && <Text>{state.message}</Text>}
      {!state.loading && state.error !== null && <Text>请求失败:{state.error}</Text>}
    </View>
  );
}
