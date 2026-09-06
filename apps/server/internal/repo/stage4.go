package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrDictNotFound 字典不存在。
var ErrDictNotFound = errors.New("dict not found")

// ErrDictEntryNotFound 字典项不存在。
var ErrDictEntryNotFound = errors.New("dict entry not found")

// ===== 操作日志查询(只读,业务日志;方案见 docs/mvp-plan.md 阶段 4 修订) =====

// ListOperationLogs 业务日志分页:username 模糊、resource/action 精确、status 精确、时间范围。
func ListOperationLogs(
	ctx context.Context,
	db *gorm.DB,
	page, pageSize int,
	username, resource, action string,
	status *string,
	startTime, endTime *time.Time,
) ([]OperationLog, int64, error) {
	query := db.WithContext(ctx).Model(&OperationLog{})
	if username != "" {
		query = query.Where("username LIKE ?", "%"+username+"%")
	}
	if resource != "" {
		query = query.Where("resource = ?", resource)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if status != nil {
		query = query.Where("status = ?", *status)
	}
	if startTime != nil {
		query = query.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("created_at < ?", endTime.Add(time.Millisecond))
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count operation logs: %w", err)
	}

	var logs []OperationLog
	if err := query.Order("id DESC").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("list operation logs: %w", err)
	}
	return logs, total, nil
}

// ===== 系统配置 =====

// ListConfigsByGroup 配置组键值列表(按 key 排序)。
func ListConfigsByGroup(ctx context.Context, db *gorm.DB, group string) ([]SysConfig, error) {
	var configs []SysConfig
	if err := db.WithContext(ctx).Where("`group` = ?", group).
		Order("key ASC").Find(&configs).Error; err != nil {
		return nil, fmt.Errorf("list configs by group: %w", err)
	}
	return configs, nil
}

// ReplaceConfigs 整组覆盖配置:删除该组不再存在的 key,其余 upsert。
func ReplaceConfigs(ctx context.Context, db *gorm.DB, group string, items []SysConfig, updatedBy int64) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		keepKeys := make([]string, 0, len(items))
		for _, item := range items {
			keepKeys = append(keepKeys, item.Key)
			cfg := SysConfig{Group: group, Key: item.Key, Value: item.Value, Remark: item.Remark, UpdatedBy: updatedBy}
			if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{
				{Name: "group"}, {Name: "key"},
			}, DoUpdates: clause.AssignmentColumns([]string{"value", "remark", "updated_by", "updated_at"})}).
					Create(&cfg).Error; err != nil {
				return fmt.Errorf("upsert config %s: %w", item.Key, err)
			}
		}
		delQuery := tx.Where("`group` = ?", group)
		if len(keepKeys) > 0 {
			delQuery = delQuery.Where("key NOT IN ?", keepKeys)
		}
		if err := delQuery.Delete(&SysConfig{}).Error; err != nil {
			return fmt.Errorf("delete removed configs: %w", err)
		}
		return nil
	})
}

// GetConfigValue 读单个配置值(种子与业务消费用)。
func GetConfigValue(ctx context.Context, db *gorm.DB, group, key string) (string, error) {
	var cfg SysConfig
	err := db.WithContext(ctx).Where("`group` = ? AND `key` = ?", group, key).First(&cfg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("get config %s.%s: %w", group, key, err)
	}
	return cfg.Value, nil
}

// ===== 字典 =====

// ListDicts 字典全量列表,keyword 模糊匹配 code/name。
func ListDicts(ctx context.Context, db *gorm.DB, keyword string) ([]Dict, error) {
	query := db.WithContext(ctx).Model(&Dict{})
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("code LIKE ? OR name LIKE ?", like, like)
	}
	var dicts []Dict
	if err := query.Order("id ASC").Find(&dicts).Error; err != nil {
		return nil, fmt.Errorf("list dicts: %w", err)
	}
	return dicts, nil
}

// GetDictByID 按主键查字典。
func GetDictByID(ctx context.Context, db *gorm.DB, id int64) (Dict, error) {
	var dict Dict
	err := db.WithContext(ctx).First(&dict, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Dict{}, ErrDictNotFound
	}
	if err != nil {
		return Dict{}, fmt.Errorf("get dict by id: %w", err)
	}
	return dict, nil
}

// GetDictByCode 按编码查字典。
func GetDictByCode(ctx context.Context, db *gorm.DB, code string) (Dict, error) {
	var dict Dict
	err := db.WithContext(ctx).Where("code = ?", code).First(&dict).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Dict{}, ErrDictNotFound
	}
	if err != nil {
		return Dict{}, fmt.Errorf("get dict by code: %w", err)
	}
	return dict, nil
}

// CreateDict 新建字典。
func CreateDict(ctx context.Context, db *gorm.DB, dict *Dict) error {
	if err := db.WithContext(ctx).Create(dict).Error; err != nil {
		return fmt.Errorf("create dict: %w", err)
	}
	return nil
}

// UpdateDict 更新字典。
func UpdateDict(ctx context.Context, db *gorm.DB, dict *Dict) error {
	if err := db.WithContext(ctx).Save(dict).Error; err != nil {
		return fmt.Errorf("update dict: %w", err)
	}
	return nil
}

// DeleteDict 删除字典并级联删除字典项。
func DeleteDict(ctx context.Context, db *gorm.DB, dictID int64) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("dict_id = ?", dictID).Delete(&DictEntry{}).Error; err != nil {
			return fmt.Errorf("delete dict entries: %w", err)
		}
		if err := tx.Delete(&Dict{}, dictID).Error; err != nil {
			return fmt.Errorf("delete dict: %w", err)
		}
		return nil
	})
}

// ListDictEntriesByDictID 字典项列表(按 sort、id 排序)。
func ListDictEntriesByDictID(ctx context.Context, db *gorm.DB, dictID int64) ([]DictEntry, error) {
	var entries []DictEntry
	if err := db.WithContext(ctx).Where("dict_id = ?", dictID).
		Order("sort ASC, id ASC").Find(&entries).Error; err != nil {
		return nil, fmt.Errorf("list dict entries: %w", err)
	}
	return entries, nil
}

// GetDictEntryByID 按主键查字典项。
func GetDictEntryByID(ctx context.Context, db *gorm.DB, id int64) (DictEntry, error) {
	var entry DictEntry
	err := db.WithContext(ctx).First(&entry, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return DictEntry{}, ErrDictEntryNotFound
	}
	if err != nil {
		return DictEntry{}, fmt.Errorf("get dict entry by id: %w", err)
	}
	return entry, nil
}

// HasDictEntryValue 同字典内是否存在相同 value(唯一守卫;excludeID 用于更新场景)。
func HasDictEntryValue(ctx context.Context, db *gorm.DB, dictID int64, value string, excludeID int64) (bool, error) {
	var count int64
	query := db.WithContext(ctx).Model(&DictEntry{}).
		Where("dict_id = ? AND value = ?", dictID, value)
	if excludeID != 0 {
		query = query.Where("id != ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, fmt.Errorf("count dict entry value: %w", err)
	}
	return count > 0, nil
}

// CreateDictEntry 新建字典项。
func CreateDictEntry(ctx context.Context, db *gorm.DB, entry *DictEntry) error {
	if err := db.WithContext(ctx).Create(entry).Error; err != nil {
		return fmt.Errorf("create dict entry: %w", err)
	}
	return nil
}

// UpdateDictEntry 更新字典项。
func UpdateDictEntry(ctx context.Context, db *gorm.DB, entry *DictEntry) error {
	if err := db.WithContext(ctx).Save(entry).Error; err != nil {
		return fmt.Errorf("update dict entry: %w", err)
	}
	return nil
}

// DeleteDictEntry 删除字典项。
func DeleteDictEntry(ctx context.Context, db *gorm.DB, id int64) error {
	if err := db.WithContext(ctx).Delete(&DictEntry{}, id).Error; err != nil {
		return fmt.Errorf("delete dict entry: %w", err)
	}
	return nil
}
