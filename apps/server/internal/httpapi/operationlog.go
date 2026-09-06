package httpapi

import (
	"context"
	"net"
	"net/http"
	"time"
)

// OperationLogEntry 操作日志采集结果,由调用方提供的写入函数落库。
type OperationLogEntry struct {
	UserID     int64
	Username   string
	Method     string
	Path       string
	Action     string
	OK         bool
	StatusCode int
	Message    string
	IP         string
	LatencyMS  int64
}

// OperationLog 操作日志采集中间件:阶段 1 只记录不提供查询接口(见 docs/mvp-plan.md)。
// log 回调在最外层(main)注入,内部经 repo 落库;action 字段阶段 2 接入路由注册表后填充。
func OperationLog(log func(ctx context.Context, entry OperationLogEntry)) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			start := time.Now()

			next.ServeHTTP(rec, r)

			claims, _ := ClaimsFromContext(r.Context())
			log(r.Context(), OperationLogEntry{
				UserID:     claims.UserID,
				Username:   claims.Username,
				Method:     r.Method,
				Path:       r.URL.Path,
				OK:         rec.status < 400,
				StatusCode: rec.status,
				IP:         clientIP(r),
				LatencyMS:  time.Since(start).Milliseconds(),
			})
		})
	}
}

// clientIP 取直连客户端 IP(X-Forwarded-For 由反代处理,属于部署层职责)。
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
