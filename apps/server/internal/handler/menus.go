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

// toGenMenuItem 领域模型 → 契约生成物(children 恒为数组)。
func toGenMenuItem(item types.MenuItem) gen.MenuItem {
	children := make([]gen.MenuItem, 0, len(item.Children))
	for _, child := range item.Children {
		children = append(children, toGenMenuItem(child))
	}
	return gen.MenuItem{
		Id:             item.ID,
		ParentId:       item.ParentID,
		Name:           item.Name,
		Path:           item.Path,
		ComponentKey:   genOptsString(item.ComponentKey),
		Icon:           genOptsString(item.Icon),
		PermissionCode: genOptsString(item.PermissionCode),
		Sort:           item.Sort,
		Visible:        item.Visible,
		Children:       children,
	}
}

func toGenAuthMenuNode(node types.AuthMenuNode) gen.AuthMenuNode {
	children := make([]gen.AuthMenuNode, 0, len(node.Children))
	for _, child := range node.Children {
		children = append(children, toGenAuthMenuNode(child))
	}
	return gen.AuthMenuNode{
		Id:           node.ID,
		ParentId:     node.ParentID,
		Name:         node.Name,
		Path:         node.Path,
		ComponentKey: genOptsString(node.ComponentKey),
		Icon:         genOptsString(node.Icon),
		Sort:         node.Sort,
		Children:     children,
	}
}

// ListMenus GET /menus。
func (h *Handler) ListMenus(w http.ResponseWriter, r *http.Request) {
	items, err := h.menus.List(r.Context())
	if err != nil {
		h.logger.Error("list menus", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	list := make([]gen.MenuItem, 0, len(items))
	for _, item := range items {
		list = append(list, toGenMenuItem(item))
	}
	httpapi.WriteJSON(w, http.StatusOK, list)
}

// CreateMenu POST /menus。
func (h *Handler) CreateMenu(w http.ResponseWriter, r *http.Request) {
	var req gen.MenuUpsertRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	item, err := h.menus.Create(r.Context(), toMenuUpsert(req))
	switch {
	case errors.Is(err, service.ErrMenuPathExists):
		httpapi.WriteError(w, http.StatusConflict, "菜单路径已存在")
		return
	case errors.Is(err, repo.ErrMenuNotFound):
		httpapi.WriteError(w, http.StatusBadRequest, "父菜单不存在")
		return
	case err != nil:
		h.logger.Error("create menu", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, toGenMenuItem(item))
}

// UpdateMenu PUT /menus/{id}。
func (h *Handler) UpdateMenu(w http.ResponseWriter, r *http.Request, id gen.Id) {
	var req gen.MenuUpsertRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	item, err := h.menus.Update(r.Context(), int64(id), toMenuUpsert(req))
	switch {
	case errors.Is(err, service.ErrMenuPathExists):
		httpapi.WriteError(w, http.StatusConflict, "菜单路径已存在")
		return
	case errors.Is(err, repo.ErrMenuNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "菜单不存在")
		return
	case err != nil:
		h.logger.Error("update menu", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, toGenMenuItem(item))
}

// DeleteMenu DELETE /menus/{id}。
func (h *Handler) DeleteMenu(w http.ResponseWriter, r *http.Request, id gen.Id) {
	err := h.menus.Delete(r.Context(), int64(id))
	switch {
	case errors.Is(err, service.ErrMenuHasChildren):
		httpapi.WriteError(w, http.StatusConflict, "存在子菜单,请先删除子菜单")
		return
	case errors.Is(err, repo.ErrMenuNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "菜单不存在")
		return
	case err != nil:
		h.logger.Error("delete menu", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusNoContent, nil)
}

// GetAuthMenus GET /auth/menus。
func (h *Handler) GetAuthMenus(w http.ResponseWriter, r *http.Request) {
	claims, ok := httpapi.ClaimsFromContext(r.Context())
	if !ok {
		httpapi.WriteError(w, http.StatusUnauthorized, "未登录或凭证缺失")
		return
	}

	nodes, err := h.menus.AuthMenus(r.Context(), claims.UserID)
	if err != nil {
		h.logger.Error("auth menus", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	list := make([]gen.AuthMenuNode, 0, len(nodes))
	for _, node := range nodes {
		list = append(list, toGenAuthMenuNode(node))
	}
	httpapi.WriteJSON(w, http.StatusOK, list)
}

func toMenuUpsert(req gen.MenuUpsertRequest) types.MenuUpsert {
	return types.MenuUpsert{
		ParentID:       req.ParentId,
		Name:           req.Name,
		Path:           req.Path,
		ComponentKey:   derefString(req.ComponentKey),
		Icon:           derefString(req.Icon),
		PermissionCode: derefString(req.PermissionCode),
		Sort:           req.Sort,
		Visible:        req.Visible,
	}
}
