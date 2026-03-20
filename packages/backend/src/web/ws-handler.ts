import type { FastifyInstance } from "fastify"
import type { WsHub } from "../core/ws-hub"

export async function registerWsHandler(app: FastifyInstance, wsHub: WsHub) {
	app.get("/ws", { websocket: true }, (socket, _req) => {
		wsHub.addClient(socket)
	})
}
