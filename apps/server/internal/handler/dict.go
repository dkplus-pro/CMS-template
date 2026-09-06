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

func toGenDict(dict types.Dict) gen.Dict {
	return gen.Dict{
		Id:     dict.ID,
		Code:   dict.Code,
		Name:   dict.Name,
		Remark: genOptsString(dict.Remark),
		Status: dict.Status,
	}
}

func toGenDictEntry(entry types.DictEntry) gen.DictEntry {
	return gen.DictEntry{
		Id:     entry.ID,
		DictId: entry.DictID,
		Label:  entry.Label,
		Value:  entry.Value,
		Sort:   entry.Sort,
		Status: entry.Status,
	}
}

// GetConfig GET /configs/{group}。

func (h *Handler) ListDicts(w http.ResponseWriter, r *http.Request, params gen.ListDictsParams) {
	items, err := h.dicts.List(r.Context(), derefString(params.Keyword))
	if err != nil {
		h.logger.Error("list dicts", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	list := make([]gen.Dict, 0, len(items))
	for _, dict := range items {
		list = append(list, toGenDict(dict))
	}
	httpapi.WriteJSON(w, http.StatusOK, list)
}

// CreateDict POST /dicts。

func (h *Handler) CreateDict(w http.ResponseWriter, r *http.Request) {
	var req gen.DictUpsertRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	dict, err := h.dicts.Create(r.Context(), req.Code, req.Name, derefString(req.Remark), derefBoolDefault(req.Status, true))
	switch {
	case errors.Is(err, service.ErrDictCodeExists):
		httpapi.WriteError(w, http.StatusConflict, "字典编码已存在")
		return
	case err != nil:
		h.logger.Error("create dict", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, toGenDict(dict))
}

// UpdateDict PUT /dicts/{id}。

func (h *Handler) UpdateDict(w http.ResponseWriter, r *http.Request, id gen.Id) {
	var req gen.DictUpsertRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	dict, err := h.dicts.Update(r.Context(), int64(id), req.Code, req.Name, derefString(req.Remark), derefBoolDefault(req.Status, true))
	switch {
	case errors.Is(err, service.ErrDictCodeExists):
		httpapi.WriteError(w, http.StatusConflict, "字典编码已存在")
		return
	case errors.Is(err, repo.ErrDictNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "字典不存在")
		return
	case err != nil:
		h.logger.Error("update dict", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, toGenDict(dict))
}

// DeleteDict DELETE /dicts/{id}。

func (h *Handler) DeleteDict(w http.ResponseWriter, r *http.Request, id gen.Id) {
	err := h.dicts.Delete(r.Context(), int64(id))
	switch {
	case errors.Is(err, repo.ErrDictNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "字典不存在")
		return
	case err != nil:
		h.logger.Error("delete dict", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusNoContent, nil)
}

// ListDictItems GET /dicts/{code}/items。

func (h *Handler) ListDictItems(w http.ResponseWriter, r *http.Request, code string) {
	items, err := h.dicts.ListEntries(r.Context(), code)
	if err != nil {
		if errors.Is(err, repo.ErrDictNotFound) {
			httpapi.WriteError(w, http.StatusNotFound, "字典不存在")
			return
		}
		h.logger.Error("list dict items", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	list := make([]gen.DictEntry, 0, len(items))
	for _, entry := range items {
		list = append(list, toGenDictEntry(entry))
	}
	httpapi.WriteJSON(w, http.StatusOK, list)
}

// CreateDictItem POST /dicts/{code}/items。

func (h *Handler) CreateDictItem(w http.ResponseWriter, r *http.Request, code string) {
	var req gen.DictEntryUpsertRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	entry, err := h.dicts.CreateEntry(r.Context(), code, req.Label, req.Value, derefInt(req.Sort), derefBoolDefault(req.Status, true))
	switch {
	case errors.Is(err, service.ErrDictValueExists):
		httpapi.WriteError(w, http.StatusConflict, "字典项值重复")
		return
	case errors.Is(err, repo.ErrDictNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "字典不存在")
		return
	case err != nil:
		h.logger.Error("create dict item", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, toGenDictEntry(entry))
}

// UpdateDictItem PUT /dicts/items/{id}。

func (h *Handler) UpdateDictItem(w http.ResponseWriter, r *http.Request, id gen.Id) {
	var req gen.DictEntryUpsertRequest
	if err := httpapi.DecodeRequest(r, &req); err != nil {
		httpapi.WriteError(w, http.StatusBadRequest, "参数错误")
		return
	}

	entry, err := h.dicts.UpdateEntry(r.Context(), int64(id), req.Label, req.Value, derefInt(req.Sort), derefBoolDefault(req.Status, true))
	switch {
	case errors.Is(err, service.ErrDictValueExists):
		httpapi.WriteError(w, http.StatusConflict, "字典项值重复")
		return
	case errors.Is(err, repo.ErrDictEntryNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "字典项不存在")
		return
	case err != nil:
		h.logger.Error("update dict item", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusOK, toGenDictEntry(entry))
}

// DeleteDictItem DELETE /dicts/items/{id}。

func (h *Handler) DeleteDictItem(w http.ResponseWriter, r *http.Request, id gen.Id) {
	err := h.dicts.DeleteEntry(r.Context(), int64(id))
	switch {
	case errors.Is(err, repo.ErrDictEntryNotFound):
		httpapi.WriteError(w, http.StatusNotFound, "字典项不存在")
		return
	case err != nil:
		h.logger.Error("delete dict item", "error", err)
		httpapi.WriteError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	httpapi.WriteJSON(w, http.StatusNoContent, nil)
}
