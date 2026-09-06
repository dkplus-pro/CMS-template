// Package handler 实现 openapi.yaml 生成的 ServerInterface。
// 每个资源一个文件;本文件放公共装配。
package handler

import (
	"log/slog"

	gen "github.com/cms-template/server/gen"
	"github.com/cms-template/server/internal/service"
)

// Handler 承载全部 HTTP 处理器,依赖通过构造函数注入。
type Handler struct {
	logger *slog.Logger
	auth   *service.AuthService
}

// New 装配 Handler。
func New(logger *slog.Logger, auth *service.AuthService) *Handler {
	return &Handler{logger: logger, auth: auth}
}

// 编译期保证 Handler 实现了契约生成的全部接口;新增接口后此处会立即报错。
var _ gen.ServerInterface = (*Handler)(nil)
