// Package service 承载业务规则:字典与字典项管理。
package service

import (
	"context"

	"errors"

	"gorm.io/gorm"

	"fmt"

	"github.com/cms-template/server/internal/oplog"
	"github.com/cms-template/server/internal/repo"
	"github.com/cms-template/server/internal/types"
)

// 字典模块业务错误。
var (
	ErrDictCodeExists  = errors.New("dict code exists")
	ErrDictValueExists = errors.New("dict value exists")
)

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
	oplog.Success(ctx, s.db, oplog.Entry{
		Action: "dict.create", Resource: "dict", ResourceID: code,
		Description: "创建字典 " + name + "(" + code + ")",
	}, "")
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
	oplog.Success(ctx, s.db, oplog.Entry{
		Action: "dict.update", Resource: "dict", ResourceID: code,
		Description: "更新字典 " + name + "(" + code + ")",
	}, "")
	return types.Dict{ID: dict.ID, Code: dict.Code, Name: dict.Name, Remark: dict.Remark, Status: dict.Status}, nil
}

// Delete 删除字典(级联字典项,记业务日志)。

func (s *DictService) Delete(ctx context.Context, id int64) error {
	dict, err := repo.GetDictByID(ctx, s.db, id)
	if err != nil {
		return err
	}
	if err := repo.DeleteDict(ctx, s.db, id); err != nil {
		return err
	}
	oplog.Success(ctx, s.db, oplog.Entry{
		Action: "dict.delete", Resource: "dict", ResourceID: dict.Code,
		Description: "删除字典 " + dict.Name + "(" + dict.Code + ")",
	}, "")
	return nil
}

// UpdateStatus 字典上下线。
func (s *DictService) UpdateStatus(ctx context.Context, id int64, status bool) error {
	dict, err := repo.GetDictByID(ctx, s.db, id)
	if err != nil {
		return err
	}
	dict.Status = status
	if err := repo.UpdateDict(ctx, s.db, &dict); err != nil {
		return err
	}
	verb := "上线"
	if !status {
		verb = "下线"
	}
	oplog.Success(ctx, s.db, oplog.Entry{
		Action: "dict.updateStatus", Resource: "dict", ResourceID: dict.Code,
		Description: verb + "字典 " + dict.Name + "(" + dict.Code + ")",
	}, "")
	return nil
}

// ReplaceEntries 整组覆写字典项(记业务日志)。
func (s *DictService) ReplaceEntries(ctx context.Context, dictID int64, entries []repo.DictEntry) error {
	dict, err := repo.GetDictByID(ctx, s.db, dictID)
	if err != nil {
		return err
	}
	if err := repo.ReplaceDictEntries(ctx, s.db, dictID, entries); err != nil {
		return err
	}
	oplog.Success(ctx, s.db, oplog.Entry{
		Action: "dict.updateEntries", Resource: "dict", ResourceID: dict.Code,
		Description: fmt.Sprintf("更新字典 %s(%s) 的 %d 个字典项", dict.Name, dict.Code, len(entries)),
	}, "")
	return nil
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
	oplog.Success(ctx, s.db, oplog.Entry{
		Action: "dictEntry.create", Resource: "dictEntry", ResourceID: dict.Code,
		Description: "字典 " + dict.Name + " 新增字典项 " + label + "(" + value + ")",
	}, "")
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
	oplog.Success(ctx, s.db, oplog.Entry{
		Action: "dictEntry.update", Resource: "dictEntry", ResourceID: value,
		Description: "更新字典项 " + label + "(" + value + ")",
	}, "")
	return toEntryItem(entry), nil
}

// DeleteEntry 删除字典项(记业务日志)。

func (s *DictService) DeleteEntry(ctx context.Context, id int64) error {
	entry, err := repo.GetDictEntryByID(ctx, s.db, id)
	if err != nil {
		return err
	}
	if err := repo.DeleteDictEntry(ctx, s.db, id); err != nil {
		return err
	}
	oplog.Success(ctx, s.db, oplog.Entry{
		Action: "dictEntry.delete", Resource: "dictEntry", ResourceID: entry.Value,
		Description: "删除字典项 " + entry.Label + "(" + entry.Value + ")",
	}, "")
	return nil
}

func toEntryItem(entry repo.DictEntry) types.DictEntry {
	return types.DictEntry{
		ID: entry.ID, DictID: entry.DictID, Label: entry.Label,
		Value: entry.Value, Sort: entry.Sort, Status: entry.Status,
	}
}
