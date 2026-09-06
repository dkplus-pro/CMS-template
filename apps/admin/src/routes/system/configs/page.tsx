import { Button, Card, Input, Message, Space, Tabs } from "@arco-design/web-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { ConfigItem } from "../../../api/generated/cMSAdminAPI.schemas";
import { ConfigsController } from "../../../api/controllers.gen";
import { queryKeys } from "../../../api/queryKeys";

// 系统配置:Tab 按配置组(system / storage)展示,整组读取与保存(通用 KV 表单)。
export default function ConfigsPage() {
  return (
    <Card>
      <Tabs destroyOnHide>
        <Tabs.TabPane title="站点信息" key="system">
          <ConfigGroupForm group="system" />
        </Tabs.TabPane>
        <Tabs.TabPane title="存储配置" key="storage">
          <ConfigGroupForm group="storage" />
        </Tabs.TabPane>
      </Tabs>
    </Card>
  );
}

function ConfigGroupForm({ group }: { group: "system" | "storage" }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const groupQuery = useQuery({
    queryKey: queryKeys.configs.group(group),
    queryFn: () => ConfigsController.getConfig(group)
  });

  useEffect(() => {
    if (groupQuery.data) {
      setValues(
        Object.fromEntries(
          (groupQuery.data.items ?? []).map((item) => [item.key, item.value ?? ""])
        )
      );
    }
  }, [groupQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (items: ConfigItem[]) => ConfigsController.updateConfig(group, { items }),
    onSuccess: () => {
      Message.success("配置已保存");
      void queryClient.invalidateQueries({ queryKey: ["configs"] });
    }
  });

  const items = groupQuery.data?.items ?? [];
  const handleSave = () => {
    saveMutation.mutate(
      items.map((item) => ({ key: item.key, value: values[item.key] ?? "", remark: item.remark }))
    );
  };

  return (
    <Space direction="vertical" style={{ width: "100%", maxWidth: 560 }}>
      {items.map((item) => (
        <Space key={item.key} style={{ justifyContent: "space-between", width: "100%" }}>
          <span style={{ width: 140, color: "#4e5969" }} title={item.key}>
            {item.remark || item.key}
          </span>
          <Input
            style={{ width: 340 }}
            value={values[item.key] ?? ""}
            onChange={(value) => setValues((prev) => ({ ...prev, [item.key]: value }))}
            placeholder={item.key}
          />
        </Space>
      ))}
      <Button type="primary" loading={saveMutation.isPending} onClick={handleSave}>
        保存
      </Button>
    </Space>
  );
}
