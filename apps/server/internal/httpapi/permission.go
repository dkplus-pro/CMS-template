package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"strings"
)

// RoutePermission 单个接口的权限码绑定;code 命名规范:模块:资源:动作(见 docs/api-pages.md)。
// Name 为权限点展示名,ParentMenu 为该 API 点在权限树上挂载的菜单权限点。
type RoutePermission struct {
	Method   string
	Pattern  string // 支持 {id} 路径参数占位
	Code     string
	Name     string
	Menu     string
	MenuName string
}

// RoutePermissions API 权限注册表:服务端鉴权的唯一事实源,
// 启动时由 main 经 repo.UpsertApiPermissions 同步进 permissions 表(type=api)。
var RoutePermissions = []RoutePermission{
	{"GET", "/users", "system:user:list", "用户列表", "menu:system:user", "用户管理"},
	{"POST", "/users", "system:user:create", "创建用户", "menu:system:user", "用户管理"},
	{"GET", "/users/{id}", "system:user:list", "用户列表", "menu:system:user", "用户管理"},
	{"PUT", "/users/{id}", "system:user:update", "编辑用户", "menu:system:user", "用户管理"},
	{"DELETE", "/users/{id}", "system:user:delete", "删除用户", "menu:system:user", "用户管理"},
	{"PATCH", "/users/{id}/status", "system:user:update", "启用禁用用户", "menu:system:user", "用户管理"},
	{"PUT", "/users/{id}/roles", "system:user:assign", "分配用户角色", "menu:system:user", "用户管理"},

	{"GET", "/roles", "system:role:list", "角色列表", "menu:system:role", "角色管理"},
	{"POST", "/roles", "system:role:create", "创建角色", "menu:system:role", "角色管理"},
	{"GET", "/roles/{id}", "system:role:list", "角色列表", "menu:system:role", "角色管理"},
	{"PUT", "/roles/{id}", "system:role:update", "编辑角色", "menu:system:role", "角色管理"},
	{"DELETE", "/roles/{id}", "system:role:delete", "删除角色", "menu:system:role", "角色管理"},
	{"PUT", "/roles/{id}/permissions", "system:role:assign", "分配角色权限", "menu:system:role", "角色管理"},

	{"GET", "/permissions", "system:role:assign", "分配角色权限", "menu:system:role", "角色管理"},

	{"GET", "/operation-logs", "system:log:list", "操作日志列表", "menu:system:log", "操作日志"},

	{"GET", "/configs/{group}", "system:config:list", "读取配置", "menu:system:config", "系统配置"},
	{"PUT", "/configs/{group}", "system:config:update", "更新配置", "menu:system:config", "系统配置"},

	{"GET", "/dicts", "system:dict:list", "字典列表", "menu:system:dict", "字典管理"},
	{"POST", "/dicts", "system:dict:create", "创建字典", "menu:system:dict", "字典管理"},
	{"PUT", "/dicts/{id}", "system:dict:update", "编辑字典", "menu:system:dict", "字典管理"},
	{"DELETE", "/dicts/{id}", "system:dict:delete", "删除字典", "menu:system:dict", "字典管理"},
	{"GET", "/dicts/{code}/items", "system:dict:list", "字典项列表", "menu:system:dict", "字典管理"},
	{"POST", "/dicts/{code}/items", "system:dict:update", "创建字典项", "menu:system:dict", "字典管理"},
	{"PUT", "/dicts/{code}/items/{itemId}", "system:dict:update", "编辑字典项", "menu:system:dict", "字典管理"},
	{"DELETE", "/dicts/{code}/items/{itemId}", "system:dict:update", "删除字典项", "menu:system:dict", "字典管理"},
	{"PATCH", "/dicts/{id}/status", "system:dict:update", "字典上下线", "menu:system:dict", "字典管理"},
	{"PUT", "/dicts/{id}/entries", "system:dict:update", "覆写字典项", "menu:system:dict", "字典管理"},

	{"GET", "/images", "media:image:list", "图片列表", "menu:media:image", "图片管理"},
	{"POST", "/images", "media:image:upload", "上传图片", "menu:media:image", "图片管理"},
	{"GET", "/images/{id}", "media:image:list", "图片列表", "menu:media:image", "图片管理"},
	{"DELETE", "/images/{id}", "media:image:delete", "删除图片", "menu:media:image", "图片管理"},
	{"GET", "/videos", "media:video:list", "视频列表", "menu:media:video", "视频管理"},
	{"POST", "/videos", "media:video:upload", "上传视频", "menu:media:video", "视频管理"},
	{"GET", "/videos/{id}", "media:video:list", "视频列表", "menu:media:video", "视频管理"},
	{"DELETE", "/videos/{id}", "media:video:delete", "删除视频", "menu:media:video", "视频管理"},
}

// MatchRoutePermission 按方法与路径匹配注册表;未命中的接口仅需登录。
func MatchRoutePermission(method, path string) (string, bool) {
	pathSegs := strings.Split(strings.Trim(path, "/"), "/")
	for _, rp := range RoutePermissions {
		if rp.Method != method {
			continue
		}
		patternSegs := strings.Split(strings.Trim(rp.Pattern, "/"), "/")
		if len(patternSegs) != len(pathSegs) {
			continue
		}
		matched := true
		for i, seg := range patternSegs {
			if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
				continue
			}
			if seg != pathSegs[i] {
				matched = false
				break
			}
		}
		if matched {
			return rp.Code, true
		}
	}
	return "", false
}

// PermissionCodesLoader 按用户加载权限码(service 层实现)。
type PermissionCodesLoader func(ctx context.Context, userID int64) ([]string, error)

// PermissionCheck API 权限中间件:命中注册表的接口校验权限码,无权限返回 403。
// 必须挂在 JWT 中间件之后(依赖 claims)。
func PermissionCheck(loader PermissionCodesLoader, logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			code, ok := MatchRoutePermission(r.Method, r.URL.Path)
			if ok {
				claims, has := ClaimsFromContext(r.Context())
				if !has {
					WriteError(w, http.StatusUnauthorized, "未登录或凭证缺失")
					return
				}
				codes, err := loader(r.Context(), claims.UserID)
				if err != nil {
					logger.Error("load permission codes", "error", err)
					WriteError(w, http.StatusInternalServerError, "internal server error")
					return
				}
				if !slices.Contains(codes, code) {
					WriteError(w, http.StatusForbidden, "无权限执行此操作")
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
