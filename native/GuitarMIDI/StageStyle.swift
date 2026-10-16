import SwiftUI
import CoreText

// Match app/assets/css/tailwind.css and shared/stage/clock.ts.
// The same three font families are bundled locally, including their OFL licenses.
enum RigStyle {
    static let night = color(0x100c1c), tolex = color(0x1e1733), raised = color(0x2c2348)
    static let bone = color(0xf3ead6), dust = color(0xa99fbb), gold = color(0xffc531), ink = color(0x14080c)
    static let frets = [0x3dff45, 0xff2d2d, 0xffe14a, 0x3aa6ff, 0xff8c1a, 0xd15cff].map(color)
    static func color(_ hex: Int) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
    static func pixel(_ size: CGFloat) -> Font { .custom("Jersey10-Regular", size: size) }
    static func caps(_ size: CGFloat = 10) -> Font { .custom("Silkscreen-Regular", size: size) }
    static func body(_ size: CGFloat = 16) -> Font { .custom("BarlowSemiCondensed-Regular", size: size) }
    static func lane(_ pitch: Int) -> Int { max(0, [40,45,50,55,59,64].lastIndex(where: { pitch >= $0 }) ?? 0) }
    static func registerFonts() {
        for name in ["Jersey10-Regular", "Silkscreen-Regular", "BarlowSemiCondensed-Regular"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
}

struct PixelFrame: Shape {
    func path(in rect: CGRect) -> Path {
        let step: CGFloat = 4
        return Path { p in
            p.move(to: CGPoint(x: step, y: 0))
            for point in [CGPoint(x: rect.width-step,y: 0), CGPoint(x: rect.width-step,y: step), CGPoint(x: rect.width,y: step), CGPoint(x: rect.width,y: rect.height-step), CGPoint(x: rect.width-step,y: rect.height-step), CGPoint(x: rect.width-step,y: rect.height), CGPoint(x: step,y: rect.height), CGPoint(x: step,y: rect.height-step), CGPoint(x: 0,y: rect.height-step), CGPoint(x: 0,y: step), CGPoint(x: step,y: step)] { p.addLine(to: point) }
            p.closeSubpath()
        }
    }
}

struct StompButton: ButtonStyle {
    var primary = false
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(RigStyle.pixel(primary ? 25 : 21))
            .textCase(.uppercase)
            .foregroundStyle(primary ? RigStyle.ink : RigStyle.bone)
            .padding(.horizontal, 16).padding(.vertical, 9)
            .frame(maxWidth: primary ? .infinity : nil)
            .background(primary ? RigStyle.gold : RigStyle.tolex)
            .clipShape(PixelFrame())
            .overlay(PixelFrame().stroke(primary ? RigStyle.gold : RigStyle.bone, lineWidth: 2))
            .shadow(color: RigStyle.ink, radius: 0, x: configuration.isPressed ? 1 : 4, y: configuration.isPressed ? 1 : 4)
            .offset(x: configuration.isPressed ? 3 : 0, y: configuration.isPressed ? 3 : 0)
            .opacity(enabled ? 1 : 0.45)
    }
}

struct RigCaption: View {
    var text: String
    var body: some View { Text(text).font(RigStyle.caps()).foregroundStyle(RigStyle.dust) }
}

// A compact native drawing of the website's StageSet amp cabinets and NoteHighway:
// purple tolex, woven grilles, Benniks nameplates, gold piping and six fret lanes.
// No renderer or animation loop is needed; only actual note changes redraw it.
struct VoxelStage: View {
    let pitches: [Int]
    var body: some View {
        Canvas { context, size in
            let sx = size.width / 360, sy = size.height / 204
            context.scaleBy(x: sx, y: sy)
            func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: Color) {
                context.fill(Path(CGRect(x: x, y: y, width: w, height: h)), with: .color(color), style: FillStyle(antialiased: false))
            }
            func poly(_ points: [CGPoint], _ color: Color) {
                var p = Path(); p.addLines(points); p.closeSubpath()
                context.fill(p, with: .color(color), style: FillStyle(antialiased: false))
            }
            func cabinet(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) {
                poly([CGPoint(x:x,y:y),CGPoint(x:x+7,y:y-6),CGPoint(x:x+w+7,y:y-6),CGPoint(x:x+w,y:y)], RigStyle.raised)
                poly([CGPoint(x:x+w,y:y),CGPoint(x:x+w+7,y:y-6),CGPoint(x:x+w+7,y:y+h-6),CGPoint(x:x+w,y:y+h)], RigStyle.ink)
                rect(x,y,w,h,RigStyle.tolex)
                rect(x+3,y+3,w-6,h-6,RigStyle.gold.opacity(0.65))
                rect(x+4,y+4,w-8,h-8,RigStyle.color(0x241c36))
                for row in stride(from: CGFloat(7), to: h-5, by: 3) {
                    for col in stride(from: CGFloat(7), to: w-5, by: 3) { rect(x+col,y+row,1,1,RigStyle.color(0x4a4058)) }
                }
                context.draw(Text("Benniks").font(.custom("SnellRoundhand-Bold",size:10)).foregroundColor(RigStyle.bone), at: CGPoint(x:x+w/2,y:y+12))
            }
            rect(0,0,360,204,RigStyle.night)
            // Lighting truss and the LED wall, both built on a square pixel grid.
            for x in stride(from: CGFloat(12), to: 350, by: 16) {
                rect(x,12,12,3,RigStyle.raised); rect(x,22,12,3,RigStyle.raised); rect(x,15,3,7,RigStyle.raised)
            }
            for x in stride(from: CGFloat(40), to: 340, by: 56) {
                rect(x,28,12,8,RigStyle.raised); rect(x+2,30,8,4,RigStyle.gold.opacity(0.8))
            }
            rect(119,43,122,55,RigStyle.tolex)
            for y in stride(from: CGFloat(46), to: 98, by: 5) {
                for x in stride(from: CGFloat(122), to: 239, by: 5) { rect(x,y,2,2,RigStyle.raised) }
            }
            context.draw(Text("A&K").font(RigStyle.pixel(35)).foregroundColor(RigStyle.gold), at: CGPoint(x:180,y:69))
            rect(16,134,328,6,RigStyle.raised)
            rect(16,140,328,9,RigStyle.ink)
            for x: CGFloat in [24,76,240,292] {
                cabinet(x,93,38,38)
                cabinet(x,54,38,36)
                rect(x,43,38,9,RigStyle.tolex)
                rect(x+3,47,32,2,RigStyle.bone)
            }
            // Perspective fretboard: same low-to-high pitch ranges as the website.
            poly([CGPoint(x:145,y:107),CGPoint(x:215,y:107),CGPoint(x:292,y:204),CGPoint(x:68,y:204)],RigStyle.color(0x291d29))
            for row in 0..<7 {
                let t = CGFloat(row)/6
                let y = 108 + t*t*96
                let spread = 35 + t*t*77
                rect(180-spread,y,spread*2,2,RigStyle.bone.opacity(0.35))
            }
            let active = Set(pitches.map(RigStyle.lane))
            for lane in 0..<6 {
                let top = 150 + CGFloat(lane)*12
                let bottom = 85 + CGFloat(lane)*38
                poly([CGPoint(x:top,y:108),CGPoint(x:top+1,y:108),CGPoint(x:bottom+2,y:204),CGPoint(x:bottom,y:204)],RigStyle.bone.opacity(0.35))
                let color = RigStyle.frets[lane]
                let x = 81 + CGFloat(lane)*38
                rect(x+4,186,26,10,RigStyle.ink)
                rect(x,180,26,10,color.opacity(active.contains(lane) ? 1 : 0.3))
                rect(x+3,177,20,3,color.opacity(active.contains(lane) ? 0.9 : 0.2))
            }
        }
        .accessibilityHidden(true)
    }
}
