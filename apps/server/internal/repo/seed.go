package repo

import (
	"context"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	"gorm.io/gorm"
)

// 初始超级管理员账号(本地与 e2e 默认口令,首次登录后应修改)。
const (
	SeedAdminUsername = "admin"
	SeedAdminPassword = "admin123"
)

// SeedAdmin 幂等种子:users 表为空时创建初始管理员;可重复执行。
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
	}
	if err := db.WithContext(ctx).Create(&admin).Error; err != nil {
		return fmt.Errorf("create seed admin: %w", err)
	}
	return nil
}
