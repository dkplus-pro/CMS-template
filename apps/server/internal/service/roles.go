package service

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/cms-template/server/internal/repo"
	"github.com/cms-template/server/internal/types"
)

// 角色模块业务错误。
var (
	ErrRoleCodeExists    = errors.New("role code exists")
	ErrBuiltinRole       = errors.New("builtin role")
	ErrRoleInUse         = errors.New("role in use")
	ErrPermissionInvalid = errors.New("permission invalid")
)

// RoleService 角色管理业务。
type RoleService struct {
	db *gorm.DB
}

// NewRoleService 装配 RoleService。
func NewRoleService(db *gorm.DB) *RoleService {
	return &RoleService{db: db}
}

// List 角色分页(含每角色的权限点 ID,供前端回显)。
func (s *RoleService) List(ctx context.Context, page, pageSize int, keyword string, status *bool) ([]types.RoleItem, int64, error) {
	roles, total, err := repo.ListRoles(ctx, s.db, page, pageSize, keyword, status)
	if err != nil {
		return nil, 0, err
	}

	items := make([]types.RoleItem, 0, len(roles))
	for _, role := range roles {
		item, err := s.toRoleItem(ctx, role)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, nil
}

// All 全量角色(分配角色下拉用)。
func (s *RoleService) All(ctx context.Context) ([]types.RoleBrief, error) {
	roles, err := repo.ListAllRoles(ctx, s.db)
	if err != nil {
		return nil, err
	}
	briefs := make([]types.RoleBrief, 0, len(roles))
	for _, role := range roles {
		briefs = append(briefs, types.RoleBrief{
			ID: role.ID, Code: role.Code, Name: role.Name, Status: role.Status,
		})
	}
	return briefs, nil
}

// Get 角色详情。
func (s *RoleService) Get(ctx context.Context, id int64) (types.RoleItem, error) {
	role, err := repo.GetRoleByID(ctx, s.db, id)
	if err != nil {
		return types.RoleItem{}, err
	}
	return s.toRoleItem(ctx, role)
}

// Create 新建角色;code 唯一。
func (s *RoleService) Create(ctx context.Context, code, name, remark string, status bool) (types.RoleItem, error) {
	if _, err := repo.GetRoleByCode(ctx, s.db, code); err == nil {
		return types.RoleItem{}, ErrRoleCodeExists
	} else if !errors.Is(err, repo.ErrRoleNotFound) {
		return types.RoleItem{}, err
	}

	role := repo.Role{Code: code, Name: name, Remark: remark, Status: status}
	if err := repo.CreateRole(ctx, s.db, &role); err != nil {
		return types.RoleItem{}, err
	}
	return s.toRoleItem(ctx, role)
}

// Update 编辑角色;内置角色不允许改编码(其余字段可改)。
func (s *RoleService) Update(ctx context.Context, id int64, code, name, remark string, status bool) (types.RoleItem, error) {
	role, err := repo.GetRoleByID(ctx, s.db, id)
	if err != nil {
		return types.RoleItem{}, err
	}
	if role.IsBuiltin && role.Code != code {
		return types.RoleItem{}, ErrBuiltinRole
	}
	role.Code, role.Name, role.Remark, role.Status = code, name, remark, status
	if err := repo.UpdateRole(ctx, s.db, &role); err != nil {
		return types.RoleItem{}, err
	}
	return s.toRoleItem(ctx, role)
}

// Delete 删除角色;内置角色不可删,仍有用户绑定时拒绝。
func (s *RoleService) Delete(ctx context.Context, id int64) error {
	role, err := repo.GetRoleByID(ctx, s.db, id)
	if err != nil {
		return err
	}
	if role.IsBuiltin {
		return ErrBuiltinRole
	}
	bound, err := repo.CountUsersByRoleID(ctx, s.db, id)
	if err != nil {
		return err
	}
	if bound > 0 {
		return ErrRoleInUse
	}
	return repo.DeleteRole(ctx, s.db, id)
}

// UpdatePermissions 角色分配权限(全量覆盖,校验权限点存在)。
func (s *RoleService) UpdatePermissions(ctx context.Context, roleID int64, permissionIDs []int64) error {
	if _, err := repo.GetRoleByID(ctx, s.db, roleID); err != nil {
		return err
	}
	for _, pid := range permissionIDs {
		var count int64
		if err := s.db.WithContext(ctx).Model(&repo.Permission{}).Where("id = ?", pid).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return ErrPermissionInvalid
		}
	}
	return repo.ReplaceRolePermissions(ctx, s.db, roleID, permissionIDs)
}

func (s *RoleService) toRoleItem(ctx context.Context, role repo.Role) (types.RoleItem, error) {
	permissionIDs, err := repo.ListPermissionIDsByRoleID(ctx, s.db, role.ID)
	if err != nil {
		return types.RoleItem{}, err
	}
	return types.RoleItem{
		ID:            role.ID,
		Code:          role.Code,
		Name:          role.Name,
		Remark:        role.Remark,
		Status:        role.Status,
		IsBuiltin:     role.IsBuiltin,
		PermissionIds: permissionIDs,
	}, nil
}
