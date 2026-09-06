// Package handler 实现 openapi/admin.yaml 生成的 admin ServerInterface。
// 每个资源一个文件;本文件放公共装配。
package handler

import (
	"log/slog"

	gen "github.com/cms-template/server/gen/admin"
	"github.com/cms-template/server/internal/media"
	"github.com/cms-template/server/internal/service"
)

// Handler 承载全部 HTTP 处理器,依赖通过构造函数注入。
type Handler struct {
	logger      *slog.Logger
	auth        *service.AuthService
	users       *service.UserService
	roles       *service.RoleService
	permissions *service.PermissionService
	logs        *service.LogService
	configs     *service.ConfigService
	dicts       *service.DictService
	media       *media.Service
}

// New 装配 Handler。
func New(
	logger *slog.Logger,
	auth *service.AuthService,
	users *service.UserService,
	roles *service.RoleService,
	permissions *service.PermissionService,
	logs *service.LogService,
	configs *service.ConfigService,
	dicts *service.DictService,
	media *media.Service,
) *Handler {
	return &Handler{
		logger: logger, auth: auth, users: users, roles: roles,
		permissions: permissions, logs: logs, configs: configs, dicts: dicts, media: media,
	}
}

// 编译期保证 Handler 实现了契约生成的全部接口;新增接口后此处会立即报错。
var _ gen.ServerInterface = (*Handler)(nil)
