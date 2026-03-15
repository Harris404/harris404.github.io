import Foundation

struct Conversation: Identifiable, Codable {
    let id: UUID
    let sessionId: String
    var title: String
    var messages: [Message]
    let createdAt: Date
    var updatedAt: Date
    
    init(sessionId: String, messages: [Message] = []) {
        self.id = UUID()
        self.sessionId = sessionId
        self.title = "新对话"
        self.messages = messages
        self.createdAt = Date()
        self.updatedAt = Date()
    }
    
    /// 用第一条用户消息作为标题
    mutating func updateTitle() {
        if let first = messages.first(where: { $0.role == .user }) {
            let text = first.content.prefix(30)
            title = text.count < first.content.count ? "\(text)…" : String(text)
        }
    }
}

// MARK: - 本地存储

final class ConversationStore: @unchecked Sendable {
    static let shared = ConversationStore()
    private let key = "savedConversations"
    private let maxConversations = 50
    
    func load() -> [Conversation] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let list = try? JSONDecoder().decode([Conversation].self, from: data) else {
            return []
        }
        return list.sorted { $0.updatedAt > $1.updatedAt }
    }
    
    func save(_ conversations: [Conversation]) {
        let trimmed = Array(conversations.prefix(maxConversations))
        if let data = try? JSONEncoder().encode(trimmed) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
    
    func upsert(_ conversation: Conversation) {
        var list = load()
        if let idx = list.firstIndex(where: { $0.id == conversation.id }) {
            list[idx] = conversation
        } else {
            list.insert(conversation, at: 0)
        }
        save(list)
    }
    
    func delete(id: UUID) {
        var list = load()
        list.removeAll { $0.id == id }
        save(list)
    }
    
    func clearAll() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
