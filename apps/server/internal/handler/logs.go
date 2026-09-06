package handler

import (
	"net/http"

	gen "github.com/cms-template/server/gen/admin"
	"github.com/cms-template/server/internal/httpapi"
	"github.com/cms-template/server/internal/types"
)

// toGenOperationLog 领域模型 → 契约生成物。
func toGenOperationLog(item types.OperationLogItem) gen.OperationLogItem {
	return gen.OperationLogItem{
		Id:          item.ID,
		UserId:      item.UserID,
		Username:    genOptsString(item.Username),
		Action:      item.Action,
		Resource:    item.Resource,
		ResourceId:  genOptsString(item.ResourceID),
		Description: item.Description,
		Status:      gen.OperationLogItemStatus(item.Status),
		Ip:          genOptsString(item.IP),
		CreatedAt:   item.CreatedAt,
	}
}

// ListOperationLogs GET /operation-logs。
func (h *Handler) ListOperationLogs(w http.ResponseWriter, r *http.Request, params gen.ListOperationLogsParams) {
	page, pageSize := pageParams(params.Page, params.PageSize)

	startTime, endTime := params.StartTime, params.EndTime

	items, total, err := h.logs.List(r.Context(), page, pageSize,
		derefString(params.Username), derefString(params.Resource), derefString(params.Action),
		derefStatus(params.Status), startTime, endTime)
	if err != nil {
		h.logger.Error("list operation logs", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	list := make([]gen.OperationLogItem, 0, len(items))
	for _, item := range items {
		list = append(list, toGenOperationLog(item))
	}
	httpapi.WriteJSON(w, http.StatusOK, gen.OperationLogListResponse{List: list, Total: int(total)})
}
