import {
  Button,
  Card,
  Form,
  Input,
  Message,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tree
} from "@arco-design/web-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { RoleItem } from "../../../api/generated/cMSAdminAPI.schemas";
import { PermissionsController, RolesController } from "../../../api/controllers.gen";
import { queryKeys } from "../../../api/queryKeys";

interface RoleFormModalProps {
  visible: boolean;
  editing: RoleItem | null;
  onClose: () => void;
}

function RoleFormModal({ visible, editing, onClose }: RoleFormModalProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (values: { code: string; name: string; remark?: string }) => {
      if (editing) {
        return RolesController.updateRole(editing.id, {
          code: editing.isBuiltin ? editing.code : values.code,
          name: values.name,
          remark: values.remark,
          status: editing.status
        });
      }
      return RolesController.createRole({
        code: values.code,
        name: values.name,
        remark: values.remark
      });
    },
    onSuccess: () => {
      Message.success(editing ? "角色已更新" : "角色已创建");
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    }
  });

  const handleOk = async () => {
    try {
      const values = await form.validate();
      saveMutation.mutate(values);
    } catch {
      // 校验失败,表单内已显示错误信息。
    }
  };

  return (
    <Modal
      title={editing ? "编辑角色" : "新建角色"}
      visible={visible}
      onOk={handleOk}
      confirmLoading={saveMutation.isPending}
      onCancel={onClose}
      unmountOnExit
    >
      <Form form={form} layout="vertical" initialValues={editing ?? {}}>
        <Form.Item
          field="code"
          label="编码"
          rules={[{ required: true, message: "请输入角色编码" }]}
        >
          <Input placeholder="如 ops" maxLength={64} disabled={Boolean(editing?.isBuiltin)} />
        </Form.Item>
        <Form.Item
          field="name"
          label="名称"
          rules={[{ required: true, message: "请输入角色名称" }]}
        >
          <Input placeholder="显示名" maxLength={64} />
        </Form.Item>
        <Form.Item field="remark" label="备注">
          <Input.TextArea placeholder="角色说明" maxLength={255} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface RolePermissionsModalProps {
  visible: boolean;
  role: RoleItem | null;
  onClose: () => void;
}

// 权限树:菜单权限点为根节点,API 权限点挂在其所属模块的菜单点下(见 docs/api-pages.md)。
function RolePermissionsModal({ visible, role, onClose }: RolePermissionsModalProps) {
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const treeQuery = useQuery({
    queryKey: queryKeys.permissions.tree,
    queryFn: () => PermissionsController.listPermissions(),
    enabled: visible
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      RolesController.updateRolePermissions(role?.id ?? 0, {
        permissionIds: checkedKeys.map((key) => Number(key)).filter((id) => Number.isInteger(id))
      }),
    onSuccess: () => {
      Message.success("权限已分配");
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    }
  });

  const treeData = (treeQuery.data ?? []).map((node) => toTreeNode(node));

  return (
    <Modal
      title={`分配权限:${role?.name ?? ""}`}
      visible={visible}
      onOk={() => saveMutation.mutate()}
      confirmLoading={saveMutation.isPending}
      onCancel={onClose}
      unmountOnExit
    >
      <Tree
        checkable
        checkedKeys={checkedKeys}
        onCheck={(value) => setCheckedKeys(value as string[])}
        treeData={treeData}
      />
    </Modal>
  );
}

interface ApiPermissionNode {
  id: number;
  code: string;
  name: string;
  children: ApiPermissionNode[];
}

interface TreeNode {
  key: string;
  title: string;
  children: TreeNode[];
}

function toTreeNode(node: ApiPermissionNode): TreeNode {
  return {
    key: String(node.id),
    title: `${node.name}(${node.code})`,
    children: node.children.map(toTreeNode)
  };
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [permissionsRole, setPermissionsRole] = useState<RoleItem | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.roles.list(page, pageSize, keyword),
    queryFn: () => RolesController.listRoles({ page, pageSize, keyword: keyword || undefined })
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, enabled, role }: { id: number; enabled: boolean; role: RoleItem }) =>
      RolesController.updateRole(id, {
        code: role.code,
        name: role.name,
        remark: role.remark,
        status: enabled
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["roles"] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => RolesController.deleteRole(id),
    onSuccess: () => {
      Message.success("角色已删除");
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    }
  });

  const deleteRole = (record: RoleItem) => {
    Modal.confirm({
      title: "删除确认",
      content: `确定删除角色 ${record.name} 吗?`,
      onOk: () => deleteMutation.mutateAsync(record.id)
    });
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    { title: "编码", dataIndex: "code" },
    { title: "名称", dataIndex: "name" },
    { title: "备注", dataIndex: "remark" },
    {
      title: "内置",
      dataIndex: "isBuiltin",
      width: 90,
      render: (value: boolean) => (value ? <Tag color="arcoblue">内置</Tag> : null)
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (_: unknown, record: RoleItem) => (
        <Switch
          checked={record.status}
          disabled={record.isBuiltin}
          onChange={(enabled) => statusMutation.mutate({ id: record.id, enabled, role: record })}
        />
      )
    },
    {
      title: "操作",
      width: 230,
      render: (_: unknown, record: RoleItem) => (
        <Space>
          <Button
            size="mini"
            onClick={() => {
              setEditing(record);
              setFormVisible(true);
            }}
          >
            编辑
          </Button>
          <Button size="mini" onClick={() => setPermissionsRole(record)}>
            分配权限
          </Button>
          <Button
            size="mini"
            status="danger"
            disabled={record.isBuiltin}
            onClick={() => deleteRole(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Input.Search
          placeholder="搜索角色编码/名称"
          style={{ width: 240 }}
          onSearch={(value) => {
            setKeyword(value);
            setPage(1);
          }}
        />
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            setFormVisible(true);
          }}
        >
          新建角色
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={listQuery.isPending}
        columns={columns}
        data={listQuery.data?.list ?? []}
        pagination={{
          total: listQuery.data?.total ?? 0,
          current: page,
          pageSize,
          onChange: (current, size) => {
            setPage(current);
            setPageSize(size);
          }
        }}
      />

      <RoleFormModal
        visible={formVisible}
        editing={editing}
        onClose={() => {
          setFormVisible(false);
          setEditing(null);
        }}
      />
      <RolePermissionsModal
        visible={permissionsRole !== null}
        role={permissionsRole}
        onClose={() => setPermissionsRole(null)}
      />
    </Card>
  );
}
