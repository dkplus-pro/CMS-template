package repo

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// ErrMenuNotFound 菜单不存在。
var ErrMenuNotFound = errors.New("menu not found")

// ListMenus 全量菜单(排序:parent_id → sort → id,供组树)。
func ListMenus(ctx context.Context, db *gorm.DB) ([]Menu, error) {
	var menus []Menu
	if err := db.WithContext(ctx).
		Order("parent_id ASC, sort ASC, id ASC").Find(&menus).Error; err != nil {
		return nil, fmt.Errorf("list menus: %w", err)
	}
	return menus, nil
}

// GetMenuByID 按主键查菜单。
func GetMenuByID(ctx context.Context, db *gorm.DB, id int64) (Menu, error) {
	var menu Menu
	err := db.WithContext(ctx).First(&menu, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Menu{}, ErrMenuNotFound
	}
	if err != nil {
		return Menu{}, fmt.Errorf("get menu by id: %w", err)
	}
	return menu, nil
}

// GetMenuByPath 按路径查菜单(唯一性校验)。
func GetMenuByPath(ctx context.Context, db *gorm.DB, path string) (Menu, error) {
	var menu Menu
	err := db.WithContext(ctx).Where("path = ?", path).First(&menu).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Menu{}, ErrMenuNotFound
	}
	if err != nil {
		return Menu{}, fmt.Errorf("get menu by path: %w", err)
	}
	return menu, nil
}

// HasMenuChildren 是否存在子菜单(删除守卫)。
func HasMenuChildren(ctx context.Context, db *gorm.DB, id int64) (bool, error) {
	var count int64
	if err := db.WithContext(ctx).Model(&Menu{}).
		Where("parent_id = ?", id).Count(&count).Error; err != nil {
		return false, fmt.Errorf("count menu children: %w", err)
	}
	return count > 0, nil
}

// CreateMenu 新建菜单。
func CreateMenu(ctx context.Context, db *gorm.DB, menu *Menu) error {
	if err := db.WithContext(ctx).Create(menu).Error; err != nil {
		return fmt.Errorf("create menu: %w", err)
	}
	return nil
}

// UpdateMenu 更新菜单。
func UpdateMenu(ctx context.Context, db *gorm.DB, menu *Menu) error {
	if err := db.WithContext(ctx).Save(menu).Error; err != nil {
		return fmt.Errorf("update menu: %w", err)
	}
	return nil
}

// DeleteMenu 删除菜单并联动删除其绑定的菜单权限点(含 role_permissions 引用)。
func DeleteMenu(ctx context.Context, db *gorm.DB, menu Menu) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("permission_id = ?", menu.PermissionID).Delete(&RolePermission{}).Error; err != nil {
			return fmt.Errorf("clear menu permission grants: %w", err)
		}
		if menu.PermissionID != 0 {
			if err := tx.Delete(&Permission{}, menu.PermissionID).Error; err != nil {
				return fmt.Errorf("delete menu permission: %w", err)
			}
		}
		if err := tx.Delete(&Menu{}, menu.ID).Error; err != nil {
			return fmt.Errorf("delete menu: %w", err)
		}
		return nil
	})
}

// GetPermissionCode 权限点编码(菜单权限联动用)。
func GetPermissionCode(ctx context.Context, db *gorm.DB, id int64) (string, error) {
	if id == 0 {
		return "", nil
	}
	var permission Permission
	err := db.WithContext(ctx).First(&permission, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("get permission code: %w", err)
	}
	return permission.Code, nil
}
