package httpapi

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/cms-template/server/internal/config"
)

// swaggerIndexHTML Swagger UI 页面,静态资源走 CDN,spec 由同目录 openapi.yaml 端点提供。
const swaggerIndexHTML = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>CMS Admin API - Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.min.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.addEventListener("load", function () {
        window.ui = SwaggerUIBundle({
          url: "./openapi.yaml",
          dom_id: "#swagger-ui",
          persistAuthorization: true,
        });
      });
    </script>
  </body>
</html>`

// RegisterSwagger 在 mux 上挂载 Swagger UI 与契约文件,路径:/swagger 与 /swagger/openapi.yaml。
func RegisterSwagger(mux *http.ServeMux, logger *slog.Logger, cfg config.SwaggerConfig) {
	if !cfg.Enabled {
		logger.Info("swagger ui disabled")
		return
	}

	spec, err := os.ReadFile(cfg.SpecPath)
	if err != nil {
		logger.Error("swagger enabled but spec file unreadable, refusing to start",
			"path", cfg.SpecPath, "error", err)
		// 契约是本项目的单一事实源,Swagger 开启却读不到说明部署不完整,直接失败。
		panic("swagger spec not found at " + cfg.SpecPath)
	}

	mux.HandleFunc("GET /swagger", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/swagger/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("GET /swagger/", func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/swagger/openapi.yaml":
			w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
			_, _ = w.Write(spec)
		default:
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(swaggerIndexHTML))
		}
	})
	logger.Info("swagger ui enabled", "path", "/swagger", "spec", cfg.SpecPath)
}
