package handler

import (
	"errors"
	"net/http"

	gen "github.com/cms-template/server/gen"
	"github.com/cms-template/server/internal/httpapi"
	"github.com/cms-template/server/internal/repo"
	"github.com/cms-template/server/internal/service"
	"github.com/cms-template/server/internal/types"
)

// toGenUserItem 领域模型 → 契约生成物。
func toGenUserItem(item types.UserItem) gen.UserItem {
	var email *string
	if item.Email != "" {
		email = &item.Email
	}
	var roleIds []int64
	if item.RoleIds == nil {
		roleIds = []int64{}
	} else {
		roleIds = item.RoleIds
	}
	return gen.UserItem{
		Id:          item.ID,
		Username:    item.Username,
		Nickname:    item.Nickname,
		Email:       email,
		Status:      item.Status,
		IsBuiltin:   &item.IsBuiltin,
		LastLoginAt: item.LastLoginAt,
		RoleIds:     roleIds,
	}
}

// claimsUserID 当前登录用户 ID(自我操作守卫用)。
func claimsUserID(r *http.Request) (int64, bool) {
	claims, ok := httpapi.ClaimsFromContext(r.Context())
	return claims.UserID, ok
}

// ListUsers GET /users。
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request, params gen.ListUsersParams) {
	page, pageSize := pageParams(params.Page, params.PageSize)
	keyword := derefString(params.Keyword)
	status := derefBool(params.Status)

	items, total, err := h.users.List(r.Context(), page, pageSize, keyword, status)
	if err != nil {
		h.logger.Error("list users", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	list := make([]gen.UserItem, 0, len(items))
	for _, item := range items {
		list = append(list, toGenUserItem(item))
	}
	httpapi.WriteJSON(w, http.StatusOK, gen.UserListResponse{List: list, Total: int(total)})
}

// CreateUser POST /users。
func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req gen.UserCreateRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	item, err := h.users.Create(r.Context(), req.Username, req.Password,
		derefString(req.Nickname), derefString(req.Email), derefBoolDefault(req.Status, true), derefInts(req.RoleIds))
	switch {
	case errors.Is(err, service.ErrUsernameExists):
		httpapi.WriteError(w, http.StatusConflict, "用户名已存在")
		return
	case err != nil:
		h.logger.Error("create user", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	httpapi.WriteJSON(w, http.StatusOK, toGenUserItem(item))
}

// GetUser GET /users/{id}。
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request, id gen.Id) {
	item, err := h.users.Get(r.Context(), int64(id))
	if err != nil {
		h.logger.Error("get user", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, toGenUserItem(item))
}

// UpdateUser PUT /users/{id}。
func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request, id gen.Id) {
	var req gen.UserUpdateRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	item, err := h.users.Update(r.Context(), int64(id), req.Nickname, derefString(req.Email))
	if err != nil {
		h.logger.Error("update user", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, toGenUserItem(item))
}

// DeleteUser DELETE /users/{id}。
func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request, id gen.Id) {
	operatorID, _ := claimsUserID(r)
	err := h.users.Delete(r.Context(), operatorID, int64(id))
	switch {
	case errors.Is(err, service.ErrSelfOperation):
		httpapi.WriteError(w, http.StatusForbidden, "不可删除自己")
		return
	case errors.Is(err, service.ErrBuiltinUser):
		httpapi.WriteError(w, http.StatusForbidden, "内置管理员不可删除")
		return
	case errors.Is(err, repo.ErrUserNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "用户不存在")
		return
	case err != nil:
		h.logger.Error("delete user", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusNoContent, nil)
}

// UpdateUserStatus PATCH /users/{id}/status。
func (h *Handler) UpdateUserStatus(w http.ResponseWriter, r *http.Request, id gen.Id) {
	var req gen.StatusRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	operatorID, _ := claimsUserID(r)
	err := h.users.UpdateStatus(r.Context(), operatorID, int64(id), req.Status)
	switch {
	case errors.Is(err, service.ErrSelfOperation):
		httpapi.WriteError(w, http.StatusForbidden, "不可禁用自己")
		return
	case errors.Is(err, service.ErrBuiltinUser):
		httpapi.WriteError(w, http.StatusForbidden, "内置管理员不可禁用")
		return
	case errors.Is(err, repo.ErrUserNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "用户不存在")
		return
	case err != nil:
		h.logger.Error("update user status", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusNoContent, nil)
}

// UpdateUserRoles PUT /users/{id}/roles。
func (h *Handler) UpdateUserRoles(w http.ResponseWriter, r *http.Request, id gen.Id) {
	var req gen.RoleIdsRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.users.UpdateRoles(r.Context(), int64(id), req.RoleIds); err != nil {
		h.logger.Error("update user roles", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusNoContent, nil)
}

// 通用小工具:分页与可选参数解引用。
func pageParams(page, pageSize *gen.Page) (int, int) {
	p, ps := 1, 20
	if page != nil {
		p = int(*page)
	}
	if pageSize != nil {
		ps = int(*pageSize)
	}
	return p, ps
}

func derefString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func derefBool(v *bool) *bool {
	return v
}

func derefBoolDefault(v *bool, fallback bool) bool {
	if v == nil {
		return fallback
	}
	return *v
}

func derefInts(v *[]int64) []int64 {
	if v == nil {
		return []int64{}
	}
	return *v
}
