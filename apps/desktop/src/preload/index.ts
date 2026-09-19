import { contextBridge } from "electron";

// 最小 preload:占坑期没有主进程 API,先空暴露一个命名空间占位,后续 IPC 能力在这里扩展。
contextBridge.exposeInMainWorld("desktop", {});
