// main 只做装配:读配置 → 连数据库 → 挂路由与中间件 → 启动监听。
// 业务逻辑在 internal/handler 与 internal/service,不要在这里堆业务代码。
package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	gen "github.com/cms-template/server/gen/admin"
	appgen "github.com/cms-template/server/gen/app"
	h5gen "github.com/cms-template/server/gen/h5"
	sitegen "github.com/cms-template/server/gen/site"
	"github.com/cms-template/server/internal/config"
	"github.com/cms-template/server/internal/handler"
	apphandler "github.com/cms-template/server/internal/handler/app"
	h5handler "github.com/cms-template/server/internal/handler/h5"
	sitehandler "github.com/cms-template/server/internal/handler/site"
	"github.com/cms-template/server/internal/httpapi"
	"github.com/cms-template/server/internal/media"
	"github.com/cms-template/server/internal/repo"
	"github.com/cms-template/server/internal/service"
	"github.com/cms-template/server/internal/storage"
	"github.com/cms-template/server/internal/uploads"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "load config:", err)
		os.Exit(1)
	}

	// 访问日志双轨:stdout + 按天滚动文件,过期自动清理;业务日志另见 internal/oplog。
	accessLogger, closeAccessLog, err := httpapi.NewAccessLogger(
		cfg.AccessLog.Dir, "server", cfg.AccessLog.RetainDays)
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "init access log:", err)
		os.Exit(1)
	}
	defer closeAccessLog()
	logger := accessLogger

	ctx := context.Background()

	db, err := repo.Open(cfg.Database)
	if err != nil {
		logger.Error("open database", "error", err)
		os.Exit(1)
	}
	if err := repo.AutoMigrate(context.Background(), db); err != nil {
		logger.Error("auto migrate", "error", err)
		os.Exit(1)
	}
	if err := repo.SeedAdmin(ctx, db); err != nil {
		logger.Error("seed admin", "error", err)
		os.Exit(1)
	}

	authService := service.NewAuthService(db, cfg.JWT.Secret, cfg.JWT.TTL)
	usersService := service.NewUserService(db)
	rolesService := service.NewRoleService(db)
	permissionsService := service.NewPermissionService(db)
	logsService := service.NewLogService(db)
	configsService := service.NewConfigService(db)
	dictsService := service.NewDictService(db)

	// 把路由注册表中的 API 权限点同步进 permissions 表(含挂载的菜单权限点),幂等。
	apiSeeds := make([]repo.ApiPermissionSeed, 0, len(httpapi.RoutePermissions))
	for _, rp := range httpapi.RoutePermissions {
		apiSeeds = append(apiSeeds, repo.ApiPermissionSeed{
			Code:           rp.Code,
			Name:           rp.Name,
			ParentMenuCode: rp.Menu,
			ParentMenuName: rp.MenuName,
		})
	}
	if err := repo.UpsertApiPermissions(ctx, db, apiSeeds); err != nil {
		logger.Error("upsert api permissions", "error", err)
		os.Exit(1)
	}
	// 对账清理:注册表移除的接口/模块,其权限点与授予记录一并删除(自愈)。
	keepAPICodes := make([]string, 0, len(httpapi.RoutePermissions))
	keepMenuCodes := make([]string, 0)
	seen := make(map[string]bool)
	for _, rp := range httpapi.RoutePermissions {
		keepAPICodes = append(keepAPICodes, rp.Code)
		if !seen[rp.Menu] {
			seen[rp.Menu] = true
			keepMenuCodes = append(keepMenuCodes, rp.Menu)
		}
	}
	if err := repo.PrunePermissions(ctx, db, keepAPICodes, keepMenuCodes); err != nil {
		logger.Error("prune permissions", "error", err)
		os.Exit(1)
	}
	if err := repo.SeedSuperAdminRole(ctx, db); err != nil {
		logger.Error("seed super admin role", "error", err)
		os.Exit(1)
	}
	if err := repo.SeedConfigs(ctx, db); err != nil {
		logger.Error("seed configs", "error", err)
		os.Exit(1)
	}
	if err := repo.SeedDicts(ctx, db); err != nil {
		logger.Error("seed dicts", "error", err)
		os.Exit(1)
	}

	// 文件存储装配:多厂商抽象(见 docs/mvp-plan.md 阶段 6),切换驱动 = 改 STORAGE_DRIVER + 重启。
	var fileStorage storage.Storage
	switch cfg.Storage.Driver {
	case "cos":
		fileStorage, err = storage.NewCOS(storage.COSConfig{
			SecretID:  cfg.Storage.COS.SecretID,
			SecretKey: cfg.Storage.COS.SecretKey,
			Bucket:    cfg.Storage.COS.Bucket,
			Region:    cfg.Storage.COS.Region,
			CDNDomain: cfg.Storage.COS.CDNDomain,
			Prefix:    cfg.Storage.COS.Prefix,
		})
	default:
		fileStorage, err = storage.NewLocal(cfg.Storage.BasePath)
	}
	if err != nil {
		logger.Error("init file storage", "driver", cfg.Storage.Driver, "error", err)
		os.Exit(1)
	}
	logger.Info("file storage ready", "driver", fileStorage.Driver())
	mediaService := media.NewService(db, fileStorage)
	uploadsService := uploads.NewService(uploads.DefaultBaseDir, mediaService)

	// 多受众路由(见 docs/multi-audience-contracts.md 与 docs/mvp-plan.md 阶段 8):
	// URL 布局:admin 契约路径字面带 /api/admin、site 契约带 /api/site、app 契约带 /api/app、
	// h5 契约带 /api/h5,网关仅按前缀转发。
	// swagger 注册在 root mux 上且路径更具体,不经过任何中间件链(jwtSkip 无需列 swagger)。
	jwtSkip := httpapi.JWTSkipPaths("/api/admin/healthz", "/api/admin/auth/login")
	loadPermissionCodes := func(ctx context.Context, userID int64) ([]string, error) {
		return usersService.PermissionCodes(ctx, userID)
	}

	adminMux := http.NewServeMux()
	gen.HandlerFromMux(handler.New(logger, authService, usersService, rolesService, permissionsService, logsService, configsService, dictsService, mediaService, uploadsService), adminMux)

	siteMux := http.NewServeMux()
	sitegen.HandlerFromMux(sitehandler.New(logger, configsService), siteMux)

	// app/h5 占坑期与 site 同款匿名公开链,不注入任何 service(见 docs/monorepo-expansion-plan.md 阶段 2)。
	appMux := http.NewServeMux()
	appgen.HandlerFromMux(apphandler.New(logger), appMux)

	h5Mux := http.NewServeMux()
	h5gen.HandlerFromMux(h5handler.New(logger), h5Mux)

	mux := http.NewServeMux()
	httpapi.RegisterSwagger(mux, logger, cfg.Swagger)
	// 公开链:site/app/h5 契约路径自带各自前缀,无鉴权、只读;管理链挂在 /api/admin 下。
	// 安全响应头各链都挂;Origin 校验只挂 admin 链(RequestID 之后、JWTAuth 之前,见
	// docs/server.md "CSRF 与会话安全")。
	mux.Handle("/api/site/", httpapi.Chain(siteMux,
		httpapi.RequestID(),
		httpapi.ClientIP(),
		httpapi.SecurityHeaders(),
		httpapi.Logging(logger),
		httpapi.Recover(logger),
	))
	mux.Handle("/api/app/", httpapi.Chain(appMux,
		httpapi.RequestID(),
		httpapi.ClientIP(),
		httpapi.SecurityHeaders(),
		httpapi.Logging(logger),
		httpapi.Recover(logger),
	))
	mux.Handle("/api/h5/", httpapi.Chain(h5Mux,
		httpapi.RequestID(),
		httpapi.ClientIP(),
		httpapi.SecurityHeaders(),
		httpapi.Logging(logger),
		httpapi.Recover(logger),
	))
	mux.Handle("/api/admin/", httpapi.Chain(adminMux,
		httpapi.RequestID(),
		httpapi.ClientIP(),
		httpapi.SecurityHeaders(),
		httpapi.Logging(logger),
		httpapi.OriginCheck(cfg.CSRF.AllowedOrigins, logger),
		httpapi.JWTAuth(logger, cfg.JWT.Secret, jwtSkip),
		httpapi.PermissionCheck(loadPermissionCodes, logger),
		httpapi.Recover(logger),
	))

	srv := &http.Server{
		Addr:              cfg.HTTP.Addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// 分片上传会话清理:启动清一轮 + 每小时定时,随进程退出停止(见 internal/uploads/cleaner.go)。
	go uploadsService.StartCleaner(ctx, logger)

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
