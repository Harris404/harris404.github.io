import Foundation
import CoreLocation

// MARK: - Cloudflare Worker 服务层

private let CLOUDFLARE_WORKER_URL = "https://australian-assistant-api.paris404.workers.dev"
private let API_AUTH_TOKEN = "roo-api-2013146d1804e6c55385c60fe77c4150"

/// 单一网络服务 — 所有请求通过 Cloudflare Worker 处理
/// 内置 GPS 定位，自动附加坐标到每次对话请求
final class CloudflareService: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    static let shared = CloudflareService()

    private let locationManager = CLLocationManager()
    private(set) var lastLocation: CLLocation?

    private override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        lastLocation = locations.last
    }

    // MARK: - Chat API

    private struct ChatRequest: Encodable {
        let message: String
        let session_id: String
        let latitude: Double?
        let longitude: Double?
        let image_base64: String?
    }

    private struct ChatResponse: Decodable {
        let answer: String
    }

    /// 发送消息到 Cloudflare Worker，返回 AI 回复文本（一次性）
    func sendMessage(_ message: String, sessionId: String, imageBase64: String? = nil) async throws -> String {
        guard let url = URL(string: "\(CLOUDFLARE_WORKER_URL)/api/chat") else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(API_AUTH_TOKEN)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 45.0

        let body = ChatRequest(
            message: message,
            session_id: sessionId,
            latitude: lastLocation?.coordinate.latitude,
            longitude: lastLocation?.coordinate.longitude,
            image_base64: imageBase64
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        if http.statusCode == 401 {
            throw ChatError.networkError("认证失败，请更新应用版本。")
        }
        if http.statusCode == 429 {
            throw ChatError.networkError("请求过于频繁，请稍后再试。")
        }
        guard http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        let chatResponse = try JSONDecoder().decode(ChatResponse.self, from: data)
        return chatResponse.answer
    }

    // MARK: - SSE Streaming API

    /// SSE event types from the streaming endpoint
    enum StreamEvent {
        case status(String)           // "正在分析问题..."
        case toolStart(String)        // tool name
        case toolDone(String)         // tool name
        case content(String)          // LLM token chunk
        case meta(agent: String, tools: [String], elapsedMs: Int)
        case error(String)
        case done
    }

    /// Send message via SSE streaming — yields real-time events
    func sendMessageStream(_ message: String, sessionId: String, imageBase64: String? = nil) -> AsyncThrowingStream<StreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    guard let url = URL(string: "\(CLOUDFLARE_WORKER_URL)/api/chat/stream") else {
                        continuation.finish(throwing: URLError(.badURL))
                        return
                    }
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.setValue("Bearer \(API_AUTH_TOKEN)", forHTTPHeaderField: "Authorization")
                    request.timeoutInterval = 60.0

                    let body = ChatRequest(
                        message: message,
                        session_id: sessionId,
                        latitude: lastLocation?.coordinate.latitude,
                        longitude: lastLocation?.coordinate.longitude,
                        image_base64: imageBase64
                    )
                    request.httpBody = try JSONEncoder().encode(body)

                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
                    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                        continuation.finish(throwing: ChatError.networkError("HTTP \(code)"))
                        return
                    }

                    // Parse SSE line by line
                    for try await line in bytes.lines {
                        let trimmed = line.trimmingCharacters(in: .whitespaces)
                        guard trimmed.hasPrefix("data: ") else { continue }
                        let payload = String(trimmed.dropFirst(6))

                        if payload == "[DONE]" {
                            continuation.yield(.done)
                            break
                        }

                        guard let jsonData = payload.data(using: .utf8),
                              let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
                            continue
                        }

                        let type = json["type"] as? String ?? ""
                        switch type {
                        case "status":
                            if let msg = json["message"] as? String {
                                continuation.yield(.status(msg))
                            }
                        case "tool_start":
                            if let tool = json["tool"] as? String {
                                continuation.yield(.toolStart(tool))
                            }
                        case "tool_done":
                            if let tool = json["tool"] as? String {
                                continuation.yield(.toolDone(tool))
                            }
                        case "content":
                            if let content = json["content"] as? String {
                                continuation.yield(.content(content))
                            }
                        case "meta":
                            let agent = json["agent"] as? String ?? ""
                            let tools = json["tools_used"] as? [String] ?? []
                            let elapsed = json["elapsed_ms"] as? Int ?? 0
                            continuation.yield(.meta(agent: agent, tools: tools, elapsedMs: elapsed))
                        case "error":
                            if let msg = json["message"] as? String {
                                continuation.yield(.error(msg))
                            }
                        default:
                            break
                        }
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    /// 检查 Cloudflare Worker 是否在线
    func checkHealth() async -> Bool {
        guard let url = URL(string: "\(CLOUDFLARE_WORKER_URL)/health") else { return false }
        var request = URLRequest(url: url)
        request.timeoutInterval = 8.0
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
}

// MARK: - APIConfiguration (供 SettingsView 使用)

@MainActor
final class APIConfiguration: ObservableObject {
    static let shared = APIConfiguration()
    private init() {}

    var workerURL: String { CLOUDFLARE_WORKER_URL }
}

// MARK: - 服务可用性状态

struct ServiceAvailability: Sendable {
    let worker: Bool

    var allAvailable: Bool { worker }
    var anyAvailable: Bool { worker }

    var statusDescription: String {
        "☁️ 澳洲助手服务: \(worker ? "✅ 在线" : "❌ 离线")"
    }
}
