import { Button, Card, Drawer, Message, Modal, Space, Table, Upload } from "@arco-design/web-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { MediaController } from "../../../api/controllers.gen";
import { queryKeys } from "../../../api/queryKeys";
import AuthGate from "../../../components/auth-gate";
import { useFileURL } from "../../../hooks/use-file-url";

interface VideoItem {
  id: number;
  fileId: number;
  title: string;
  origName: string;
  size: number;
}

// 视频管理:列表 + 上传 + 内嵌播放(抽屉)+ 删除(见 docs/mvp-plan.md 阶段 5)。
export default function VideosPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [playing, setPlaying] = useState<VideoItem | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.media.videos(page, pageSize),
    queryFn: () => MediaController.listVideos({ page, pageSize })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => MediaController.deleteVideo(id),
    onSuccess: () => {
      Message.success("视频已删除");
      void queryClient.invalidateQueries({ queryKey: ["media"] });
    }
  });

  const deleteVideo = (video: VideoItem) => {
    Modal.confirm({
      title: "删除确认",
      content: `确定删除视频 ${video.title} 吗?`,
      onOk: () => deleteMutation.mutateAsync(video.id)
    });
  };

  const videos = (listQuery.data?.list ?? []) as VideoItem[];
  const total = listQuery.data?.total ?? 0;

  const columns = [
    { title: "标题", dataIndex: "title" },
    {
      title: "大小",
      dataIndex: "size",
      width: 110,
      render: (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`
    },
    {
      title: "操作",
      width: 200,
      render: (_: unknown, record: VideoItem) => (
        <Space>
          <Button size="mini" onClick={() => setPlaying(record)}>
            播放
          </Button>
          <AuthGate permission="media:video:delete">
            <Button size="mini" status="danger" onClick={() => deleteVideo(record)}>
              删除
            </Button>
          </AuthGate>
        </Space>
      )
    }
  ];

  return (
    <Card
      title="视频管理"
      extra={
        <AuthGate permission="media:video:upload">
          <Button type="primary" onClick={() => setUploadVisible(true)}>
            上传视频
          </Button>
        </AuthGate>
      }
    >
      <Table
        rowKey="id"
        loading={listQuery.isPending}
        columns={columns}
        data={videos}
        pagination={{
          total,
          current: page,
          pageSize,
          onChange: (current, size) => {
            setPage(current);
            setPageSize(size);
          }
        }}
      />

      <Drawer
        width={640}
        visible={playing !== null}
        onCancel={() => setPlaying(null)}
        footer={null}
        title={playing?.title}
      >
        {playing ? <VideoPlayer fileId={playing.fileId} /> : null}
      </Drawer>

      <UploadModal visible={uploadVisible} onClose={() => setUploadVisible(false)} />
    </Card>
  );
}

function VideoPlayer({ fileId }: { fileId: number }) {
  const url = useFileURL(fileId);
  if (!url) {
    return <div style={{ color: "#86909c" }}>加载中…</div>;
  }
  return <video src={url} controls style={{ width: "100%" }} />;
}

function UploadModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => MediaController.uploadVideo({ file }),
    onSuccess: () => {
      Message.success("视频已上传");
      void queryClient.invalidateQueries({ queryKey: ["media"] });
      onClose();
    }
  });

  return (
    <Modal title="上传视频" visible={visible} footer={null} onCancel={onClose} unmountOnExit>
      <Upload
        drag
        accept="video/mp4,video/webm,video/quicktime"
        customRequest={(options) => {
          uploadMutation.mutate(options.file);
          options.onSuccess?.();
        }}
        tip="支持 MP4 / WebM / MOV,单个不超过 200MB"
      />
    </Modal>
  );
}
