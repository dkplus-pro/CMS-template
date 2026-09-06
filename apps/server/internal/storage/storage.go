// Package storage 文件存储抽象:底层 files 表的上游,屏蔽本地目录与对象存储的差异。
// local 为 MVP 实现,S3 为预留位(见 docs/mvp-plan.md 阶段 5 修订)。
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
)

// ErrInvalidName 存储名非法(防目录穿越)。
var ErrInvalidName = errors.New("invalid storage name")

var safeName = regexp.MustCompile(`^[a-f0-9-]{36}(\.[a-z0-9]{1,8})?$`)

// Storage 文件存储接口。
type Storage interface {
	// Save 写入文件内容,返回生成的存储名(uuid + 扩展名)与字节数。
	Save(ctx context.Context, r io.Reader, ext string) (name string, size int64, err error)
	// Open 打开指定存储名的文件。
	Open(ctx context.Context, name string) (*os.File, error)
	// Delete 删除介质文件;文件不存在视为已删除(幂等)。
	Delete(ctx context.Context, name string) error
}

// Local 本地目录存储;目录来自 storage 配置组的 basePath。
type Local struct {
	basePath string
}

// NewLocal 构造本地存储并确保目录存在。
func NewLocal(basePath string) (*Local, error) {
	if err := os.MkdirAll(basePath, 0o755); err != nil {
		return nil, fmt.Errorf("create storage dir: %w", err)
	}
	return &Local{basePath: basePath}, nil
}

// Save 写入文件。
func (l *Local) Save(_ context.Context, r io.Reader, ext string) (string, int64, error) {
	name, err := newName(ext)
	if err != nil {
		return "", 0, err
	}
	path := filepath.Join(l.basePath, name)
	file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		return "", 0, fmt.Errorf("create storage file: %w", err)
	}
	defer file.Close()

	size, err := io.Copy(file, r)
	if err != nil {
		_ = os.Remove(path) // 写一半失败不留半截文件
		return "", 0, fmt.Errorf("write storage file: %w", err)
	}
	return name, size, nil
}

// Open 打开文件。
func (l *Local) Open(_ context.Context, name string) (*os.File, error) {
	if !safeName.MatchString(name) {
		return nil, ErrInvalidName
	}
	file, err := os.Open(filepath.Join(l.basePath, name))
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("%w: %s", os.ErrNotExist, name)
	}
	return file, err
}

// Delete 删除文件;不存在视为成功。
func (l *Local) Delete(_ context.Context, name string) error {
	if !safeName.MatchString(name) {
		return ErrInvalidName
	}
	if err := os.Remove(filepath.Join(l.basePath, name)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete storage file: %w", err)
	}
	return nil
}

func newName(ext string) (string, error) {
	id, err := newUUID()
	if err != nil {
		return "", err
	}
	name := id
	if ext != "" {
		name += "." + ext
	}
	if !safeName.MatchString(name) {
		return "", ErrInvalidName
	}
	return name, nil
}
