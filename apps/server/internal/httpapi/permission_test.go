package httpapi

import "testing"

// TestMatchRoutePermission 覆盖 {id} 通配、段数不等、cutset 误吃三类边界。
// 其中 cutset 用例针对 strings.Trim(path, "/api/admin/") 的字符集误吃:
// 尾段字符全部落在 cutset(/,a,p,i,d,m,n)内时整段被吃掉,段数变化导致漏配(权限静默降级)。
func TestMatchRoutePermission(t *testing.T) {
	cases := []struct {
		name   string
		method string
		path   string
		code   string
		ok     bool
	}{
		{"字面匹配", "GET", "/api/admin/users", "system:user:list", true},
		{"{id} 通配", "GET", "/api/admin/users/42", "system:user:list", true},
		{"{id} 通配写操作", "PUT", "/api/admin/users/42", "system:user:update", true},
		{"多段通配", "PUT", "/api/admin/dicts/c1/items/9", "system:dict:update", true},
		{"带子路径通配", "PATCH", "/api/admin/users/42/status", "system:user:update", true},
		{"cutset 尾段整段误吃", "PUT", "/api/admin/users/main", "system:user:update", true},
		{"cutset 尾段整段误吃(删除)", "DELETE", "/api/admin/dicts/ma", "system:dict:delete", true},
		{"cutset 尾段整段误吃(角色)", "PUT", "/api/admin/roles/pan", "system:role:update", true},
		{"cutset 前缀误吃自愈", "GET", "/api/admin/media-groups", "media:group:list", true},
		{"段数不等", "GET", "/api/admin/users/42/extra", "", false},
		{"方法不存在", "DELETE", "/api/admin/users", "", false},
		{"非 admin 前缀", "GET", "/api/app/ping", "", false},
		{"公开端点不入注册表", "POST", "/api/admin/auth/login", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, ok := MatchRoutePermission(tc.method, tc.path)
			if ok != tc.ok || code != tc.code {
				t.Fatalf("MatchRoutePermission(%q,%q) = (%q,%v), want (%q,%v)",
					tc.method, tc.path, code, ok, tc.code, tc.ok)
			}
		})
	}
}
