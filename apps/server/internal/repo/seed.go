package repo

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	"gorm.io/gorm"
)

// 初始超级管理员账号与角色(本地与 e2e 默认口令,首次登录后应修改)。
const (
	SeedAdminUsername      = "admin"
	SeedAdminPassword      = "admin123"
	SeedSuperAdminRoleCode = "super_admin"
	SeedSuperAdminRoleName = "超级管理员"
)

// SeedAdmin 幂等种子:users 表为空时创建初始内置管理员;可重复执行。
func SeedAdmin(ctx context.Context, db *gorm.DB) error {
	var count int64
	if err := db.WithContext(ctx).Model(&User{}).Count(&count).Error; err != nil {
		return fmt.Errorf("count users: %w", err)
	}
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(SeedAdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash seed password: %w", err)
	}

	admin := User{
		Username:     SeedAdminUsername,
		PasswordHash: string(hash),
		Nickname:     "管理员",
		Status:       true,
		IsBuiltin:    true,
	}
	if err := db.WithContext(ctx).Create(&admin).Error; err != nil {
		return fmt.Errorf("create seed admin: %w", err)
	}
	return nil
}

// SeedSuperAdminRole 幂等种子:确保内置超级管理员角色存在、拥有全量权限点、并绑定初始管理员。
// 必须在 UpsertApiPermissions 之后调用,保证新注册的权限点也被授予超级管理员。
func SeedSuperAdminRole(ctx context.Context, db *gorm.DB) error {
	var role Role
	err := db.WithContext(ctx).Where("code = ?", SeedSuperAdminRoleCode).First(&role).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		role = Role{Code: SeedSuperAdminRoleCode, Name: SeedSuperAdminRoleName, Status: true, IsBuiltin: true}
		if err := db.WithContext(ctx).Create(&role).Error; err != nil {
			return fmt.Errorf("create super admin role: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("get super admin role: %w", err)
	}

	if !role.IsBuiltin || !role.Status {
		if err := db.WithContext(ctx).Model(&Role{}).Where("id = ?", role.ID).
			Updates(map[string]any{"is_builtin": true, "status": true}).Error; err != nil {
			return fmt.Errorf("repair super admin role: %w", err)
		}
	}

	var permissionIDs []int64
	if err := db.WithContext(ctx).Model(&Permission{}).Pluck("id", &permissionIDs).Error; err != nil {
		return fmt.Errorf("list all permission ids: %w", err)
	}
	if err := ReplaceRolePermissions(ctx, db, role.ID, permissionIDs); err != nil {
		return err
	}

	admin, err := GetUserByUsername(ctx, db, SeedAdminUsername)
	if err != nil {
		return fmt.Errorf("get seed admin: %w", err)
	}
	return ReplaceUserRoles(ctx, db, admin.ID, []int64{role.ID})
}

// SeedMenus 幂等种子:按 path 判重,灌入初始菜单树。
// 用户管理/角色管理/菜单管理绑定注册表创建的 menu 权限点,欢迎页与目录不绑定(登录可见)。
func SeedMenus(ctx context.Context, db *gorm.DB) error {
	type menuSeed struct {
		parentPath     string
		name, path     string
		componentKey   string
		permissionCode string
		sort           int
	}
	seeds := []menuSeed{
		{parentPath: "", name: "欢迎页", path: "/", componentKey: "welcome", sort: 0},
		{parentPath: "", name: "系统管理", path: "/system", componentKey: "", sort: 100},
		{parentPath: "/system", name: "用户管理", path: "/system/users", componentKey: "system/users", permissionCode: "menu:system:user", sort: 1},
		{parentPath: "/system", name: "角色管理", path: "/system/roles", componentKey: "system/roles", permissionCode: "menu:system:role", sort: 2},
		{parentPath: "/system", name: "菜单管理", path: "/system/menus", componentKey: "system/menus", permissionCode: "menu:system:menu", sort: 3},
	}

	for _, seed := range seeds {
		if _, err := GetMenuByPath(ctx, db, seed.path); err == nil {
			continue
		} else if !errors.Is(err, ErrMenuNotFound) {
			return fmt.Errorf("check menu %s: %w", seed.path, err)
		}

		parentID := int64(0)
		if seed.parentPath != "" {
			parent, err := GetMenuByPath(ctx, db, seed.parentPath)
			if err != nil {
				return fmt.Errorf("get parent menu %s: %w", seed.parentPath, err)
			}
			parentID = parent.ID
		}

		permissionID := int64(0)
		if seed.permissionCode != "" {
			pid, err := UpsertPermission(ctx, db, &Permission{
				Code: seed.permissionCode, Name: seed.name, Type: "menu",
			})
			if err != nil {
				return err
			}
			permissionID = pid
		}

		menu := Menu{
			ParentID:     parentID,
			Name:         seed.name,
			Path:         seed.path,
			ComponentKey: seed.componentKey,
			PermissionID: permissionID,
			Sort:         seed.sort,
			Visible:      true,
		}
		if err := CreateMenu(ctx, db, &menu); err != nil {
			return err
		}
	}
	return nil
}
