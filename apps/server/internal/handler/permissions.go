package handler

import (
	"net/http"

	gen "github.com/cms-template/server/gen"
	"github.com/cms-template/server/internal/httpapi"
	"github.com/cms-template/server/internal/types"
)

// toGenPermissionNode 领域模型 → 契约生成物(递归,children 恒为数组)。
func toGenPermissionNode(node types.PermissionNode) gen.PermissionNode {
	children := make([]gen.PermissionNode, 0, len(node.Children))
	for _, child := range node.Children {
		children = append(children, toGenPermissionNode(child))
	}
	return gen.PermissionNode{
		Id:       node.ID,
		Code:     node.Code,
		Name:     node.Name,
		Type:     gen.PermissionNodeType(node.Type),
		ParentId: node.ParentID,
		Children: children,
	}
}

// ListPermissions GET /permissions。
func (h *Handler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.permissions.Tree(r.Context())
	if err != nil {
		h.logger.Error("list permissions", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	list := make([]gen.PermissionNode, 0, len(nodes))
	for _, node := range nodes {
		list = append(list, toGenPermissionNode(node))
	}
	httpapi.WriteJSON(w, http.StatusOK, list)
}
