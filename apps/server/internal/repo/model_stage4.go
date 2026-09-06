package repo

// SysConfig 系统配置 KV(group + key 唯一)。
type SysConfig struct {
	ID        int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Group     string `gorm:"size:32;not null;uniqueIndex:uk_config_group_key" json:"group"`
	Key       string `gorm:"size:64;not null;uniqueIndex:uk_config_group_key" json:"key"`
	Value     string `gorm:"type:text" json:"value"`
	Remark    string `gorm:"size:255" json:"remark"`
	UpdatedBy int64  `gorm:"not null;default:0" json:"updatedBy"`
	Timestamps
}

func (SysConfig) TableName() string { return "sys_configs" }

// Dict 字典。
type Dict struct {
	ID     int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Code   string `gorm:"size:64;uniqueIndex;not null" json:"code"`
	Name   string `gorm:"size:64;not null" json:"name"`
	Remark string `gorm:"size:255" json:"remark"`
	Status bool   `gorm:"not null;default:true" json:"status"`
	Timestamps
}

func (Dict) TableName() string { return "dicts" }

// DictEntry 字典项;同字典内 value 唯一。
type DictEntry struct {
	ID     int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	DictID int64  `gorm:"not null;index;uniqueIndex:uk_dict_entry_value" json:"dictId"`
	Label  string `gorm:"size:64;not null" json:"label"`
	Value  string `gorm:"size:64;not null;uniqueIndex:uk_dict_entry_value" json:"value"`
	Sort   int    `gorm:"not null;default:0" json:"sort"`
	Status bool   `gorm:"not null;default:true" json:"status"`
	Timestamps
}

func (DictEntry) TableName() string { return "dict_items" }
