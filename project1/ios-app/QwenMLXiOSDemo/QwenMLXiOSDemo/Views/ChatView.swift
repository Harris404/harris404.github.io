import SwiftUI
import PhotosUI

struct ChatView: View {
    @StateObject private var viewModel = ChatViewModel()
    @State private var showSettings: Bool = false
    @State private var showHistory: Bool = false
    @State private var selectedPhotoItem: PhotosPickerItem? = nil
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // 服务状态指示器
                if let status = viewModel.serviceStatus, !status.allAvailable {
                    ServiceStatusBanner(status: status) {
                        showSettings = true
                    }
                }
                
                // 消息列表
                ScrollViewReader { scrollProxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            // 欢迎消息
                            if viewModel.messages.isEmpty {
                                WelcomeView { question in
                                    viewModel.inputText = question
                                    Task { await viewModel.sendMessage() }
                                }
                            }
                            
                            ForEach(viewModel.messages) { message in
                                MessageBubble(message: message)
                                    .id(message.id)
                            }
                            
                            // 流式状态指示器
                            if viewModel.isProcessing {
                                StreamingStatusView(
                                    status: viewModel.streamingStatus,
                                    activeTools: viewModel.activeTools,
                                    hasContent: viewModel.messages.last?.content.isEmpty == false
                                )
                                .id("streaming-status")
                            }
                        }
                        .padding()
                    }
                    .background(Color.pokeCream)
                    .onChange(of: viewModel.messages.count) { _ in
                        scrollToBottom(scrollProxy)
                    }
                    .onChange(of: viewModel.messages.last?.content) { _ in
                        scrollToBottom(scrollProxy)
                    }
                }
                
                Divider()
                    .background(Color.pokeBorder)
                
                // 图片预览
                if viewModel.pendingImageBase64 != nil {
                    HStack {
                        Image(systemName: "photo.fill")
                            .foregroundColor(.pokeBlue)
                        Text("📷 已选择图片")
                            .font(.caption)
                            .foregroundColor(.pokeTextDim)
                        Spacer()
                        Button(action: { viewModel.pendingImageBase64 = nil }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.pokeTextDim)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 6)
                    .background(Color.pokeBlue.opacity(0.08))
                }
                
                // 输入框
                HStack(spacing: 12) {
                    // 图片选择按钮
                    PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.title3)
                            .foregroundColor(viewModel.pendingImageBase64 != nil ? .pokeGreen : .pokeBlue)
                            .frame(width: 36, height: 36)
                    }
                    .onChange(of: selectedPhotoItem) { newItem in
                        Task {
                            if let data = try? await newItem?.loadTransferable(type: Data.self) {
                                viewModel.loadImageFromData(data)
                            }
                        }
                    }
                    
                    TextField("输入你的问题...", text: $viewModel.inputText, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(1...5)
                        .disabled(viewModel.isProcessing)
                        .tint(.pokeRed)
                    
                    if viewModel.isProcessing {
                        // 停止生成按钮
                        Button(action: {
                            viewModel.stopGenerating()
                        }) {
                            Image(systemName: "stop.circle.fill")
                                .font(.title3)
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                                .background(Color.pokeRed)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    } else {
                        // 发送按钮
                        Button(action: {
                            Task {
                                await viewModel.sendMessage()
                            }
                        }) {
                            Image(systemName: "paperplane.fill")
                                .font(.title3)
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                                .background(viewModel.inputText.isEmpty ? Color.pokeTextLight : Color.pokeRed)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .disabled(viewModel.inputText.isEmpty)
                    }
                }
                .padding()
                .background(Color.white)
            }
            .background(Color.pokeCream)
            .navigationTitle("🦘 澳知AI")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    HStack(spacing: 12) {
                        Button(action: {
                            showSettings = true
                        }) {
                            Image(systemName: "gearshape")
                                .foregroundColor(.pokeTextDim)
                        }
                        
                        Button(action: {
                            showHistory = true
                        }) {
                            Image(systemName: "clock.arrow.circlepath")
                                .foregroundColor(.pokeTextDim)
                        }
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 12) {
                        // Agent 标签
                        if !viewModel.currentAgent.isEmpty {
                            AgentBadge(agent: viewModel.currentAgent)
                        }
                        
                        Button(action: {
                            viewModel.clearChat()
                        }) {
                            Image(systemName: "plus.bubble")
                                .foregroundColor(.pokeRed)
                        }
                    }
                }
            }
        }
        .tint(.pokeRed)
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .sheet(isPresented: $showHistory) {
            ConversationHistoryView(viewModel: viewModel)
        }
        .alert("服务连接问题", isPresented: $viewModel.showServiceError) {
            Button("去设置") {
                showSettings = true
            }
            Button("稍后再说", role: .cancel) { }
        } message: {
            Text(viewModel.serviceErrorMessage)
        }
    }
    
    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        if let lastId = viewModel.messages.last?.id {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(lastId, anchor: .bottom)
            }
        }
    }
}

// MARK: - 流式状态视图

struct StreamingStatusView: View {
    let status: String
    let activeTools: [String]
    let hasContent: Bool
    
    var body: some View {
        if !status.isEmpty && !hasContent {
            HStack(spacing: 8) {
                ProgressView()
                    .scaleEffect(0.8)
                    .tint(.pokeYellowDark)
                Text(status)
                    .font(.caption)
                    .foregroundColor(.pokeTextDim)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.pokeYellow.opacity(0.12))
            .pixelBorder(.pokeYellow)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
        }
    }
}

// MARK: - Agent 标签

struct AgentBadge: View {
    let agent: String
    
    private var display: (emoji: String, label: String, color: Color) {
        switch agent {
        case "life": return ("🏠", "生活", .pokeBlue)
        case "finance": return ("💰", "财务", .pokeYellowDark)
        case "education": return ("🎓", "教育", .pokePurple)
        case "healthcare": return ("🏥", "医疗", .pokeGreen)
        case "wellness": return ("🌿", "休闲", .pokeGreenDark)
        default: return ("🤖", agent, .pokeFire)
        }
    }
    
    var body: some View {
        HStack(spacing: 2) {
            Text(display.emoji)
                .font(.caption2)
            Text(display.label)
                .font(.caption2)
                .foregroundColor(display.color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(display.color.opacity(0.1))
        .pixelBorder(display.color.opacity(0.4))
    }
}

// MARK: - 服务状态横幅

struct ServiceStatusBanner: View {
    let status: ServiceAvailability
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack {
                Image(systemName: status.worker ? "exclamationmark.triangle.fill" : "xmark.octagon.fill")
                    .foregroundColor(status.worker ? .pokeYellowDark : .pokeRed)
                
                Text(status.worker ? "部分服务不可用" : "AI服务未连接")
                    .font(.subheadline)
                    .foregroundColor(.pokeText)
                
                Spacer()
                
                Text("点击配置")
                    .font(.caption)
                    .foregroundColor(.pokeTextDim)
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.pokeTextDim)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(status.worker ? Color.pokeYellow.opacity(0.12) : Color.pokeRed.opacity(0.1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 欢迎视图

struct WelcomeView: View {
    let onSuggestionTap: (String) -> Void
    
    private let suggestions: [(emoji: String, question: String)] = [
        ("🌤️", "悉尼今天天气怎么样？"),
        ("🛒", "Woolworths 这周有什么特价？"),
        ("🎓", "澳洲有哪些计算机专业？"),
        ("🛂", "485签证审理进度怎么样？"),
        ("🚗", "二手车Toyota Camry大概多少钱？"),
        ("🎉", "这周末悉尼有什么活动？"),
    ]
    
    var body: some View {
        VStack(spacing: 20) {
            Text("🦘")
                .font(.system(size: 56))
            
            Text("欢迎使用澳知AI")
                .font(.title2)
                .bold()
                .foregroundColor(.pokeText)
            
            Text("专为澳洲华人打造的AI生活助手\n天气 · 超市 · 签证 · 交通 · 医疗 · 教育")
                .font(.subheadline)
                .foregroundColor(.pokeTextDim)
                .multilineTextAlignment(.center)
            
            VStack(alignment: .leading, spacing: 8) {
                ForEach(suggestions, id: \.question) { item in
                    SuggestionChip(text: "\(item.emoji) \(item.question)") {
                        onSuggestionTap(item.question)
                    }
                }
            }
            .padding(.top, 8)
        }
        .padding(32)
    }
}

struct SuggestionChip: View {
    let text: String
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            Text(text)
                .font(.caption)
                .foregroundColor(.pokeText)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .pixelBorder(.pokeBorder)
                .pixelShadow()
        }
        .buttonStyle(.plain)
    }
}
