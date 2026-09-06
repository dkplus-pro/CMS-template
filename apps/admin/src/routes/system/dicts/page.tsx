import {
  Button,
  Card,
  Form,
  Input,
  Message,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag
} from "@arco-design/web-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { Dict, DictEntry } from "../../../api/generated/cMSAdminAPI.schemas";
import { DictsController } from "../../../api/controllers.gen";
import { queryKeys } from "../../../api/queryKeys";
import AuthGate from "../../../components/auth-gate";

// 字典管理:列表页 + 操作栏(编辑 / 上下线 / 删除)。
export default function DictsPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Dict | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.dicts.list(keyword),
    queryFn: () => DictsController.listDicts({ keyword: keyword || undefined })
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["dicts"] });

  const statusMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      DictsController.updateDictStatus(id, { status: enabled }),
    onSuccess: () => {
      Message.success("状态已更新");
      invalidate();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => DictsController.deleteDict(id),
    onSuccess: () => {
      Message.success("字典已删除");
      invalidate();
    }
  });

  const columns = [
    { title: "编码", dataIndex: "code", width: 180 },
    { title: "名称", dataIndex: "name", width: 180 },
    { title: "备注", dataIndex: "remark" },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: boolean) =>
        value ? <Tag color="green">上线</Tag> : <Tag color="gray">下线</Tag>
    },
    {
      title: "操作",
      width: 300,
      render: (_: unknown, record: Dict) => (
        <Space>
          <AuthGate permission="system:dict:update">
            <Button
              size="mini"
              onClick={() => {
                setEditing(record);
                setFormVisible(true);
              }}
            >
              编辑
            </Button>
          </AuthGate>
          <AuthGate permission="system:dict:update">
            <Popconfirm
              title={`确定${record.status ? "下线" : "上线"}字典 ${record.name} 吗?`}
              onOk={() => statusMutation.mutateAsync({ id: record.id, enabled: !record.status })}
            >
              <Button size="mini">{record.status ? "下线" : "上线"}</Button>
            </Popconfirm>
          </AuthGate>
          <AuthGate permission="system:dict:delete">
            <Popconfirm
              title={`确定删除字典 ${record.name} 吗?字典项将一并删除。`}
              onOk={() => deleteMutation.mutateAsync(record.id)}
            >
              <Button size="mini" status="danger">
                删除
              </Button>
            </Popconfirm>
          </AuthGate>
        </Space>
      )
    }
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Input.Search
          placeholder="搜索编码/名称"
          style={{ width: 240 }}
          onSearch={(value) => setKeyword(value)}
        />
        <AuthGate permission="system:dict:create">
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              setFormVisible(true);
            }}
          >
            新建字典
          </Button>
        </AuthGate>
      </Space>

      <Table
        rowKey="id"
        loading={listQuery.isPending}
        columns={columns}
        data={listQuery.data ?? []}
        pagination={false}
      />

      <DictFormModal
        visible={formVisible}
        editing={editing}
        onClose={() => {
          setFormVisible(false);
          setEditing(null);
        }}
      />
    </Card>
  );
}

interface EntryFormValue {
  label: string;
  value: string;
  sort?: number;
  enabled?: boolean;
}

interface DictFormValues {
  code: string;
  name: string;
  remark?: string;
  entries?: EntryFormValue[];
}

// 新建/编辑共用弹窗:字典基本信息 + 字典项动态增减(Form.List,参考 arco 动态表单)。
function DictFormModal({
  visible,
  editing,
  onClose
}: {
  visible: boolean;
  editing: Dict | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<DictFormValues>();
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["dicts"] });

  const saveMutation = useMutation({
    mutationFn: async (values: DictFormValues) => {
      let dictId = editing?.id;
      if (editing) {
        await DictsController.updateDict(editing.id, {
          code: values.code,
          name: values.name,
          remark: values.remark,
          status: editing.status
        });
      } else {
        const created = await DictsController.createDict({
          code: values.code,
          name: values.name,
          remark: values.remark
        });
        dictId = created.id;
      }
      // 字典项整组覆写:编辑保存一次全部;新建时按表单内容写入。
      const entries = (values.entries ?? []).map((entry) => ({
        label: entry.label,
        value: entry.value,
        sort: entry.sort ?? 0,
        status: entry.enabled ?? true
      }));
      if (dictId) {
        await DictsController.replaceDictEntries(dictId, { entries });
      }
    },
    onSuccess: () => {
      Message.success(editing ? "字典已更新" : "字典已创建");
      invalidate();
      onClose();
    }
  });

  const openWithDefault = () => {
    form.clearFields();
    if (editing) {
      form.setFieldsValue({
        code: editing.code,
        name: editing.name,
        remark: editing.remark ?? ""
      });
      // 编辑:回填基本信息,字典项从接口拉取后回填进 Form.List。
      DictsController.listDictItems(editing.code).then((entries: DictEntry[]) => {
        form.setFieldsValue({
          entries: entries.map((entry) => ({
            label: entry.label,
            value: entry.value,
            sort: entry.sort,
            enabled: entry.status
          }))
        });
      });
    } else {
      form.setFieldsValue({ code: "", name: "", remark: "", entries: [emptyEntry()] });
    }
  };

  const handleOk = async () => {
    try {
      saveMutation.mutate(await form.validate());
    } catch {
      // 校验失败,表单内已显示错误信息。
    }
  };

  return (
    <Modal
      title={editing ? `编辑字典:${editing.name}` : "新建字典"}
      visible={visible}
      onOk={handleOk}
      confirmLoading={saveMutation.isPending}
      onCancel={onClose}
      unmountOnExit
      afterOpen={openWithDefault}
      style={{ width: 680 }}
    >
      <Form form={form} layout="vertical">
        <Form.Item field="code" label="编码" rules={[{ required: true, message: "请输入编码" }]}>
          <Input placeholder="如 common_status" maxLength={64} />
        </Form.Item>
        <Form.Item field="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
          <Input placeholder="显示名" maxLength={64} />
        </Form.Item>
        <Form.Item field="remark" label="备注">
          <Input placeholder="用途说明" maxLength={255} />
        </Form.Item>

        <Form.Item label="字典项" required>
          <Form.List field="entries">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}
                  >
                    <Form.Item
                      field={`${field.field}.label`}
                      rules={[{ required: true, message: "标签必填" }]}
                      noStyle
                    >
                      <Input placeholder="标签,如 启用" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      field={`${field.field}.value`}
                      rules={[{ required: true, message: "值必填" }]}
                      noStyle
                    >
                      <Input placeholder="值,如 1" style={{ width: 100 }} />
                    </Form.Item>
                    <Form.Item field={`${field.field}.sort`} noStyle>
                      <Input placeholder="排序" style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item field={`${field.field}.enabled`} noStyle triggerPropName="checked">
                      <Switch style={{ marginTop: 4 }} />
                    </Form.Item>
                    <Button
                      size="mini"
                      status="danger"
                      onClick={() => remove(index)}
                      style={{ marginTop: 2 }}
                    >
                      删除
                    </Button>
                  </div>
                ))}
                <Button size="mini" onClick={() => add(emptyEntry())}>
                  + 添加字典项
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function emptyEntry(): EntryFormValue {
  return { label: "", value: "", sort: 0, enabled: true };
}
