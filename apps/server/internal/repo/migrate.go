package repo

import (
	"fmt"

	"gorm.io/gorm"
)

// autoMigrateModels 全部业务模型,启动时幂等建表;新增模型在此追加(见 docs/database.md)。
var autoMigrateModels = []any{
	&User{},
	&Role{},
	&UserRole{},
	&Permission{},
	&RolePermission{},
	&OperationLog{},
	&SysConfig{},
	&Dict{},
	&DictEntry{},
}

// AutoMigrate 按声明顺序幂等建表。
func AutoMigrate(db *gorm.DB) error {
	for _, model := range autoMigrateModels {
		if err := db.AutoMigrate(model); err != nil {
			return fmt.Errorf("auto migrate %T: %w", model, err)
		}
	}
	return nil
}
