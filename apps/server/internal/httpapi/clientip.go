package httpapi

import (
	"context"
	"net"
	"net/http"
)

type ipKey struct{}

// IPFromContext 取客户端 IP(未注入时返回空串)。
func IPFromContext(ctx context.Context) string {
	if ip, ok := ctx.Value(ipKey{}).(string); ok {
		return ip
	}
	return ""
}

// clientIP 取直连客户端 IP(X-Forwarded-For 由反代处理,属于部署层职责)。
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ClientIP 注入客户端 IP 中间件:挂在链路最前,业务日志等后续环节从 context 读取。
func ClientIP() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ipKey{}, clientIP(r))))
		})
	}
}
