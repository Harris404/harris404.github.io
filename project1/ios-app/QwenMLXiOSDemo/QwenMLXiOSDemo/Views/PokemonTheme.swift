import SwiftUI

// MARK: - 🎮 Pastel Pokémon Pixel Art Theme
// Matches the web app's pastel color scheme

extension Color {
    // Primary brand colors
    static let pokeRed = Color(red: 244/255, green: 112/255, blue: 104/255)       // #f47068
    static let pokeRedDark = Color(red: 212/255, green: 80/255, blue: 80/255)     // #d45050
    static let pokeBlue = Color(red: 123/255, green: 164/255, blue: 232/255)      // #7ba4e8
    static let pokeBlueDark = Color(red: 90/255, green: 130/255, blue: 196/255)   // #5a82c4
    static let pokeYellow = Color(red: 255/255, green: 216/255, blue: 90/255)     // #ffd85a
    static let pokeYellowDark = Color(red: 224/255, green: 184/255, blue: 58/255) // #e0b83a
    
    // Background colors
    static let pokeCream = Color(red: 254/255, green: 249/255, blue: 239/255)     // #fef9ef
    static let pokeWarm = Color(red: 250/255, green: 244/255, blue: 235/255)      // #faf4eb
    static let pokePanel = Color(red: 245/255, green: 239/255, blue: 230/255)     // #f5efe6
    
    // Accent colors
    static let pokeGreen = Color(red: 127/255, green: 212/255, blue: 160/255)     // #7fd4a0
    static let pokeGreenDark = Color(red: 76/255, green: 175/255, blue: 106/255)  // #4caf6a
    static let pokeFire = Color(red: 240/255, green: 160/255, blue: 96/255)       // #f0a060
    static let pokeWater = Color(red: 120/255, green: 168/255, blue: 240/255)     // #78a8f0
    static let pokePsychic = Color(red: 248/255, green: 136/255, blue: 168/255)   // #f888a8
    static let pokePurple = Color(red: 184/255, green: 152/255, blue: 216/255)    // #b898d8
    
    // Text colors
    static let pokeText = Color(red: 61/255, green: 53/255, blue: 40/255)         // #3d3528
    static let pokeTextDim = Color(red: 138/255, green: 128/255, blue: 112/255)   // #8a8070
    static let pokeTextLight = Color(red: 176/255, green: 168/255, blue: 152/255) // #b0a898
    
    // Border
    static let pokeBorder = Color(red: 224/255, green: 212/255, blue: 192/255)    // #e0d4c0
    static let pokeBorderStrong = Color(red: 200/255, green: 184/255, blue: 154/255) // #c8b89a
    
    // Sidebar dark
    static let sidebarBg = Color(red: 58/255, green: 58/255, blue: 92/255)        // #3a3a5c
}

// MARK: - Common Pixel-Art Modifiers

struct PixelBorder: ViewModifier {
    var color: Color = .pokeBorder
    var width: CGFloat = 2
    
    func body(content: Content) -> some View {
        content
            .overlay(
                Rectangle()
                    .stroke(color, lineWidth: width)
            )
    }
}

struct PixelShadow: ViewModifier {
    var color: Color = Color.black.opacity(0.06)
    
    func body(content: Content) -> some View {
        content
            .shadow(color: color, radius: 0, x: 2, y: 2)
    }
}

extension View {
    func pixelBorder(_ color: Color = .pokeBorder, width: CGFloat = 2) -> some View {
        modifier(PixelBorder(color: color, width: width))
    }
    
    func pixelShadow(_ color: Color = Color.black.opacity(0.06)) -> some View {
        modifier(PixelShadow(color: color))
    }
}
