// Run from native/GuitarMIDI: swift Artwork/GenerateIcon.swift
// AppKit keeps icon generation dependency-free; coordinates use a 64-unit pixel grid.
import AppKit

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let iconset = root.appendingPathComponent("Artwork/AppIcon.iconset")
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
func color(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255,
            green: CGFloat((hex >> 8) & 255) / 255,
            blue: CGFloat(hex & 255) / 255, alpha: 1)
}
func render(_ pixels: Int) -> Data {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let context = NSGraphicsContext.current!.cgContext
    context.scaleBy(x: CGFloat(pixels) / 64, y: CGFloat(pixels) / 64)
    context.translateBy(x: 0, y: 64)
    context.scaleBy(x: 1, y: -1)
    func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ hex: UInt32) {
        color(hex).setFill(); NSBezierPath(rect: NSRect(x: x, y: y, width: w, height: h)).fill()
    }
    func polygon(_ points: [(CGFloat, CGFloat)], _ hex: UInt32, dx: CGFloat = 0, dy: CGFloat = 0) {
        let path = NSBezierPath()
        path.move(to: NSPoint(x: points[0].0 + dx, y: points[0].1 + dy))
        for p in points.dropFirst() { path.line(to: NSPoint(x: p.0 + dx, y: p.1 + dy)) }
        path.close(); color(hex).setFill(); path.fill()
    }
    color(0x100c1c).setFill()
    NSBezierPath(roundedRect: NSRect(x: 3, y: 4, width: 58, height: 58), xRadius: 13, yRadius: 13).fill()
    color(0x35294f).setFill()
    NSBezierPath(roundedRect: NSRect(x: 3, y: 2, width: 58, height: 58), xRadius: 13, yRadius: 13).fill()
    color(0x1e1733).setFill()
    NSBezierPath(roundedRect: NSRect(x: 4, y: 3, width: 56, height: 56), xRadius: 12, yRadius: 12).fill()
    // A stepped electric body, diagonal neck and six-in-line headstock.
    let body: [(CGFloat, CGFloat)] = [(14,31),(18,31),(18,27),(22,27),(22,31),(26,31),(26,28),(30,28),(30,32),(34,32),(34,36),(37,36),(37,43),(34,43),(34,47),(30,47),(30,50),(21,50),(21,48),(16,48),(16,44),(12,44),(12,35),(14,35)]
    let neck: [(CGFloat, CGFloat)] = [(24,32),(43,13),(48,18),(29,37)]
    let head: [(CGFloat, CGFloat)] = [(41,13),(41,10),(45,10),(45,8),(50,8),(50,11),(53,11),(53,16),(50,16),(50,19),(47,19)]
    for shape in [body, neck, head] { polygon(shape, 0x100918, dx: 2, dy: 3) }
    polygon(body, 0xa65f19, dy: 2)
    polygon(neck, 0xa65f19, dy: 2)
    polygon(head, 0xa65f19, dy: 2)
    polygon(body, 0xffc531)
    polygon(neck, 0xf3ead6)
    polygon([(26,32),(43,15),(46,18),(29,35)], 0x493351)
    polygon(head, 0xffc531)
    // Pickguard and pickups remain legible at Dock sizes.
    polygon([(22,34),(27,34),(31,38),(31,43),(28,46),(23,46),(18,41),(18,38)], 0x2c2348)
    polygon([(23,35),(25,33),(31,39),(29,41)], 0x100c1c)
    polygon([(19,40),(21,38),(27,44),(25,46)], 0xf3ead6)
    rect(14,35,2,7,0xffe39a)
    rect(16,33,3,2,0xffe39a)
    rect(30,43,2,2,0xffe39a)
    rect(28,46,2,2,0xf3ead6)
    // Three fine string pairs are suggested by two bright continuous lines.
    for offset: CGFloat in [0, 1.3] {
        let line = NSBezierPath()
        line.move(to: NSPoint(x: 22 + offset, y: 42 + offset))
        line.line(to: NSPoint(x: 46 + offset, y: 18 + offset))
        line.lineWidth = 0.45
        color(0xf3ead6).setStroke(); line.stroke()
    }
    for i in 0..<4 {
        let p = CGFloat(i) * 3
        polygon([(31+p,27-p),(34+p,30-p),(34.5+p,29.5-p),(31.5+p,26.5-p)], 0xa99fbb)
    }
    rect(44,10,2,2,0xffe39a)
    rect(49,13,2,2,0x493351)
    rect(46,16,2,2,0x493351)
    let gems: [UInt32] = [0x3dff45,0xff2d2d,0xffe14a,0x3aa6ff,0xff8c1a,0xd15cff]
    for (i, hex) in gems.enumerated() {
        let x = CGFloat(14 + i * 6)
        rect(x,54,4,3,0x100c1c)
        rect(x,53,4,2,hex)
    }
    NSGraphicsContext.restoreGraphicsState()
    return bitmap.representation(using: .png, properties: [:])!
}
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let name = "icon_\(size)x\(size)\(scale == 2 ? "@2x" : "").png"
        try render(size * scale).write(to: iconset.appendingPathComponent(name))
    }
}
try render(1024).write(to: root.appendingPathComponent("Artwork/AppIcon.png"))
