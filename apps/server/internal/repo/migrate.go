package repo

import (
	"fmt"

	"gorm.io/gorm"
)

// AutoMigrate 按声明顺序幂等建表。
// 新增业务模型时在此追加(表结构设计见 docs/database.md);阶段 1 起接入 users 等表。
func AutoMigrate(db *gorm.DB) error {
	models := []any{}

	for _, model := range models {
		if err := db.AutoMigrate(model); err != nil {
			return fmt.Errorf("auto migrate %T: %w", model, err)
		}
	}
	return nil
}
