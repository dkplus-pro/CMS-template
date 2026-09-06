import { Button, Card, Form, Input, Message, Modal, Space, Table } from "@arco-design/web-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { Dict, DictEntry } from "../../../api/generated/cMSAdminAPI.schemas";
import { DictsController } from "../../../api/controllers.gen";
import { queryKeys } from "../../../api/queryKeys";
import AuthGate from "../../../components/auth-gate";

// 字典管理:左侧字典列表,右侧选中字典的字典项(左右布局)。
export default function DictsPage() {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Dict | null>(null);
  const [dictFormVisible, setDictFormVisible] = useState(false);
  const [editing, setEditing] = useState<Dict | null>(null);
  const [entryFormVisible, setEntryFormVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictEntry | null>(null);

  const queryClient = useQueryClient();
  const invalidateDicts = () => {
    void queryClient.invalidateQueries({ queryKey: ["dicts"] });
  };

  const listQuery = useQuery({
    queryKey: queryKeys.dicts.list(keyword),
    queryFn: () => DictsController.listDicts({ keyword: keyword || undefined })
  });

  const entriesQuery = useQuery({
    queryKey: queryKeys.dicts.items(selected?.code ?? ""),
    queryFn: () => DictsController.listDictItems(selected?.code ?? ""),
    enabled: selected !== null
  });

  const deleteDictMutation = useMutation({
    mutationFn: (id: number) => DictsController.deleteDict(id),
    onSuccess: () => {
      Message.success("字典已删除");
      setSelected(null);
      invalidateDicts();
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: number) => DictsController.deleteDictItem(id),
    onSuccess: () => {
      Message.success("字典项已删除");
      invalidateDicts();
    }
  });

  const dictColumns = [
    { title: "编码", dataIndex: "code" },
    { title: "名称", dataIndex: "name" },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (value: boolean) => (value ? "启用" : "停用")
    }
  ];

  const entryColumns = [
    { title: "标签", dataIndex: "label" },
    { title: "值", dataIndex: "value" },
    { title: "排序", dataIndex: "sort", width: 70 },
    {
      title: "操作",
      width: 150,
      render: (_: unknown, record: DictEntry) => (
        <Space>
          <AuthGate permission="system:dict:update">
            <Button
              size="mini"
              onClick={() => {
                setEditingEntry(record);
                setEntryFormVisible(true);
              }}
            >
              编辑
            </Button>
          </AuthGate>
          <AuthGate permission="system:dict:update">
            <Button
              size="mini"
              status="danger"
              onClick={() =>
                Modal.confirm({
                  title: "删除确认",
                  content: `确定删除字典项 ${record.label} 吗?`,
                  onOk: () => deleteEntryMutation.mutateAsync(record.id)
                })
              }
            >
              删除
            </Button>
          </AuthGate>
        </Space>
      )
    }
  ];

  return (
    <Space style={{ width: "100%", alignItems: "flex-start" }} size={16}>
      <Card style={{ width: 380 }} title="字典">
        <Space style={{ marginBottom: 12, width: "100%", justifyContent: "space-between" }}>
          <Input.Search
            placeholder="搜索编码/名称"
            style={{ width: 180 }}
            onSearch={(value) => setKeyword(value)}
          />
          <AuthGate permission="system:dict:create">
            <Button
              type="primary"
              onClick={() => {
                setEditing(null);
                setDictFormVisible(true);
              }}
            >
              新建
            </Button>
          </AuthGate>
        </Space>
        <Table
          rowKey="id"
          loading={listQuery.isPending}
          columns={dictColumns}
          data={listQuery.data ?? []}
          pagination={false}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selected ? [selected.id] : [],
            onChange: (keys, rows) => setSelected(rows[0] ?? null)
          }}
          onRow={(record) => ({
            onClick: () => setSelected(record as Dict)
          })}
        />
      </Card>

      <Card
        style={{ flex: 1 }}
        title={selected ? `字典项:${selected.name}(${selected.code})` : "字典项"}
      >
        <Space style={{ marginBottom: 12 }}>
          <AuthGate permission="system:dict:update">
            <Button
              type="primary"
              disabled={selected === null}
              onClick={() => {
                setEditingEntry(null);
                setEntryFormVisible(true);
              }}
            >
              新建字典项
            </Button>
          </AuthGate>
          <AuthGate permission="system:dict:delete">
            <Button
              status="danger"
              disabled={selected === null}
              onClick={() =>
                selected &&
                Modal.confirm({
                  title: "删除确认",
                  content: `确定删除字典 ${selected.name} 吗?字典项将一并删除。`,
                  onOk: () => deleteDictMutation.mutateAsync(selected.id)
                })
              }
            >
              删除字典
            </Button>
          </AuthGate>
        </Space>
        <Table
          rowKey="id"
          loading={entriesQuery.isPending}
          columns={entryColumns}
          data={entriesQuery.data ?? []}
          pagination={false}
        />
      </Card>

      <DictFormModal
        visible={dictFormVisible}
        editing={editing}
        onClose={() => {
          setDictFormVisible(false);
          setEditing(null);
        }}
      />
      <EntryFormModal
        visible={entryFormVisible}
        dict={selected}
        editing={editingEntry}
        onClose={() => {
          setEntryFormVisible(false);
          setEditingEntry(null);
        }}
      />
    </Space>
  );
}

function DictFormModal({
  visible,
  editing,
  onClose
}: {
  visible: boolean;
  editing: Dict | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (values: { code: string; name: string; remark?: string }) => {
      if (editing) {
        return DictsController.updateDict(editing.id, { ...values, status: editing.status });
      }
      return DictsController.createDict(values);
    },
    onSuccess: () => {
      Message.success(editing ? "字典已更新" : "字典已创建");
      void queryClient.invalidateQueries({ queryKey: ["dicts"] });
      onClose();
    }
  });

  const handleOk = async () => {
    try {
      saveMutation.mutate(await form.validate());
    } catch {
      // 校验失败,表单内已显示错误信息。
    }
  };

  return (
    <Modal
      title={editing ? "编辑字典" : "新建字典"}
      visible={visible}
      onOk={handleOk}
      confirmLoading={saveMutation.isPending}
      onCancel={onClose}
      unmountOnExit
    >
      <Form form={form} layout="vertical" initialValues={editing ?? {}}>
        <Form.Item field="code" label="编码" rules={[{ required: true, message: "请输入编码" }]}>
          <Input placeholder="如 common_status" maxLength={64} />
        </Form.Item>
        <Form.Item field="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
          <Input placeholder="显示名" maxLength={64} />
        </Form.Item>
        <Form.Item field="remark" label="备注">
          <Input placeholder="用途说明" maxLength={255} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function EntryFormModal({
  visible,
  dict,
  editing,
  onClose
}: {
  visible: boolean;
  dict: Dict | null;
  editing: DictEntry | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (values: { label: string; value: string; sort?: number }) => {
      const payload = {
        label: values.label,
        value: values.value,
        sort: values.sort ?? 0,
        status: editing?.status ?? true
      };
      if (editing) {
        return DictsController.updateDictItem(editing.id, payload);
      }
      return DictsController.createDictItem(dict?.code ?? "", payload);
    },
    onSuccess: () => {
      Message.success(editing ? "字典项已更新" : "字典项已创建");
      void queryClient.invalidateQueries({ queryKey: ["dicts"] });
      onClose();
    }
  });

  const handleOk = async () => {
    try {
      saveMutation.mutate(await form.validate());
    } catch {
      // 校验失败,表单内已显示错误信息。
    }
  };

  return (
    <Modal
      title={editing ? "编辑字典项" : "新建字典项"}
      visible={visible}
      onOk={handleOk}
      confirmLoading={saveMutation.isPending}
      onCancel={onClose}
      unmountOnExit
    >
      <Form form={form} layout="vertical" initialValues={editing ?? { sort: 0 }}>
        <Form.Item field="label" label="标签" rules={[{ required: true, message: "请输入标签" }]}>
          <Input placeholder="显示文本,如 启用" maxLength={64} />
        </Form.Item>
        <Form.Item field="value" label="值" rules={[{ required: true, message: "请输入值" }]}>
          <Input placeholder="存储值,如 1" maxLength={64} />
        </Form.Item>
        <Form.Item field="sort" label="排序" rules={[{ required: true, message: "请输入排序" }]}>
          <Input placeholder="数字越小越靠前" />
        </Form.Item>
        {dict ? (
          <Form.Item label="所属字典">
            <Input value={`${dict.name}(${dict.code})`} disabled />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
