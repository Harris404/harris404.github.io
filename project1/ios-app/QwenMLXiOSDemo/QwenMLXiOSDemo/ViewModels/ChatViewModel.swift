import Foundation
import UIKit

/// 主对话 ViewModel - SSE 流式输出 + 打字机效果
/// 对话历史由 Worker 通过 session_id 在 KV 中管理
@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var inputText: String = ""
    @Published var isProcessing: Bool = false
    @Published var serviceStatus: ServiceAvailability?
    @Published var showServiceError: Bool = false
    @Published var serviceErrorMessage: String = ""
    @Published var conversations: [Conversation] = []
    @Published var pendingImageBase64: String? = nil

    // Streaming state
    @Published var streamingStatus: String = ""   // "正在查询天气..."
    @Published var activeTools: [String] = []      // Currently running tools
    @Published var currentAgent: String = ""        // "life", "finance", etc.

    private let cloudflare = CloudflareService.shared
    private let userPreferences = UserPreferencesService.shared
    private let store = ConversationStore.shared
    private var currentConversation: Conversation?
    private var streamTask: Task<Void, Never>?

    // MARK: - Session ID

    private var sessionId: String {
        UserDefaults.standard.string(forKey: "chatSessionId") ?? resetSessionId()
    }

    @discardableResult
    private func resetSessionId() -> String {
        let newId = UUID().uuidString
        UserDefaults.standard.set(newId, forKey: "chatSessionId")
        return newId
    }

    // MARK: - Init

    init() {
        conversations = store.load()
        Task { await checkServices() }
    }

    // MARK: - 健康检查

    func checkServices() async {
        let online = await cloudflare.checkHealth()
        serviceStatus = ServiceAvailability(worker: online)
        if !online {
            serviceErrorMessage = "无法连接到助手服务，请检查网络连接后重试。"
            showServiceError = true
        }
    }

    // MARK: - 发送消息（流式）

    func sendMessage() async {
        let trimmed = inputText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        // 首次发消息时创建会话
        if currentConversation == nil {
            currentConversation = Conversation(sessionId: sessionId)
        }

        messages.append(Message(role: .user, content: trimmed))
        inputText = ""
        isProcessing = true
        streamingStatus = "正在分析问题..."
        activeTools = []
        currentAgent = ""
        userPreferences.recordQuery(trimmed)

        // Capture and clear pending image
        let imageToSend = pendingImageBase64
        pendingImageBase64 = nil

        // Create a placeholder assistant message for streaming
        let streamingId = UUID()
        messages.append(Message(id: streamingId, role: .assistant, content: ""))

        var fullContent = ""
        var hasError = false

        // Try streaming first, fallback to non-streaming
        do {
            let stream = cloudflare.sendMessageStream(trimmed, sessionId: sessionId, imageBase64: imageToSend)

            for try await event in stream {
                switch event {
                case .status(let msg):
                    streamingStatus = msg

                case .toolStart(let tool):
                    activeTools.append(tool)
                    streamingStatus = "正在调用 \(toolDisplayName(tool))..."

                case .toolDone(let tool):
                    activeTools.removeAll { $0 == tool }

                case .content(let chunk):
                    fullContent += chunk
                    // Update the streaming message in-place (typewriter effect)
                    updateStreamingMessage(id: streamingId, content: fullContent)

                case .meta(let agent, _, _):
                    currentAgent = agent

                case .error(let msg):
                    if fullContent.isEmpty {
                        fullContent = "⚠️ \(msg)"
                        updateStreamingMessage(id: streamingId, content: fullContent)
                    }
                    hasError = true

                case .done:
                    break
                }
            }
        } catch {
            if fullContent.isEmpty {
                // Streaming failed entirely — try non-streaming fallback
                do {
                    streamingStatus = "流式连接失败，切换到标准模式..."
                    let answer = try await cloudflare.sendMessage(trimmed, sessionId: sessionId, imageBase64: imageToSend)
                    fullContent = answer
                    updateStreamingMessage(id: streamingId, content: fullContent)
                } catch {
                    fullContent = formatError(error)
                    updateStreamingMessage(id: streamingId, content: fullContent)
                    hasError = true
                }
            }
        }

        // If streaming produced no content, show error
        if fullContent.isEmpty && !hasError {
            fullContent = "😔 未收到回复，请重试。"
            updateStreamingMessage(id: streamingId, content: fullContent)
        }

        isProcessing = false
        streamingStatus = ""
        activeTools = []
        persistCurrentConversation()
    }

    // MARK: - 停止生成

    func stopGenerating() {
        streamTask?.cancel()
        streamTask = nil
        isProcessing = false
        streamingStatus = ""
        activeTools = []
    }

    // MARK: - 更新流式消息

    private func updateStreamingMessage(id: UUID, content: String) {
        if let index = messages.firstIndex(where: { $0.id == id }) {
            messages[index] = Message(id: id, role: .assistant, content: content)
        }
    }

    // MARK: - 工具名中文化

    private func toolDisplayName(_ tool: String) -> String {
        let names: [String: String] = [
            "get_weather": "天气查询 🌤️",
            "convert_currency": "汇率换算 💱",
            "supermarket_assistant": "超市特价 🛒",
            "supermarket_product_search": "商品搜索 🔍",
            "get_departures": "交通查询 🚂",
            "search_nearby": "附近搜索 📍",
            "maps_assistant": "地图导航 🗺️",
            "calculate_tax": "税务计算 🧮",
            "search_properties": "房产搜索 🏠",
            "get_bank_rates": "银行利率 🏦",
            "search_jobs": "求职搜索 💼",
            "search_courses": "课程搜索 🎓",
            "search_oshc": "OSHC保险 🏥",
            "search_medicine": "药品查询 💊",
            "web_search": "网络搜索 🌐",
            "vehicle": "车辆查询 🚗",
            "visa_info": "签证查询 🛂",
            "events": "活动搜索 🎉",
            "emergency_info": "紧急信息 🚨",
            "get_energy_plans": "能源比价 ⚡",
            "get_fuel_prices": "油价查询 ⛽",
        ]
        return names[tool] ?? tool
    }

    // MARK: - 会话管理

    private func persistCurrentConversation() {
        guard var conv = currentConversation else { return }
        conv.messages = messages
        conv.updatedAt = Date()
        conv.updateTitle()
        currentConversation = conv
        store.upsert(conv)
        conversations = store.load()
    }

    func loadConversation(_ conversation: Conversation) {
        currentConversation = conversation
        messages = conversation.messages
        UserDefaults.standard.set(conversation.sessionId, forKey: "chatSessionId")
    }

    func deleteConversation(_ conversation: Conversation) {
        store.delete(id: conversation.id)
        conversations = store.load()
        if currentConversation?.id == conversation.id {
            clearChat()
        }
    }

    // MARK: - 清空 / 新建对话

    func clearChat() {
        messages.removeAll()
        currentConversation = nil
        pendingImageBase64 = nil
        resetSessionId()
        streamingStatus = ""
        activeTools = []
        currentAgent = ""
    }

    // MARK: - 图片处理

    func loadImageFromData(_ data: Data) {
        // Resize to max 1024px, compress to JPEG, encode to base64
        guard let uiImage = UIImage(data: data) else { return }
        let maxSize: CGFloat = 1024
        let scale = min(maxSize / uiImage.size.width, maxSize / uiImage.size.height, 1.0)
        let newSize = CGSize(width: uiImage.size.width * scale, height: uiImage.size.height * scale)
        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        uiImage.draw(in: CGRect(origin: .zero, size: newSize))
        let resized = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        guard let jpegData = resized?.jpegData(compressionQuality: 0.8) else { return }
        pendingImageBase64 = "data:image/jpeg;base64," + jpegData.base64EncodedString()
    }

    // MARK: - 错误格式化

    private func formatError(_ error: Error) -> String {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case NSURLErrorNotConnectedToInternet:
                return "📶 网络未连接，请检查网络后重试。"
            case NSURLErrorTimedOut:
                return "⏱️ 请求超时（服务器处理时间较长），请稍后重试。"
            case NSURLErrorCannotConnectToHost, NSURLErrorCannotFindHost, NSURLErrorBadServerResponse:
                return "🔌 无法连接到助手服务，请检查网络连接后重试。"
            default:
                return "🌐 网络错误：\(error.localizedDescription)"
            }
        }
        return "😔 发生错误：\(error.localizedDescription)\n\n请重试，如问题持续请重启应用。"
    }
}

// MARK: - 错误类型

enum ChatError: Error {
    case networkError(String)

    var userFriendlyMessage: String {
        switch self {
        case .networkError(let msg):
            return "🌐 网络连接问题\n\n\(msg)\n\n请检查您的网络连接后重试。"
        }
    }
}
