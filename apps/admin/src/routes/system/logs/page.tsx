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

import type { OperationLogItem } from "../../../api/generated/cMSAdminAPI.schemas";
import { LogsController } from "../../../api/controllers.gen";
import { queryKeys } from "../../../api/queryKeys";

// 操作日志:只读查询页(谁/时间/什么接口/成败),详情用抽屉展示。
export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [username, setUsername] = useState("");
  const [ok, setOk] = useState<boolean | undefined>(undefined);
  const [range, setRange] = useState<[string, string] | undefined>(undefined);
  const [detail, setDetail] = useState<OperationLogItem | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.logs.list(page, pageSize, username, ok, range),
    queryFn: () =>
      LogsController.listOperationLogs({
        page,
        pageSize,
        username: username || undefined,
        ok,
        startTime: range?.[0],
        endTime: range?.[1]
      })
  });

  const columns = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "操作人", dataIndex: "username", width: 110 },
    {
      title: "请求",
      width: 220,
      render: (_: unknown, record: OperationLogItem) => `${record.method} ${record.path}`
    },
    {
      title: "结果",
      dataIndex: "ok",
      width: 90,
      render: (value: boolean) =>
        value ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>
    },
    { title: "状态码", dataIndex: "statusCode", width: 90 },
    { title: "IP", dataIndex: "ip", width: 130 },
    { title: "耗时(ms)", dataIndex: "latencyMs", width: 100 },
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
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索操作人"
          style={{ width: 200 }}
          onSearch={(value) => {
            setUsername(value);
            setPage(1);
          }}
        />
        <Select
          placeholder="结果"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => {
            setOk(value === undefined ? undefined : value === 1);
            setPage(1);
          }}
          options={[
            { label: "成功", value: 1 },
            { label: "失败", value: 0 }
          ]}
        />
        <DatePicker.RangePicker
          showTime
          style={{ width: 380 }}
          onChange={(values, dateString) => {
            const start = dateString?.[0];
            const end = dateString?.[1];
            // Arco 第二个参数是格式化字符串;服务端要 RFC3339,统一转 ISO。
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
            <DetailRow label="请求" value={`${detail.method} ${detail.path}`} />
            {detail.action ? <DetailRow label="操作" value={detail.action} /> : null}
            <DetailRow label="结果" value={detail.ok ? "成功" : "失败"} />
            <DetailRow label="状态码" value={String(detail.statusCode)} />
            <DetailRow label="IP" value={detail.ip || "-"} />
            <DetailRow label="耗时" value={`${detail.latencyMs} ms`} />
            <DetailRow label="时间" value={new Date(detail.createdAt).toLocaleString("zh-CN")} />
            {detail.message ? <DetailRow label="失败原因" value={detail.message} /> : null}
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
