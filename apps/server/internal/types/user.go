// Package types 内部领域模型:service 层的入参出参,不把生成物类型穿透到业务层。
package types

import "time"

// UserInfo 当前用户信息(登录与 /auth/me 共用)。
type UserInfo struct {
	ID          int64
	Username    string
	Nickname    string
	Email       string
	Status      bool
	Roles       []string
	Permissions []string
}

// UserItem 用户列表/详情条目。
type UserItem struct {
	ID          int64
	Username    string
	Nickname    string
	Email       string
	Status      bool
	IsBuiltin   bool
	LastLoginAt *time.Time
	RoleIds     []int64
}

// RoleItem 角色列表/详情条目。
type RoleItem struct {
	ID            int64
	Code          string
	Name          string
	Remark        string
	Status        bool
	IsBuiltin     bool
	PermissionIds []int64
}

// RoleBrief 角色简要信息(下拉用)。
type RoleBrief struct {
	ID     int64
	Code   string
	Name   string
	Status bool
}

// PermissionNode 权限点树节点。
type PermissionNode struct {
	ID       int64
	Code     string
	Name     string
	Type     string
	ParentID int64
	Children []PermissionNode
}

// MenuItem 管理端菜单条目(树)。
type MenuItem struct {
	ID             int64
	ParentID       int64
	Name           string
	Path           string
	ComponentKey   string
	Icon           string
	PermissionID   int64
	PermissionCode string
	Sort           int
	Visible        bool
	Children       []MenuItem
}

// MenuUpsert 菜单新建/编辑请求。
type MenuUpsert struct {
	ParentID       int64
	Name           string
	Path           string
	ComponentKey   string
	Icon           string
	PermissionCode string
	Sort           int
	Visible        bool
}

// AuthMenuNode 当前用户可见菜单节点(树)。
type AuthMenuNode struct {
	ID           int64
	ParentID     int64
	Name         string
	Path         string
	ComponentKey string
	Icon         string
	Sort         int
	Children     []AuthMenuNode
}

// OperationLogItem 操作日志条目(只读)。
type OperationLogItem struct {
	ID         int64
	UserID     int64
	Username   string
	Method     string
	Path       string
	Action     string
	OK         bool
	StatusCode int
	Message    string
	IP         string
	LatencyMS  int64
	CreatedAt  time.Time
}

// ConfigItem 配置键值条目。
type ConfigItem struct {
	Key    string
	Value  string
	Remark string
}

// Dict 字典。
type Dict struct {
	ID     int64
	Code   string
	Name   string
	Remark string
	Status bool
}

// DictEntry 字典项。
type DictEntry struct {
	ID     int64
	DictID int64
	Label  string
	Value  string
	Sort   int
	Status bool
}
