import SwiftUI

enum Theme {
    static let background = Color(red: 14 / 255, green: 16 / 255, blue: 20 / 255)
    static let surface = Color(red: 25 / 255, green: 29 / 255, blue: 36 / 255)
    static let red = Color(red: 200 / 255, green: 30 / 255, blue: 48 / 255)
    static let coral = Color(red: 1, green: 102 / 255, blue: 112 / 255)
    static let gold = Color(red: 242 / 255, green: 198 / 255, blue: 91 / 255)
    static let text = Color(red: 247 / 255, green: 248 / 255, blue: 250 / 255)
}

struct BrandMark: View {
    var body: some View {
        HStack(spacing: 10) {
            Text("BA").font(.headline.weight(.black)).foregroundStyle(.white)
                .frame(width: 42, height: 42).background(Theme.red, in: RoundedRectangle(cornerRadius: 9))
                .accessibilityHidden(true)
            Text("BAY AREA APPS").font(.headline.weight(.bold))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Bay Area Apps")
    }
}
