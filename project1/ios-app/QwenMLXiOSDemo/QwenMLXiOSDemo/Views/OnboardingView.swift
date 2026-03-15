import SwiftUI

struct OnboardingView: View {
    @Binding var isPresented: Bool
    @State private var currentPage = 0
    
    private let pages: [(icon: String, title: String, description: String, color: Color)] = [
        ("globe.asia.australia.fill",
         "实时查询澳洲信息",
         "天气预报、汇率换算、交通查询……\n接入 20+ 实时数据源，随时获取最新信息",
         .pokeBlue),
        ("book.fill",
         "丰富的知识库",
         "签证政策、租房法规、医疗指南、教育信息……\n覆盖在澳生活方方面面的中文知识",
         .pokeGreen),
        ("bubble.left.and.bubble.right.fill",
         "智能中文对话",
         "用中文自然提问，AI 自动理解意图\n并调用合适的工具为你解答",
         .pokeRed),
    ]
    
    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $currentPage) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                    VStack(spacing: 24) {
                        Spacer()
                        
                        Image(systemName: page.icon)
                            .font(.system(size: 64))
                            .foregroundColor(page.color)
                        
                        Text(page.title)
                            .font(.title2)
                            .bold()
                            .foregroundColor(.pokeText)
                        
                        Text(page.description)
                            .font(.body)
                            .foregroundColor(.pokeTextDim)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                        
                        Spacer()
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .background(Color.pokeCream)
            
            Button(action: {
                if currentPage < pages.count - 1 {
                    withAnimation { currentPage += 1 }
                } else {
                    isPresented = false
                }
            }) {
                Text(currentPage < pages.count - 1 ? "下一步" : "开始使用")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.pokeRed)
                    .foregroundColor(.white)
                    .pixelBorder(.pokeRedDark)
                    .pixelShadow(Color.pokeRedDark.opacity(0.2))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
            
            if currentPage < pages.count - 1 {
                Button("跳过") {
                    isPresented = false
                }
                .font(.subheadline)
                .foregroundColor(.pokeTextDim)
                .padding(.bottom, 12)
            } else {
                Spacer().frame(height: 40)
            }
        }
        .background(Color.pokeCream)
    }
}
