import Foundation
import Combine

/// 用户偏好设置服务 - 管理用户的位置、语言和使用偏好
/// User Preferences Service - Manages user location, language, and usage preferences
@MainActor
final class UserPreferencesService: ObservableObject {
    static let shared = UserPreferencesService()
    
    // MARK: - Published Properties
    
    /// 用户偏好的位置（城市名称）
    /// User's preferred location (city name)
    @Published var preferredLocation: String? {
        didSet {
            savePreferredLocation(preferredLocation)
        }
    }
    
    /// 用户偏好的语言（"zh" 中文, "en" 英文）
    /// User's preferred language ("zh" Chinese, "en" English)
    @Published var preferredLanguage: String {
        didSet {
            savePreferredLanguage(preferredLanguage)
        }
    }
    
    /// 常用查询记录（最近10条）
    /// Frequently asked queries (last 10)
    @Published var frequentQueries: [String] = [] {
        didSet {
            saveFrequentQueries(frequentQueries)
        }
    }
    
    /// 位置历史记录（最近5个位置）
    /// Location history (last 5 locations)
    @Published var locationHistory: [String] = [] {
        didSet {
            saveLocationHistory(locationHistory)
        }
    }
    
    // MARK: - UserDefaults Keys
    
    private enum Keys {
        static let preferredLocation = "userPreferredLocation"
        static let preferredLanguage = "userPreferredLanguage"
        static let frequentQueries = "userFrequentQueries"
        static let locationHistory = "userLocationHistory"
        static let lastUsedDate = "userLastUsedDate"
        static let totalQueryCount = "userTotalQueryCount"
    }
    
    // MARK: - Statistics
    
    /// 最后使用时间
    /// Last used date
    var lastUsedDate: Date? {
        UserDefaults.standard.object(forKey: Keys.lastUsedDate) as? Date
    }
    
    /// 总查询次数
    /// Total query count
    var totalQueryCount: Int {
        UserDefaults.standard.integer(forKey: Keys.totalQueryCount)
    }
    
    // MARK: - Initialization
    
    private init() {
        // 从UserDefaults加载保存的偏好
        // Load saved preferences from UserDefaults
        preferredLocation = UserDefaults.standard.string(forKey: Keys.preferredLocation)
        preferredLanguage = UserDefaults.standard.string(forKey: Keys.preferredLanguage) ?? Self.detectSystemLanguage()
        frequentQueries = UserDefaults.standard.stringArray(forKey: Keys.frequentQueries) ?? []
        locationHistory = UserDefaults.standard.stringArray(forKey: Keys.locationHistory) ?? []
    }
    
    // MARK: - Language Detection
    
    /// 检测系统语言，自动选择中文或英文
    /// Detect system language, automatically choose Chinese or English
    private static func detectSystemLanguage() -> String {
        let preferredLanguages = Locale.preferredLanguages
        
        // 检查是否有中文语言偏好
        // Check for Chinese language preference
        for language in preferredLanguages {
            if language.hasPrefix("zh") {
                return "zh"
            }
        }
        
        return "en" // 默认英文 / Default English
    }
    
    // MARK: - Location Management
    
    /// 更新偏好位置（用户主动设置）
    /// Update preferred location (user actively sets)
    func updatePreferredLocation(_ location: String) {
        // 去除空白字符
        // Trim whitespace
        let trimmed = location.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            preferredLocation = nil
            return
        }
        
        preferredLocation = trimmed
        addToLocationHistory(trimmed)
    }
    
    /// 从查询中提取位置（智能推断）
    /// Extract location from query (intelligent inference)
    func extractLocationFromQuery(_ query: String) -> String? {
        let lowercased = query.lowercased()
        
        // 澳洲主要城市列表
        // Australian major cities
        let majorCities = [
            "sydney", "悉尼", "雪梨",
            "melbourne", "墨尔本",
            "brisbane", "布里斯班",
            "perth", "珀斯",
            "adelaide", "阿德莱德",
            "gold coast", "黄金海岸",
            "canberra", "堪培拉",
            "hobart", "霍巴特",
            "darwin", "达尔文"
        ]
        
        for city in majorCities {
            if lowercased.contains(city) {
                // 返回英文标准名称
                // Return English standard name
                return normalizedCityName(city)
            }
        }
        
        return nil
    }
    
    /// 标准化城市名称（统一为英文）
    /// Normalize city name (standardize to English)
    private func normalizedCityName(_ input: String) -> String {
        let mapping: [String: String] = [
            "悉尼": "Sydney",
            "雪梨": "Sydney",
            "墨尔本": "Melbourne",
            "布里斯班": "Brisbane",
            "珀斯": "Perth",
            "阿德莱德": "Adelaide",
            "黄金海岸": "Gold Coast",
            "堪培拉": "Canberra",
            "霍巴特": "Hobart",
            "达尔文": "Darwin"
        ]
        
        return mapping[input] ?? input.capitalized
    }
    
    /// 添加到位置历史记录
    /// Add to location history
    private func addToLocationHistory(_ location: String) {
        // 移除重复项
        // Remove duplicates
        locationHistory.removeAll { $0.lowercased() == location.lowercased() }
        
        // 添加到最前面
        // Add to front
        locationHistory.insert(location, at: 0)
        
        // 限制历史记录数量
        // Limit history size
        if locationHistory.count > 5 {
            locationHistory = Array(locationHistory.prefix(5))
        }
    }
    
    // MARK: - Query History Management
    
    /// 记录查询（用于频繁查询统计）
    /// Record query (for frequent query statistics)
    func recordQuery(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        
        // 移除重复查询
        // Remove duplicate queries
        frequentQueries.removeAll { $0.lowercased() == trimmed.lowercased() }
        
        // 添加到最前面
        // Add to front
        frequentQueries.insert(trimmed, at: 0)
        
        // 限制查询历史数量
        // Limit query history size
        if frequentQueries.count > 10 {
            frequentQueries = Array(frequentQueries.prefix(10))
        }
        
        // 更新统计
        // Update statistics
        updateStatistics()
        
        // 智能提取位置
        // Intelligently extract location
        if let location = extractLocationFromQuery(trimmed) {
            addToLocationHistory(location)
            
            // 如果用户还没有设置偏好位置，自动设置为推断的位置
            // If user hasn't set preferred location, auto-set to inferred location
            if preferredLocation == nil {
                preferredLocation = location
            }
        }
    }
    
    /// 清除查询历史
    /// Clear query history
    func clearQueryHistory() {
        frequentQueries = []
    }
    
    // MARK: - Language Management
    
    /// 切换语言（中文 ↔ 英文）
    /// Toggle language (Chinese ↔ English)
    func toggleLanguage() {
        preferredLanguage = (preferredLanguage == "zh") ? "en" : "zh"
    }
    
    /// 获取语言显示名称
    /// Get language display name
    func getLanguageDisplayName() -> String {
        switch preferredLanguage {
        case "zh":
            return "中文"
        case "en":
            return "English"
        default:
            return "English"
        }
    }
    
    // MARK: - Context for AI
    
    /// 生成AI上下文（传递给ChatViewModel）
    /// Generate AI context (pass to ChatViewModel)
    func generateContextForAI() -> String {
        var context: [String] = []
        
        if let location = preferredLocation {
            context.append("User's preferred location: \(location)")
        }
        
        context.append("User's preferred language: \(preferredLanguage == "zh" ? "Chinese" : "English")")
        
        if !locationHistory.isEmpty {
            context.append("Recent locations: \(locationHistory.prefix(3).joined(separator: ", "))")
        }
        
        return context.joined(separator: ". ")
    }
    
    // MARK: - Statistics
    
    /// 更新使用统计
    /// Update usage statistics
    private func updateStatistics() {
        // 更新最后使用时间
        // Update last used date
        UserDefaults.standard.set(Date(), forKey: Keys.lastUsedDate)
        
        // 增加总查询次数
        // Increment total query count
        let count = UserDefaults.standard.integer(forKey: Keys.totalQueryCount)
        UserDefaults.standard.set(count + 1, forKey: Keys.totalQueryCount)
    }
    
    /// 获取使用统计摘要
    /// Get usage statistics summary
    func getUsageStatistics() -> String {
        let count = totalQueryCount
        let lastUsed = lastUsedDate?.formatted(date: .abbreviated, time: .omitted) ?? "Never"
        
        return """
        Total queries: \(count)
        Last used: \(lastUsed)
        Preferred location: \(preferredLocation ?? "Not set")
        Language: \(getLanguageDisplayName())
        """
    }
    
    // MARK: - Persistence (Private)
    
    private func savePreferredLocation(_ location: String?) {
        if let location = location {
            UserDefaults.standard.set(location, forKey: Keys.preferredLocation)
        } else {
            UserDefaults.standard.removeObject(forKey: Keys.preferredLocation)
        }
    }
    
    private func savePreferredLanguage(_ language: String) {
        UserDefaults.standard.set(language, forKey: Keys.preferredLanguage)
    }
    
    private func saveFrequentQueries(_ queries: [String]) {
        UserDefaults.standard.set(queries, forKey: Keys.frequentQueries)
    }
    
    private func saveLocationHistory(_ history: [String]) {
        UserDefaults.standard.set(history, forKey: Keys.locationHistory)
    }
    
    // MARK: - Reset
    
    /// 重置所有偏好设置（恢复默认）
    /// Reset all preferences (restore defaults)
    func resetAllPreferences() {
        preferredLocation = nil
        preferredLanguage = Self.detectSystemLanguage()
        frequentQueries = []
        locationHistory = []
        
        UserDefaults.standard.removeObject(forKey: Keys.lastUsedDate)
        UserDefaults.standard.set(0, forKey: Keys.totalQueryCount)
    }
}
