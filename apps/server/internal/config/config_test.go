package config

import "testing"

func TestParseOrigins(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want []string
	}{
		{name: "single origin", raw: "http://localhost:8081", want: []string{"http://localhost:8081"}},
		{
			name: "multiple origins",
			raw:  "https://admin.example.com,http://localhost:8081",
			want: []string{"https://admin.example.com", "http://localhost:8081"},
		},
		{name: "spaces around segments", raw: " https://a.example.com , https://b.example.com ", want: []string{"https://a.example.com", "https://b.example.com"}},
		{name: "empty segments ignored", raw: "https://a.example.com,,https://b.example.com", want: []string{"https://a.example.com", "https://b.example.com"}},
		{name: "trailing comma", raw: "https://a.example.com,", want: []string{"https://a.example.com"}},
		{name: "only spaces becomes empty", raw: "   ", want: []string{}},
		{name: "empty string becomes empty", raw: "", want: []string{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseOrigins(tt.raw)
			if len(got) != len(tt.want) {
				t.Fatalf("parseOrigins(%q) = %v, want %v", tt.raw, got, tt.want)
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Fatalf("parseOrigins(%q)[%d] = %q, want %q", tt.raw, i, got[i], tt.want[i])
				}
			}
		})
	}
}
