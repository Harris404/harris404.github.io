import SwiftUI

/// 设置界面 - 用户偏好 + 服务状态
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var userPreferences = UserPreferencesService.shared

    @State private var isChecking: Bool = false
    @State private var workerOnline: Bool? = nil

    var body: some View {
        NavigationView {
            Form {
                // MARK: - 服务状态
                Section {
                    if isChecking {
                        HStack {
                            ProgressView()
                                .padding(.trailing, 8)
                                .tint(.pokeYellowDark)
                            Text("正在检查服务...")
                                .foregroundColor(.pokeTextDim)
                        }
                    } else if let online = workerOnline {
                        HStack {
                            Text("☁️")
                            Text("澳洲助手服务")
                                .foregroundColor(.pokeText)
                            Spacer()
                            Text(online ? "✅ 正常" : "❌ 离线")
                                .foregroundColor(online ? .pokeGreen : .pokeRed)
                        }
                        if online {
                            HStack {
                                Text("🔗")
                                Text("服务地址")
                                    .foregroundColor(.pokeTextDim)
                                    .font(.caption)
                                Spacer()
                                Text("Cloudflare Workers")
                                    .foregroundColor(.pokeTextDim)
                                    .font(.caption)
                                    .lineLimit(1)
                            }
                        }
                    } else {
                        Button("检查服务状态") {
                            checkService()
                        }
                        .foregroundColor(.pokeBlue)
                    }
                } header: {
                    Text("服务状态")
                } footer: {
                    if let online = workerOnline {
                        Text(online
                             ? "✅ AI助手已通过云端服务接入，无需本地服务器，随时随地可用。"
                             : "❌ 无法连接，请检查网络后点击「检查服务状态」重试。")
                            .foregroundColor(online ? .pokeGreen : .pokeRed)
                    }
                }

                // MARK: - 用户偏好
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        // 首选位置
                        VStack(alignment: .leading, spacing: 4) {
                            Text("首选城市")
                                .font(.subheadline)
                                .foregroundColor(.pokeTextDim)

                            if let location = userPreferences.preferredLocation {
                                HStack {
                                    Text(location)
                                        .foregroundColor(.pokeText)
                                    Spacer()
                                    Button(action: {
                                        userPreferences.preferredLocation = nil
                                    }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.pokeTextDim)
                                    }
                                }
                                .padding(8)
                                .background(Color.pokeBlue.opacity(0.08))
                                .pixelBorder(.pokeBorder)
                            } else {
                                Text("未设置（将从对话中自动识别）")
                                    .font(.caption)
                                    .foregroundColor(.pokeTextDim)
                                    .italic()
                            }
                        }

                        Divider()

                        // 语言偏好
                        HStack {
                            Text("界面语言")
                                .font(.subheadline)
                                .foregroundColor(.pokeTextDim)
                            Spacer()
                            Button(action: {
                                userPreferences.toggleLanguage()
                            }) {
                                HStack(spacing: 6) {
                                    Text(userPreferences.preferredLanguage == "zh" ? "🇨🇳" : "🇦🇺")
                                    Text(userPreferences.preferredLanguage == "zh" ? "中文" : "English")
                                        .foregroundColor(.pokeText)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.pokeBlue.opacity(0.1))
                                .pixelBorder(.pokeBlue.opacity(0.3))
                            }
                        }
                    }
                } header: {
                    Text("用户偏好")
                } footer: {
                    Text("AI 会根据你的偏好提供更个性化的回答")
                }

                // MARK: - 使用统计
                Section {
                    HStack {
                        Text("总查询次数")
                            .foregroundColor(.pokeText)
                        Spacer()
                        Text("\(userPreferences.totalQueryCount)")
                            .foregroundColor(.pokeRed)
                            .fontWeight(.bold)
                    }

                    if let lastUsed = userPreferences.lastUsedDate {
                        HStack {
                            Text("最后使用")
                                .foregroundColor(.pokeText)
                            Spacer()
                            Text(lastUsed, style: .relative)
                                .foregroundColor(.pokeTextDim)
                        }
                    }

                    if !userPreferences.locationHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("最近位置")
                                .font(.subheadline)
                                .foregroundColor(.pokeTextDim)
                            ForEach(userPreferences.locationHistory, id: \.self) { location in
                                Text("📍 \(location)")
                                    .font(.caption)
                                    .foregroundColor(.pokeTextDim)
                            }
                        }
                    }

                    if !userPreferences.frequentQueries.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("最近查询")
                                .font(.subheadline)
                                .foregroundColor(.pokeTextDim)
                            ForEach(userPreferences.frequentQueries.prefix(5), id: \.self) { query in
                                Text("💬 \(query)")
                                    .font(.caption)
                                    .foregroundColor(.pokeTextDim)
                                    .lineLimit(1)
                            }
                        }
                    }

                    Button(role: .destructive, action: {
                        userPreferences.frequentQueries.removeAll()
                        userPreferences.locationHistory.removeAll()
                        userPreferences.preferredLocation = nil
                    }) {
                        HStack {
                            Image(systemName: "trash")
                            Text("清除所有本地数据")
                        }
                    }
                } header: {
                    Text("使用统计")
                } footer: {
                    Text("所有偏好数据仅存储在本地设备")
                }

                // MARK: - 刷新按钮
                Section {
                    Button(action: checkService) {
                        HStack {
                            Image(systemName: "arrow.clockwise.circle.fill")
                                .foregroundColor(.pokeBlue)
                            Text("重新检查服务状态")
                                .foregroundColor(.pokeBlue)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.pokeCream)
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") { dismiss() }
                        .foregroundColor(.pokeRed)
                }
            }
            .onAppear {
                checkService()
            }
        }
        .tint(.pokeRed)
    }

    private func checkService() {
        isChecking = true
        Task {
            let online = await CloudflareService.shared.checkHealth()
            workerOnline = online
            isChecking = false
        }
    }
}
