import SwiftUI

struct ConversationHistoryView: View {
    @ObservedObject var viewModel: ChatViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            Group {
                if viewModel.conversations.isEmpty {
                    VStack(spacing: 12) {
                        Text("💬")
                            .font(.system(size: 40))
                        Text("暂无历史对话")
                            .foregroundColor(.pokeTextDim)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.pokeCream)
                } else {
                    List {
                        ForEach(viewModel.conversations) { conversation in
                            Button {
                                viewModel.loadConversation(conversation)
                                dismiss()
                            } label: {
                                HStack(spacing: 10) {
                                    Text("💬")
                                        .font(.caption)
                                    
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(conversation.title)
                                            .font(.body)
                                            .foregroundColor(.pokeText)
                                            .lineLimit(1)
                                        
                                        HStack {
                                            Text("\(conversation.messages.count) 条消息")
                                                .foregroundColor(.pokeTextDim)
                                            Spacer()
                                            Text(conversation.updatedAt, style: .relative)
                                                .foregroundColor(.pokeTextLight)
                                        }
                                        .font(.caption)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }
                        .onDelete { indexSet in
                            for index in indexSet {
                                viewModel.deleteConversation(viewModel.conversations[index])
                            }
                        }
                        .listRowBackground(Color.white)
                    }
                    .scrollContentBackground(.hidden)
                    .background(Color.pokeCream)
                }
            }
            .navigationTitle("历史对话")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("关闭") { dismiss() }
                        .foregroundColor(.pokeRed)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        viewModel.clearChat()
                        dismiss()
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.pokeRed)
                    }
                }
            }
        }
        .tint(.pokeRed)
    }
}
