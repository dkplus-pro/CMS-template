import {
  Button,
  Card,
  Image as ArcoImage,
  Message,
  Modal,
  Space,
  Upload
} from "@arco-design/web-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { MediaController } from "../../../api/controllers.gen";
import type { ImageAsset } from "../../../api/generated/cMSAdminAPI.schemas";
import { queryKeys } from "../../../api/queryKeys";
import AuthGate from "../../../components/auth-gate";
import { useFileURL } from "../../../hooks/use-file-url";

// 图片管理:网格缩略图 + 上传 + 预览大图 + 删除(底层是通用文件存储,见 docs/mvp-plan.md 阶段 5)。
export default function ImagesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [uploadVisible, setUploadVisible] = useState(false);

  const listQuery = useQuery({
    queryKey: queryKeys.media.images(page, pageSize),
    queryFn: () => MediaController.listImages({ page, pageSize })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => MediaController.deleteImage(id),
    onSuccess: () => {
      Message.success("图片已删除");
      void queryClient.invalidateQueries({ queryKey: ["media"] });
    }
  });

  const deleteImage = (id: number, title: string) => {
    Modal.confirm({
      title: "删除确认",
      content: `确定删除图片 ${title} 吗?`,
      onOk: () => deleteMutation.mutateAsync(id)
    });
  };

  const images = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  return (
    <Card
      title="图片管理"
      extra={
        <AuthGate permission="media:image:upload">
          <Button type="primary" onClick={() => setUploadVisible(true)}>
            上传图片
          </Button>
        </AuthGate>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 16
        }}
      >
        {images.map((image) => (
          <ImageCard key={image.id} image={image} onDelete={deleteImage} />
        ))}
      </div>
      {images.length === 0 && !listQuery.isPending ? (
        <div style={{ color: "#86909c", textAlign: "center", padding: "40px 0" }}>
          暂无图片,点击右上角上传
        </div>
      ) : null}

      <Space style={{ marginTop: 16, justifyContent: "flex-end", width: "100%" }}>
        <Button disabled={total <= page * pageSize} onClick={() => setPage(page + 1)}>
          下一页
        </Button>
      </Space>

      <UploadModal visible={uploadVisible} onClose={() => setUploadVisible(false)} />
    </Card>
  );
}

function ImageCard({
  image,
  onDelete
}: {
  image: ImageAsset;
  onDelete: (id: number, title: string) => void;
}) {
  const url = useFileURL(image.fileId, image.url);

  return (
    <div
      style={{
        border: "1px solid #e5e6eb",
        borderRadius: 8,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      {/* Arco Image 自带点击预览大图 */}
      <ArcoImage
        src={url ?? ""}
        width="100%"
        height={120}
        style={{ objectFit: "cover", borderRadius: 4 }}
        title={image.title}
      />
      <div
        style={{ fontSize: 12, color: "#4e5969", wordBreak: "break-all" }}
        title={image.origName}
      >
        {image.title}
        {image.width && image.height ? `(${image.width}×${image.height})` : ""}
      </div>
      <Button size="mini" status="danger" onClick={() => onDelete(image.id, image.title)}>
        删除
      </Button>
    </div>
  );
}

function UploadModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => MediaController.uploadImage({ file }),
    onSuccess: () => {
      Message.success("图片已上传");
      void queryClient.invalidateQueries({ queryKey: ["media"] });
      onClose();
    }
    // 失败提示(类型/大小)由 client.ts 拦截器统一弹出
  });

  return (
    <Modal title="上传图片" visible={visible} footer={null} onCancel={onClose} unmountOnExit>
      <Upload
        drag
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp"
        customRequest={(options) => {
          uploadMutation.mutate(options.file);
          options.onSuccess?.();
        }}
        tip="支持 PNG / JPG / GIF / WebP,单张不超过 10MB"
      />
    </Modal>
  );
}
