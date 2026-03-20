import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
	{
		test: {
			name: "shared",
			root: "./packages/shared",
			include: ["tests/**/*.test.ts"],
			environment: "node",
		},
	},
	{
		test: {
			name: "backend",
			root: "./packages/backend",
			include: ["tests/**/*.test.ts"],
			environment: "node",
		},
	},
	{
		test: {
			name: "frontend",
			root: "./packages/frontend",
			include: ["tests/**/*.test.{ts,tsx}"],
			environment: "jsdom",
		},
	},
])
