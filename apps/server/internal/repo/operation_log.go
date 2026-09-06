package repo

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// OperationLogEntry 操作日志写入载荷(与 internal/httpapi 的采集中间件对应)。
type OperationLogEntry struct {
	UserID     int64
	Username   string
	Method     string
	Path       string
	Action     string
	OK         bool
	StatusCode int
	Message    string
	IP         string
	LatencyMS  int64
}

// CreateOperationLog 写一条操作日志;只增不改。
func CreateOperationLog(ctx context.Context, db *gorm.DB, entry OperationLogEntry) error {
	log := OperationLog{
		UserID:     entry.UserID,
		Username:   entry.Username,
		Method:     entry.Method,
		Path:       entry.Path,
		Action:     entry.Action,
		OK:         entry.OK,
		StatusCode: entry.StatusCode,
		Message:    entry.Message,
		IP:         entry.IP,
		LatencyMS:  entry.LatencyMS,
		CreatedAt:  time.Now(),
	}
	if err := db.WithContext(ctx).Create(&log).Error; err != nil {
		return fmt.Errorf("create operation log: %w", err)
	}
	return nil
}
