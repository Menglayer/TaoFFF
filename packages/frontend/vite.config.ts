import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 5173,
		proxy: {
			"/ws": {
				target: "http://localhost:8080",
				ws: true,
				changeOrigin: true,
			},
			"/api": {
				target: "http://localhost:8080",
				changeOrigin: true,
			},
		},
	},
})
