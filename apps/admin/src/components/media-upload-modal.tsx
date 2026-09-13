import { Message, Modal, Select, Space, Upload } from "@arco-design/web-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { MediaController } from "../api/controllers.gen";
import type { MediaGroupKind } from "../api/generated/cMSAdminAPI.schemas";
import { queryKeys } from "../api/queryKeys";
import { useMediaGroups } from "../hooks/use-media-groups";

interface MediaUploadModalProps {
  kind: MediaGroupKind;
  visible: boolean;
  onClose: () => void;
}

const KIND_CONFIG: Record<
  MediaGroupKind,
  { title: string; accept: string; tip: string; multiple: boolean }
> = {
  image: {
    title: "上传图片",
    accept: "image/png,image/jpeg,image/gif,image/webp",
    tip: "支持 PNG / JPG / GIF / WebP,单张不超过 10MB",
    multiple: true
  },
  video: {
    title: "上传视频",
    accept: "video/mp4,video/webm,video/quicktime",
    tip: "支持 MP4 / WebM / MOV,单个不超过 200MB",
    multiple: false
  }
};

// 上传弹窗(图片 / 视频页共用):拖拽上传 + 可选"分组"Select(数据来自当前 kind 的分组列表,
// 走 multipart 的 groupId 字段;不选 = 未分组)。分组列表与分组栏共享同一 queryKey 缓存。
export default function MediaUploadModal({ kind, visible, onClose }: MediaUploadModalProps) {
  const queryClient = useQueryClient();
  const config = KIND_CONFIG[kind];
  const groupsQuery = useMediaGroups(kind);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);

  // 每次打开重置分组选择。
  useEffect(() => {
    if (visible) {
      setGroupId(undefined);
    }
  }, [visible]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      kind === "image"
        ? MediaController.uploadImage({ file, groupId })
        : MediaController.uploadVideo({ file, groupId }),
    onSuccess: () => {
      Message.success(kind === "image" ? "图片已上传" : "视频已上传");
      void queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
    }
    // 失败提示(类型/大小)由 client.ts 拦截器统一弹出
  });

  return (
    <Modal title={config.title} visible={visible} footer={null} onCancel={onClose} unmountOnExit>
      <Space direction="vertical" size="medium" style={{ width: "100%" }}>
        <Select
          placeholder="分组(不选为未分组)"
          allowClear
          style={{ width: "100%" }}
          value={groupId}
          onChange={setGroupId}
          loading={groupsQuery.isPending}
          notFoundContent={groupsQuery.isPending ? "加载中…" : "暂无分组"}
          options={(groupsQuery.data?.list ?? []).map((group) => ({
            label: group.name,
            value: group.id
          }))}
        />
        <Upload
          drag
          multiple={config.multiple}
          accept={config.accept}
          customRequest={(options) => {
            uploadMutation.mutate(options.file);
            options.onSuccess?.();
          }}
          tip={config.tip}
        />
      </Space>
    </Modal>
  );
}
