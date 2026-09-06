import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tag
} from "@arco-design/web-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type {
  ListOperationLogsStatus,
  OperationLogItem
} from "../../../api/generated/cMSAdminAPI.schemas";
import { LogsController } from "../../../api/controllers.gen";
import { queryKeys } from "../../../api/queryKeys";

// 业务操作日志:只读查询页(谁在什么时间对什么对象做了什么、结果如何),给运营查看。
// HTTP 访问日志不入库、只写服务器文件(见 docs/mvp-plan.md 阶段 4 修订)。
export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [username, setUsername] = useState("");
  const [resource, setResource] = useState<string | undefined>(undefined);
  const [action, setAction] = useState<string>("");
  const [status, setStatus] = useState<ListOperationLogsStatus | undefined>(undefined);
  const [range, setRange] = useState<[string, string] | undefined>(undefined);
  const [detail, setDetail] = useState<OperationLogItem | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.logs.list(page, pageSize, username, resource, action, status, range),
    queryFn: () =>
      LogsController.listOperationLogs({
        page,
        pageSize,
        username: username || undefined,
        resource,
        action: action || undefined,
        status,
        startTime: range?.[0],
        endTime: range?.[1]
      })
  });

  const columns = [
    { title: "操作人", dataIndex: "username", width: 110 },
    { title: "动作", dataIndex: "action", width: 180 },
    {
      title: "资源",
      dataIndex: "resource",
      width: 120,
      render: (value: string, record: OperationLogItem) =>
        record.resourceId ? `${value}:${record.resourceId}` : value
    },
    { title: "描述", dataIndex: "description" },
    {
      title: "结果",
      dataIndex: "status",
      width: 90,
      render: (value: string) =>
        value === "success" ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>
    },
    { title: "IP", dataIndex: "ip", width: 130 },
    {
      title: "时间",
      dataIndex: "createdAt",
      width: 170,
      render: (value: string) => new Date(value).toLocaleString("zh-CN")
    },
    {
      title: "操作",
      width: 80,
      render: (_: unknown, record: OperationLogItem) => (
        <Button size="mini" onClick={() => setDetail(record)}>
          详情
        </Button>
      )
    }
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索操作人"
          style={{ width: 180 }}
          onSearch={(value) => {
            setUsername(value);
            setPage(1);
          }}
        />
        <Input
          placeholder="动作,如 user.delete"
          style={{ width: 180 }}
          allowClear
          onChange={(value) => setAction(value)}
        />
        <Select
          placeholder="资源"
          style={{ width: 130 }}
          allowClear
          onChange={(value) => {
            setResource(value);
            setPage(1);
          }}
          options={["user", "role", "config", "dict", "dictEntry"].map((value) => ({
            label: value,
            value
          }))}
        />
        <Select
          placeholder="结果"
          style={{ width: 110 }}
          allowClear
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { label: "成功", value: "success" },
            { label: "失败", value: "failed" }
          ]}
        />
        <DatePicker.RangePicker
          showTime
          style={{ width: 380 }}
          onChange={(values, dateString) => {
            const start = dateString?.[0];
            const end = dateString?.[1];
            if (start && end) {
              setRange([
                new Date(String(start)).toISOString(),
                new Date(String(end)).toISOString()
              ]);
            } else {
              setRange(undefined);
            }
            setPage(1);
          }}
        />
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

      <Drawer
        width={480}
        visible={detail !== null}
        onCancel={() => setDetail(null)}
        footer={null}
        title="日志详情"
      >
        {detail ? (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <DetailRow label="操作人" value={detail.username || "(未登录)"} />
            <DetailRow label="动作" value={detail.action} />
            <DetailRow
              label="资源"
              value={
                detail.resourceId ? `${detail.resource}:${detail.resourceId}` : detail.resource
              }
            />
            <DetailRow label="结果" value={detail.status === "success" ? "成功" : "失败"} />
            <DetailRow label="IP" value={detail.ip || "-"} />
            <DetailRow label="时间" value={new Date(detail.createdAt).toLocaleString("zh-CN")} />
            <DetailRow label="描述" value={detail.description} />
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Space style={{ justifyContent: "space-between", width: "100%" }}>
      <span style={{ color: "#86909c" }}>{label}</span>
      <span>{value}</span>
    </Space>
  );
}
