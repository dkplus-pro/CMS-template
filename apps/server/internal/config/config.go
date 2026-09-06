// Package config 从环境变量加载服务配置,全部字段提供默认值,便于本地零配置启动。
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config 服务运行所需的全量配置。
type Config struct {
	HTTP      HTTPConfig
	Database  DatabaseConfig
	Swagger   SwaggerConfig
	JWT       JWTConfig
	AccessLog AccessLogConfig
}

// AccessLogConfig HTTP 访问日志文件配置(不入库,见 docs/database.md)。
type AccessLogConfig struct {
	Dir        string
	RetainDays int
}

// HTTPConfig HTTP 监听配置。
type HTTPConfig struct {
	// Addr 形如 ":8080"。
	Addr string
}

// DatabaseConfig 数据库配置,dev 默认 SQLite,生产切 MySQL(见 docs/database.md)。
type DatabaseConfig struct {
	// Driver 支持 "sqlite" / "mysql"。
	Driver string
	// DSN sqlite 为文件路径,mysql 为标准 DSN。
	DSN string
}

// SwaggerConfig Swagger UI 托管配置。
type SwaggerConfig struct {
	Enabled  bool
	SpecPath string
}

// JWTConfig 认证配置(见 docs/mvp-plan.md 认证约定)。
type JWTConfig struct {
	Secret string
	TTL    time.Duration
}

// Load 读取环境变量并应用默认值,非法值直接报错,避免带病启动。
func Load() (Config, error) {
	cfg := Config{
		HTTP: HTTPConfig{
			Addr: ":" + envOr("SERVER_PORT", "8080"),
		},
		Database: DatabaseConfig{
			Driver: envOr("DATABASE_DRIVER", "sqlite"),
			DSN:    envOr("DATABASE_DSN", "data/cms.db"),
		},
		Swagger: SwaggerConfig{
			Enabled:  envBool("SWAGGER_ENABLED", true),
			SpecPath: envOr("SWAGGER_SPEC_PATH", "../../openapi.yaml"),
		},
		JWT: JWTConfig{
			Secret: envOr("JWT_SECRET", "dev-secret-change-me"),
			TTL:    time.Duration(envInt("JWT_TTL_HOURS", 2)) * time.Hour,
		},
		AccessLog: AccessLogConfig{
			Dir:        envOr("ACCESS_LOG_DIR", "logs"),
			RetainDays: envInt("ACCESS_LOG_RETAIN_DAYS", 7),
		},
	}

	switch cfg.Database.Driver {
	case "sqlite", "mysql":
	default:
		return Config{}, fmt.Errorf("unsupported DATABASE_DRIVER %q (want sqlite or mysql)", cfg.Database.Driver)
	}

	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return v
}

func envInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}
