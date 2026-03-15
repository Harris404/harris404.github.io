import SwiftUI

@main
struct QwenMLXiOSDemoApp: App {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @State private var showOnboarding = false
    
    var body: some Scene {
        WindowGroup {
            ChatView()
                .fullScreenCover(isPresented: $showOnboarding) {
                    OnboardingView(isPresented: $showOnboarding)
                }
                .onAppear {
                    if !hasCompletedOnboarding {
                        showOnboarding = true
                        hasCompletedOnboarding = true
                    }
                }
        }
    }
}
