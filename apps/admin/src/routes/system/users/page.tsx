import {
  Button,
  Card,
  Form,
  Input,
  Message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag
} from "@arco-design/web-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { UserItem } from "../../../api/generated/cMSAdminAPI.schemas";
import { RolesController, UsersController } from "../../../api/controllers.gen";
import { queryKeys } from "../../../api/queryKeys";

interface UserFormModalProps {
  visible: boolean;
  editing: UserItem | null;
  onClose: () => void;
}

function UserFormModal({ visible, editing, onClose }: UserFormModalProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (values: {
      username?: string;
      password?: string;
      nickname?: string;
      email?: string;
    }) => {
      if (editing) {
        return UsersController.updateUser(editing.id, { nickname: values.nickname ?? "" });
      }
      return UsersController.createUser({
        username: values.username ?? "",
        password: values.password ?? "",
        nickname: values.nickname,
        email: values.email
      });
    },
    onSuccess: () => {
      Message.success(editing ? "用户已更新" : "用户已创建");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
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
      title={editing ? "编辑用户" : "新建用户"}
      visible={visible}
      onOk={handleOk}
      confirmLoading={saveMutation.isPending}
      onCancel={onClose}
      unmountOnExit
    >
      <Form form={form} layout="vertical" initialValues={editing ?? {}}>
        <Form.Item
          field="username"
          label="用户名"
          rules={[{ required: !editing, message: "请输入用户名" }]}
        >
          <Input placeholder="登录名" disabled={Boolean(editing)} maxLength={64} />
        </Form.Item>
        {!editing ? (
          <Form.Item
            field="password"
            label="初始密码"
            rules={[
              { required: true, message: "请输入初始密码" },
              { minLength: 6, message: "至少 6 位" }
            ]}
          >
            <Input.Password placeholder="初始密码" maxLength={64} />
          </Form.Item>
        ) : null}
        <Form.Item
          field="nickname"
          label="昵称"
          rules={[{ required: true, message: "请输入昵称" }]}
        >
          <Input placeholder="显示名" maxLength={64} />
        </Form.Item>
        <Form.Item field="email" label="邮箱">
          <Input placeholder="email@example.com" maxLength={128} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface UserRolesModalProps {
  visible: boolean;
  user: UserItem | null;
  onClose: () => void;
}

function UserRolesModal({ visible, user, onClose }: UserRolesModalProps) {
  // unmountOnExit 保证每次打开重新挂载,以 user.roleIds 初始化选中项。
  const [roleIds, setRoleIds] = useState<number[]>(user?.roleIds ?? []);
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.all,
    queryFn: () => RolesController.listAllRoles(),
    enabled: visible
  });

  const saveMutation = useMutation({
    mutationFn: () => UsersController.updateUserRoles(user?.id ?? 0, { roleIds }),
    onSuccess: () => {
      Message.success("角色已分配");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    }
  });

  const options = (rolesQuery.data ?? []).map((role) => ({
    label: `${role.name}(${role.code})`,
    value: role.id
  }));

  return (
    <Modal
      title={`分配角色:${user?.nickname ?? ""}`}
      visible={visible}
      onOk={() => saveMutation.mutate()}
      confirmLoading={saveMutation.isPending}
      onCancel={onClose}
      unmountOnExit
    >
      <Select
        mode="multiple"
        placeholder="选择角色"
        style={{ width: "100%" }}
        options={options}
        value={roleIds}
        onChange={(value) => setRoleIds(value)}
        loading={rolesQuery.isPending}
      />
    </Modal>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<boolean | undefined>(undefined);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [rolesUser, setRolesUser] = useState<UserItem | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.users.list(page, pageSize, keyword, status),
    queryFn: () =>
      UsersController.listUsers({ page, pageSize, keyword: keyword || undefined, status })
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      UsersController.updateUserStatus(id, { status: enabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => UsersController.deleteUser(id),
    onSuccess: () => {
      Message.success("用户已删除");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const deleteUser = (record: UserItem) => {
    Modal.confirm({
      title: "删除确认",
      content: `确定删除用户 ${record.username} 吗?`,
      onOk: () => deleteMutation.mutateAsync(record.id)
    });
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    { title: "用户名", dataIndex: "username" },
    { title: "昵称", dataIndex: "nickname" },
    { title: "邮箱", dataIndex: "email" },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (_: unknown, record: UserItem) => (
        <Switch
          checked={record.status}
          disabled={record.isBuiltin}
          onChange={(enabled) => statusMutation.mutate({ id: record.id, enabled })}
        />
      )
    },
    {
      title: "内置",
      dataIndex: "isBuiltin",
      width: 90,
      render: (value: boolean) => (value ? <Tag color="arcoblue">内置</Tag> : null)
    },
    {
      title: "操作",
      width: 230,
      render: (_: unknown, record: UserItem) => (
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
          <Button size="mini" onClick={() => setRolesUser(record)}>
            分配角色
          </Button>
          <Button
            size="mini"
            status="danger"
            disabled={record.isBuiltin}
            onClick={() => deleteUser(record)}
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
        <Space>
          <Input.Search
            placeholder="搜索用户名/昵称"
            style={{ width: 240 }}
            onSearch={(value) => {
              setKeyword(value);
              setPage(1);
            }}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => {
              setStatus(value === undefined ? undefined : value === 1);
              setPage(1);
            }}
            options={[
              { label: "启用", value: 1 },
              { label: "禁用", value: 0 }
            ]}
          />
        </Space>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            setFormVisible(true);
          }}
        >
          新建用户
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

      <UserFormModal
        visible={formVisible}
        editing={editing}
        onClose={() => {
          setFormVisible(false);
          setEditing(null);
        }}
      />
      <UserRolesModal
        visible={rolesUser !== null}
        user={rolesUser}
        onClose={() => setRolesUser(null)}
      />
    </Card>
  );
}
