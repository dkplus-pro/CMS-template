package service

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/cms-template/server/internal/repo"
	"github.com/cms-template/server/internal/types"
)

// 日志/配置/字典模块业务错误。
var (
	ErrInvalidConfigGroup = errors.New("invalid config group")
	ErrDictCodeExists     = errors.New("dict code exists")
	ErrDictValueExists    = errors.New("dict value exists")
)

// LogService 操作日志查询(只读)。
type LogService struct {
	db *gorm.DB
}

// NewLogService 装配 LogService。
func NewLogService(db *gorm.DB) *LogService {
	return &LogService{db: db}
}

// List 操作日志分页。
func (s *LogService) List(
	ctx context.Context,
	page, pageSize int,
	username string,
	ok *bool,
	startTime, endTime *time.Time,
) ([]types.OperationLogItem, int64, error) {
	logs, total, err := repo.ListOperationLogs(ctx, s.db, page, pageSize, username, ok, startTime, endTime)
	if err != nil {
		return nil, 0, err
	}

	items := make([]types.OperationLogItem, 0, len(logs))
	for _, log := range logs {
		items = append(items, types.OperationLogItem{
			ID: log.ID, UserID: log.UserID, Username: log.Username,
			Method: log.Method, Path: log.Path, Action: log.Action,
			OK: log.OK, StatusCode: log.StatusCode, Message: log.Message,
			IP: log.IP, LatencyMS: log.LatencyMS, CreatedAt: log.CreatedAt,
		})
	}
	return items, total, nil
}

// ConfigService 系统配置业务。
type ConfigService struct {
	db *gorm.DB
}

// NewConfigService 装配 ConfigService。
func NewConfigService(db *gorm.DB) *ConfigService {
	return &ConfigService{db: db}
}

// ConfigGroups 合法配置组;新增配置组时在此登记。
var ConfigGroups = []string{"system", "storage"}

// ValidConfigGroup 校验配置组合法性。
func ValidConfigGroup(group string) bool {
	for _, g := range ConfigGroups {
		if g == group {
			return true
		}
	}
	return false
}

// Get 读取配置组。
func (s *ConfigService) Get(ctx context.Context, group string) ([]types.ConfigItem, error) {
	if !ValidConfigGroup(group) {
		return nil, ErrInvalidConfigGroup
	}
	configs, err := repo.ListConfigsByGroup(ctx, s.db, group)
	if err != nil {
		return nil, err
	}
	items := make([]types.ConfigItem, 0, len(configs))
	for _, cfg := range configs {
		items = append(items, types.ConfigItem{Key: cfg.Key, Value: cfg.Value, Remark: cfg.Remark})
	}
	return items, nil
}

// Replace 整组更新配置。
func (s *ConfigService) Replace(ctx context.Context, group string, items []types.ConfigItem, operatorID int64) error {
	if !ValidConfigGroup(group) {
		return ErrInvalidConfigGroup
	}
	configs := make([]repo.SysConfig, 0, len(items))
	for _, item := range items {
		configs = append(configs, repo.SysConfig{Key: item.Key, Value: item.Value, Remark: item.Remark})
	}
	return repo.ReplaceConfigs(ctx, s.db, group, configs, operatorID)
}

// DictService 字典管理业务。
type DictService struct {
	db *gorm.DB
}

// NewDictService 装配 DictService。
func NewDictService(db *gorm.DB) *DictService {
	return &DictService{db: db}
}

// List 字典列表。
func (s *DictService) List(ctx context.Context, keyword string) ([]types.Dict, error) {
	dicts, err := repo.ListDicts(ctx, s.db, keyword)
	if err != nil {
		return nil, err
	}
	items := make([]types.Dict, 0, len(dicts))
	for _, dict := range dicts {
		items = append(items, types.Dict{
			ID: dict.ID, Code: dict.Code, Name: dict.Name, Remark: dict.Remark, Status: dict.Status,
		})
	}
	return items, nil
}

// Create 新建字典;code 唯一。
func (s *DictService) Create(ctx context.Context, code, name, remark string, status bool) (types.Dict, error) {
	if _, err := repo.GetDictByCode(ctx, s.db, code); err == nil {
		return types.Dict{}, ErrDictCodeExists
	} else if !errors.Is(err, repo.ErrDictNotFound) {
		return types.Dict{}, err
	}
	dict := repo.Dict{Code: code, Name: name, Remark: remark, Status: status}
	if err := repo.CreateDict(ctx, s.db, &dict); err != nil {
		return types.Dict{}, err
	}
	return types.Dict{ID: dict.ID, Code: dict.Code, Name: dict.Name, Remark: dict.Remark, Status: dict.Status}, nil
}

// Update 编辑字典;code 唯一。
func (s *DictService) Update(ctx context.Context, id int64, code, name, remark string, status bool) (types.Dict, error) {
	dict, err := repo.GetDictByID(ctx, s.db, id)
	if err != nil {
		return types.Dict{}, err
	}
	if conflict, err := repo.GetDictByCode(ctx, s.db, code); err == nil && conflict.ID != id {
		return types.Dict{}, ErrDictCodeExists
	} else if err != nil && !errors.Is(err, repo.ErrDictNotFound) {
		return types.Dict{}, err
	}
	dict.Code, dict.Name, dict.Remark, dict.Status = code, name, remark, status
	if err := repo.UpdateDict(ctx, s.db, &dict); err != nil {
		return types.Dict{}, err
	}
	return types.Dict{ID: dict.ID, Code: dict.Code, Name: dict.Name, Remark: dict.Remark, Status: dict.Status}, nil
}

// Delete 删除字典(级联字典项)。
func (s *DictService) Delete(ctx context.Context, id int64) error {
	if _, err := repo.GetDictByID(ctx, s.db, id); err != nil {
		return err
	}
	return repo.DeleteDict(ctx, s.db, id)
}

// ListEntries 字典项列表(按字典编码)。
func (s *DictService) ListEntries(ctx context.Context, code string) ([]types.DictEntry, error) {
	dict, err := repo.GetDictByCode(ctx, s.db, code)
	if err != nil {
		return nil, err
	}
	entries, err := repo.ListDictEntriesByDictID(ctx, s.db, dict.ID)
	if err != nil {
		return nil, err
	}
	items := make([]types.DictEntry, 0, len(entries))
	for _, entry := range entries {
		items = append(items, toEntryItem(entry))
	}
	return items, nil
}

// CreateEntry 新建字典项;同字典内 value 唯一。
func (s *DictService) CreateEntry(ctx context.Context, code, label, value string, sort int, status bool) (types.DictEntry, error) {
	dict, err := repo.GetDictByCode(ctx, s.db, code)
	if err != nil {
		return types.DictEntry{}, err
	}
	if exists, err := repo.HasDictEntryValue(ctx, s.db, dict.ID, value, 0); err != nil {
		return types.DictEntry{}, err
	} else if exists {
		return types.DictEntry{}, ErrDictValueExists
	}
	entry := repo.DictEntry{DictID: dict.ID, Label: label, Value: value, Sort: sort, Status: status}
	if err := repo.CreateDictEntry(ctx, s.db, &entry); err != nil {
		return types.DictEntry{}, err
	}
	return toEntryItem(entry), nil
}

// UpdateEntry 编辑字典项;同字典内 value 唯一。
func (s *DictService) UpdateEntry(ctx context.Context, id int64, label, value string, sort int, status bool) (types.DictEntry, error) {
	entry, err := repo.GetDictEntryByID(ctx, s.db, id)
	if err != nil {
		return types.DictEntry{}, err
	}
	if exists, err := repo.HasDictEntryValue(ctx, s.db, entry.DictID, value, id); err != nil {
		return types.DictEntry{}, err
	} else if exists {
		return types.DictEntry{}, ErrDictValueExists
	}
	entry.Label, entry.Value, entry.Sort, entry.Status = label, value, sort, status
	if err := repo.UpdateDictEntry(ctx, s.db, &entry); err != nil {
		return types.DictEntry{}, err
	}
	return toEntryItem(entry), nil
}

// DeleteEntry 删除字典项。
func (s *DictService) DeleteEntry(ctx context.Context, id int64) error {
	if _, err := repo.GetDictEntryByID(ctx, s.db, id); err != nil {
		return err
	}
	return repo.DeleteDictEntry(ctx, s.db, id)
}

func toEntryItem(entry repo.DictEntry) types.DictEntry {
	return types.DictEntry{
		ID: entry.ID, DictID: entry.DictID, Label: entry.Label,
		Value: entry.Value, Sort: entry.Sort, Status: entry.Status,
	}
}
