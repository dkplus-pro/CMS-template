// main 只做装配:读配置 → 连数据库 → 挂路由与中间件 → 启动监听。
// 业务逻辑在 internal/handler 与 internal/service,不要在这里堆业务代码。
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	gen "github.com/cms-template/server/gen"
	"github.com/cms-template/server/internal/config"
	"github.com/cms-template/server/internal/handler"
	"github.com/cms-template/server/internal/httpapi"
	"github.com/cms-template/server/internal/repo"
	"github.com/cms-template/server/internal/service"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "error", err)
		os.Exit(1)
	}

	ctx := context.Background()

	db, err := repo.Open(cfg.Database)
	if err != nil {
		logger.Error("open database", "error", err)
		os.Exit(1)
	}
	if err := repo.AutoMigrate(db); err != nil {
		logger.Error("auto migrate", "error", err)
		os.Exit(1)
	}
	if err := repo.SeedAdmin(ctx, db); err != nil {
		logger.Error("seed admin", "error", err)
		os.Exit(1)
	}

	authService := service.NewAuthService(db, cfg.JWT.Secret, cfg.JWT.TTL)

	mux := http.NewServeMux()
	httpapi.RegisterSwagger(mux, logger, cfg.Swagger)
	gen.HandlerFromMux(handler.New(logger, authService), mux)

	jwtSkip := httpapi.JWTSkipPaths("/healthz", "/swagger", "/swagger/", "/auth/login")
	operationLog := httpapi.OperationLog(func(ctx context.Context, entry httpapi.OperationLogEntry) {
		if err := repo.CreateOperationLog(ctx, db, repo.OperationLogEntry{
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
		}); err != nil {
			logger.Error("write operation log", "error", err)
		}
	})

	srv := &http.Server{
		Addr: cfg.HTTP.Addr,
		Handler: httpapi.Chain(
			mux,
			httpapi.Logging(logger),
			httpapi.JWTAuth(logger, cfg.JWT.Secret, jwtSkip),
			operationLog,
			httpapi.Recover(logger),
		),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("server listening", "addr", cfg.HTTP.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("listen and serve", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown", "error", err)
	}
}
