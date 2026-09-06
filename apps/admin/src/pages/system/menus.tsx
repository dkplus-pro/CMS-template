import {
  Button,
  Card,
  Form,
  Input,
  Message,
  Modal,
  Select,
  Switch,
  Table
} from "@arco-design/web-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { MenuItem } from "../../api/generated/cMSAdminAPI.schemas";
import { MenusController } from "../../api/controllers.gen";
import { queryKeys } from "../../api/queryKeys";
import { componentRegistry } from "../../config/component-registry";

// 菜单管理:树表格 + 新建/编辑弹窗 + 删除确认。
export default function MenusPage() {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form] = Form.useForm();

  const treeQuery = useQuery({
    queryKey: queryKeys.menus.tree,
    queryFn: () => MenusController.listMenus()
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["menus"] });
    // 菜单变更影响当前用户可见菜单与权限码展示,一并刷新。
    void queryClient.invalidateQueries({ queryKey: ["auth"] });
  };

  const saveMutation = useMutation({
    mutationFn: (values: {
      parentId: number;
      name: string;
      path: string;
      componentKey?: string;
      icon?: string;
      permissionCode?: string;
      sort: number;
      visible: boolean;
    }) => {
      if (editing) {
        return MenusController.updateMenu(editing.id, values);
      }
      return MenusController.createMenu(values);
    },
    onSuccess: () => {
      Message.success(editing ? "菜单已更新" : "菜单已创建");
      invalidate();
      setFormVisible(false);
      setEditing(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => MenusController.deleteMenu(id),
    onSuccess: () => {
      Message.success("菜单已删除");
      invalidate();
    }
  });

  const openForm = (record: MenuItem | null) => {
    setEditing(record);
    form.clearFields();
    form.setFieldsValue(
      record ?? {
        parentId: 0,
        sort: 0,
        visible: true,
        componentKey: undefined,
        permissionCode: undefined
      }
    );
    setFormVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validate();
      saveMutation.mutate(values);
    } catch {
      // 校验失败,表单内已显示错误信息。
    }
  };

  const parentOptions = [
    { label: "根目录", value: 0 },
    ...flattenForParentOptions(treeQuery.data ?? [], 0)
  ];
  const componentOptions = Object.keys(componentRegistry)
    .filter((key) => key !== "welcome")
    .map((key) => ({ label: key, value: key }));

  const columns = [
    { title: "名称", dataIndex: "name" },
    { title: "路径", dataIndex: "path" },
    { title: "组件 key", dataIndex: "componentKey" },
    {
      title: "权限码",
      dataIndex: "permissionCode",
      render: (value?: string) => value ?? "-"
    },
    { title: "排序", dataIndex: "sort", width: 80 },
    {
      title: "显示",
      dataIndex: "visible",
      width: 90,
      render: (_: unknown, record: MenuItem) => (
        <Switch
          checked={record.visible}
          disabled
          onChange={(enabled) => toggleVisible(record, enabled)}
        />
      )
    },
    {
      title: "操作",
      width: 180,
      render: (_: unknown, record: MenuItem) => (
        <>
          <Button size="mini" onClick={() => openForm(record)}>
            编辑
          </Button>
          <Button
            size="mini"
            status="danger"
            style={{ marginLeft: 8 }}
            onClick={() =>
              Modal.confirm({
                title: "删除确认",
                content: `确定删除菜单 ${record.name} 吗?绑定的权限点将一并删除。`,
                onOk: () => deleteMutation.mutateAsync(record.id)
              })
            }
          >
            删除
          </Button>
        </>
      )
    }
  ];

  const toggleVisible = (record: MenuItem, enabled: boolean) => {
    MenusController.updateMenu(record.id, {
      parentId: record.parentId,
      name: record.name,
      path: record.path,
      componentKey: record.componentKey,
      icon: record.icon,
      permissionCode: record.permissionCode,
      sort: record.sort,
      visible: enabled
    }).then(() => invalidate());
  };

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openForm(null)}>
          新建菜单
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={treeQuery.isPending}
        columns={columns}
        data={treeQuery.data ?? []}
        pagination={false}
        defaultExpandAllRows
      />

      <Modal
        title={editing ? "编辑菜单" : "新建菜单"}
        visible={formVisible}
        onOk={handleOk}
        confirmLoading={saveMutation.isPending}
        onCancel={() => {
          setFormVisible(false);
          setEditing(null);
        }}
        unmountOnExit
      >
        <Form form={form} layout="vertical">
          <Form.Item
            field="parentId"
            label="父级"
            rules={[{ required: true, message: "请选择父级" }]}
          >
            <Select options={parentOptions} placeholder="选择父级" />
          </Form.Item>
          <Form.Item field="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="菜单名称" maxLength={64} />
          </Form.Item>
          <Form.Item
            field="path"
            label="路径"
            rules={[{ required: true, message: "请输入路由路径" }]}
          >
            <Input placeholder="如 /system/menus" maxLength={128} />
          </Form.Item>
          <Form.Item field="componentKey" label="组件 key">
            <Select options={componentOptions} placeholder="页面组件(目录留空)" allowClear />
          </Form.Item>
          <Form.Item field="icon" label="图标">
            <Input placeholder="Arco 图标名(可选)" maxLength={64} />
          </Form.Item>
          <Form.Item field="permissionCode" label="权限码">
            <Input placeholder="留空则登录可见,如 menu:system:user" maxLength={128} />
          </Form.Item>
          <Form.Item field="sort" label="排序" rules={[{ required: true, message: "请输入排序" }]}>
            <Input placeholder="数字越小越靠前" />
          </Form.Item>
          <Form.Item
            field="visible"
            label="显示"
            triggerPropName="checked"
            rules={[{ required: true }]}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function flattenForParentOptions(
  nodes: MenuItem[],
  depth: number
): { label: string; value: number }[] {
  return nodes.flatMap((node) => [
    { label: `${"\u00a0".repeat(depth * 2)}${node.name}`, value: node.id },
    ...flattenForParentOptions(node.children ?? [], depth + 1)
  ]);
}
