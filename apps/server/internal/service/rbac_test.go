package service

import (
	"context"
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"github.com/cms-template/server/internal/repo"
)

func newRBACService(t *testing.T) (*UserService, *RoleService, *PermissionService) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := repo.AutoMigrate(db); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	ctx := context.Background()
	if err := repo.SeedAdmin(ctx, db); err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	seeds := []repo.ApiPermissionSeed{
		{Code: "system:user:create", Name: "创建用户", ParentMenuCode: "menu:system:user", ParentMenuName: "用户管理"},
		{Code: "system:user:list", Name: "用户列表", ParentMenuCode: "menu:system:user", ParentMenuName: "用户管理"},
	}
	if err := repo.UpsertApiPermissions(ctx, db, seeds); err != nil {
		t.Fatalf("upsert permissions: %v", err)
	}
	if err := repo.SeedSuperAdminRole(ctx, db); err != nil {
		t.Fatalf("seed super admin role: %v", err)
	}
	return NewUserService(db), NewRoleService(db), NewPermissionService(db)
}

func TestUserGuards(t *testing.T) {
	users, _, _ := newRBACService(t)
	ctx := context.Background()

	admin, total, err := users.List(ctx, 1, 20, "", nil)
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected 1 seeded user, got %d", total)
	}
	adminID := admin[0].ID
	if !admin[0].IsBuiltin {
		t.Fatal("seeded admin should be builtin")
	}

	// 不可操作自己
	if err := users.Delete(ctx, adminID, adminID); !errors.Is(err, ErrSelfOperation) {
		t.Fatalf("expected ErrSelfOperation, got %v", err)
	}
	if err := users.UpdateStatus(ctx, adminID, adminID, false); !errors.Is(err, ErrSelfOperation) {
		t.Fatalf("expected ErrSelfOperation, got %v", err)
	}
	// 内置管理员不可删/禁
	if err := users.Delete(ctx, 999, adminID); !errors.Is(err, ErrBuiltinUser) {
		t.Fatalf("expected ErrBuiltinUser, got %v", err)
	}
	if err := users.UpdateStatus(ctx, 999, adminID, false); !errors.Is(err, ErrBuiltinUser) {
		t.Fatalf("expected ErrBuiltinUser, got %v", err)
	}

	// 用户名唯一
	if _, err := users.Create(ctx, "admin", "secret-1", "dup", "", true, nil); !errors.Is(err, ErrUsernameExists) {
		t.Fatalf("expected ErrUsernameExists, got %v", err)
	}

	created, err := users.Create(ctx, "alice", "secret-1", "Alice", "a@x.io", true, nil)
	if err != nil {
		t.Fatalf("create alice: %v", err)
	}
	if created.IsBuiltin {
		t.Fatal("new user should not be builtin")
	}
	// 正常禁用/删除
	if err := users.UpdateStatus(ctx, adminID, created.ID, false); err != nil {
		t.Fatalf("disable alice: %v", err)
	}
	if err := users.Delete(ctx, adminID, created.ID); err != nil {
		t.Fatalf("delete alice: %v", err)
	}
}

func TestRoleGuards(t *testing.T) {
	users, roles, _ := newRBACService(t)
	ctx := context.Background()

	adminList, _, err := users.List(ctx, 1, 20, "", nil)
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	adminID := adminList[0].ID

	role, err := roles.Create(ctx, "ops", "运维", "演示角色", true)
	if err != nil {
		t.Fatalf("create role: %v", err)
	}
	if _, err := roles.Create(ctx, "ops", "重复编码", "", true); !errors.Is(err, ErrRoleCodeExists) {
		t.Fatalf("expected ErrRoleCodeExists, got %v", err)
	}

	// 内置角色:编码不可改、不可删(先造一个再标记内置)
	builtin, err := roles.Create(ctx, "builtin_test", "内置测试角色", "", true)
	if err != nil {
		t.Fatalf("create builtin role: %v", err)
	}
	if err := roles.db.Model(&repo.Role{}).Where("id = ?", builtin.ID).Update("is_builtin", true).Error; err != nil {
		t.Fatalf("mark builtin: %v", err)
	}
	if _, err := roles.Update(ctx, builtin.ID, "changed", "超级管理员", "", true); !errors.Is(err, ErrBuiltinRole) {
		t.Fatalf("expected ErrBuiltinRole, got %v", err)
	}
	if err := roles.Delete(ctx, builtin.ID); !errors.Is(err, ErrBuiltinRole) {
		t.Fatalf("expected ErrBuiltinRole, got %v", err)
	}

	// 有用户绑定的角色不可删
	if err := users.UpdateRoles(ctx, adminID, []int64{role.ID}); err != nil {
		t.Fatalf("assign role: %v", err)
	}
	if err := roles.Delete(ctx, role.ID); !errors.Is(err, ErrRoleInUse) {
		t.Fatalf("expected ErrRoleInUse, got %v", err)
	}

	// 解绑后可删
	if err := users.UpdateRoles(ctx, adminID, nil); err != nil {
		t.Fatalf("clear user roles: %v", err)
	}
	if err := roles.Delete(ctx, role.ID); err != nil {
		t.Fatalf("delete role: %v", err)
	}
}

func TestRolePermissions(t *testing.T) {
	users, roles, permissions := newRBACService(t)
	ctx := context.Background()

	adminList, _, err := users.List(ctx, 1, 20, "", nil)
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	adminID := adminList[0].ID

	role, err := roles.Create(ctx, "ops", "运维", "", true)
	if err != nil {
		t.Fatalf("create role: %v", err)
	}

	tree, err := permissions.Tree(ctx)
	if err != nil {
		t.Fatalf("permission tree: %v", err)
	}
	if len(tree) != 1 {
		t.Fatalf("expected 1 root (menu node), got %d", len(tree))
	}
	if tree[0].Code != "menu:system:user" || len(tree[0].Children) != 2 {
		t.Fatalf("unexpected tree: %+v", tree)
	}

	permIDs := []int64{tree[0].ID, tree[0].Children[0].ID}
	if err := roles.UpdatePermissions(ctx, role.ID, permIDs); err != nil {
		t.Fatalf("assign permissions: %v", err)
	}
	detail, err := roles.Get(ctx, role.ID)
	if err != nil {
		t.Fatalf("get role: %v", err)
	}
	if len(detail.PermissionIds) != 2 {
		t.Fatalf("expected 2 permission ids, got %v", detail.PermissionIds)
	}

	// 不存在的权限点被拒绝
	if err := roles.UpdatePermissions(ctx, role.ID, []int64{99999}); !errors.Is(err, ErrPermissionInvalid) {
		t.Fatalf("expected ErrPermissionInvalid, got %v", err)
	}

	// 角色授权后,用户权限码随之生效
	if err := users.UpdateRoles(ctx, adminID, []int64{role.ID}); err != nil {
		t.Fatalf("assign role to user: %v", err)
	}
	codes, err := users.PermissionCodes(ctx, adminID)
	if err != nil {
		t.Fatalf("permission codes: %v", err)
	}
	if len(codes) != 2 {
		t.Fatalf("expected 2 permission codes, got %v", codes)
	}
}
