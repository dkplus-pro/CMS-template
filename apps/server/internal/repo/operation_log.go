package repo

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// OperationLog 业务操作日志,只增不改(方案见 docs/database.md 与 docs/mvp-plan.md 阶段 4 修订)。
// 记录"谁在什么时间对什么对象做了什么、结果如何";由 service 层显式埋点,查询不记。
type OperationLog struct {
	ID          int64     `gorm:"primaryKey;autoIncrement"`
	UserID      int64     `gorm:"not null;default:0;index:idx_oplog_user_time,priority:1"`
	Username    string    `gorm:"size:64"`
	Action      string    `gorm:"size:64;not null"`
	Resource    string    `gorm:"size:64;not null;index:idx_oplog_resource,priority:1"`
	ResourceID  string    `gorm:"size:64;index:idx_oplog_resource,priority:2"`
	Description string    `gorm:"size:255;not null"`
	Status      string    `gorm:"size:16;not null"`
	IP          string    `gorm:"size:45"`
	CreatedAt   time.Time `gorm:"not null;index;index:idx_oplog_user_time,priority:2"`
}

func (OperationLog) TableName() string { return "operation_logs" }

// CreateOperationLog 写一条业务操作日志;只增不改。
func CreateOperationLog(ctx context.Context, db *gorm.DB, log OperationLog) error {
	if err := db.WithContext(ctx).Create(&log).Error; err != nil {
		return fmt.Errorf("create operation log: %w", err)
	}
	return nil
}
