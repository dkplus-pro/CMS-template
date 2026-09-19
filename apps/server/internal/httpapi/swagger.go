package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
)

// swaggerIndexHTML Swagger UI 页面,静态资源走 CDN;spec 端点列表由 __SPEC_URLS__ 注入
// (admin 必须、site 可选,见 RegisterSwagger)。
const swaggerIndexHTML = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>CMS API - Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.min.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.addEventListener("load", function () {
        window.ui = SwaggerUIBundle({
          __SPEC_URLS__,
          dom_id: "#swagger-ui",
          persistAuthorization: true,
        });
      });
    </script>
  </body>
</html>`

// SwaggerOptions Swagger 托管选项(值参数,与 config 包解耦,依赖矩阵见 apps/server/AGENTS.md §1)。
type SwaggerOptions struct {
	Enabled       bool
	AdminSpecPath string // 必需,读不到拒绝启动
	SiteSpecPath  string // 可选,为空跳过
}

// RegisterSwagger 在 mux 上挂载 Swagger UI 与契约文件:
//   - /swagger           → 重定向到 /swagger/
//   - /swagger/          → UI 页面(按已加载契约注入多 spec 下拉)
//   - /swagger/admin.yaml → admin 契约(必需,读不到拒绝启动)
//   - /swagger/site.yaml  → site 契约(可选,文件缺失仅跳过)
func RegisterSwagger(mux *http.ServeMux, logger *slog.Logger, opts SwaggerOptions) {
	if !opts.Enabled {
		logger.Info("swagger ui disabled")
		return
	}

	specs := map[string][]byte{}
	specs["/swagger/admin.yaml"] = mustReadSpec(opts.AdminSpecPath, logger)
	specEntries := []string{`{ name: "admin", url: "./admin.yaml" }`}
	if opts.SiteSpecPath != "" {
		if data, err := os.ReadFile(opts.SiteSpecPath); err != nil {
			logger.Warn("swagger site spec unreadable, skipping",
				"path", opts.SiteSpecPath, "error", err)
		} else {
			specs["/swagger/site.yaml"] = data
			specEntries = append(specEntries, `{ name: "site", url: "./site.yaml" }`)
		}
	}
	page := strings.Replace(swaggerIndexHTML, "__SPEC_URLS__",
		"urls: [\n        "+strings.Join(specEntries, ",\n        ")+",\n      ]", 1)

	mux.HandleFunc("GET /swagger", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/swagger/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("GET /swagger/", func(w http.ResponseWriter, r *http.Request) {
		if spec, ok := specs[r.URL.Path]; ok {
			w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
			_, _ = w.Write(spec)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(page))
	})
	logger.Info("swagger ui enabled", "path", "/swagger", "adminSpec", opts.AdminSpecPath)
}

// mustReadSpec 读取必需契约;读不到说明部署不完整,直接失败。
func mustReadSpec(path string, logger *slog.Logger) []byte {
	spec, err := os.ReadFile(path)
	if err != nil {
		logger.Error("swagger enabled but spec file unreadable, refusing to start",
			"path", path, "error", err)
		panic(fmt.Sprintf("swagger spec not found at %s", path))
	}
	return spec
}
