// Package types 内部领域模型:service 层的入参出参,不把生成物类型穿透到业务层。
package types

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
