package handler

import (
	"net/http"

	gen "github.com/cms-template/server/gen/admin"
	"github.com/cms-template/server/internal/httpapi"
)

// Healthz GET /healthz。
func (h *Handler) Healthz(w http.ResponseWriter, r *http.Request) {
	httpapi.WriteJSON(w, http.StatusOK, gen.HealthzResponse{Status: "ok"})
}
