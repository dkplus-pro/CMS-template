package repo

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// UpsertPermission 按唯一键 code 幂等写入权限点,返回 ID。
func UpsertPermission(ctx context.Context, db *gorm.DB, permission *Permission) (int64, error) {
	if err := db.WithContext(ctx).
		Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "code"}}, DoNothing: true}).
		Create(permission).Error; err != nil {
		return 0, fmt.Errorf("upsert permission %s: %w", permission.Code, err)
	}
	var existing Permission
	if err := db.WithContext(ctx).Where("code = ?", permission.Code).First(&existing).Error; err != nil {
		return 0, fmt.Errorf("reload permission %s: %w", permission.Code, err)
	}
	return existing.ID, nil
}

// UpsertApiPermissions 把路由注册表中的 API 权限点同步进 permissions 表;
// 每个模块的 API 点挂在对应 menu 权限点之下(menu 点不存在则一并创建)。
func UpsertApiPermissions(ctx context.Context, db *gorm.DB, entries []ApiPermissionSeed) error {
	for _, entry := range entries {
		parentID := int64(0)
		if entry.ParentMenuCode != "" {
			menuID, err := UpsertPermission(ctx, db, &Permission{
				Code: entry.ParentMenuCode, Name: entry.ParentMenuName, Type: "menu",
			})
			if err != nil {
				return err
			}
			parentID = menuID
		}
		if _, err := UpsertPermission(ctx, db, &Permission{
			Code:     entry.Code,
			Name:     entry.Name,
			Type:     "api",
			ParentID: parentID,
		}); err != nil {
			return err
		}
	}
	return nil
}

// ApiPermissionSeed 路由注册表 → permissions 表的同步载荷。
type ApiPermissionSeed struct {
	Code           string
	Name           string
	ParentMenuCode string
	ParentMenuName string
}

// ListPermissions 全量权限点(按 type、code 排序,供组树)。
func ListPermissions(ctx context.Context, db *gorm.DB) ([]Permission, error) {
	var list []Permission
	if err := db.WithContext(ctx).
		Order("type ASC, code ASC").Find(&list).Error; err != nil {
		return nil, fmt.Errorf("list permissions: %w", err)
	}
	return list, nil
}

// ListPermissionIDsByRoleID 查角色拥有的权限点 ID。
func ListPermissionIDsByRoleID(ctx context.Context, db *gorm.DB, roleID int64) ([]int64, error) {
	var ids []int64
	if err := db.WithContext(ctx).Model(&RolePermission{}).
		Where("role_id = ?", roleID).Pluck("permission_id", &ids).Error; err != nil {
		return nil, fmt.Errorf("list permission ids by role: %w", err)
	}
	return ids, nil
}

// ReplaceRolePermissions 全量覆盖角色的权限点(事务内先删后插)。
func ReplaceRolePermissions(ctx context.Context, db *gorm.DB, roleID int64, permissionIDs []int64) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", roleID).Delete(&RolePermission{}).Error; err != nil {
			return fmt.Errorf("clear role permissions: %w", err)
		}
		for _, pid := range permissionIDs {
			rp := RolePermission{RoleID: roleID, PermissionID: pid}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rp).Error; err != nil {
				return fmt.Errorf("grant permission %d: %w", pid, err)
			}
		}
		return nil
	})
}

// CountUsersByRoleID 统计绑定某角色的用户数(删除角色前的守卫)。
func CountUsersByRoleID(ctx context.Context, db *gorm.DB, roleID int64) (int64, error) {
	var count int64
	if err := db.WithContext(ctx).Model(&UserRole{}).
		Where("role_id = ?", roleID).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("count users by role: %w", err)
	}
	return count, nil
}
